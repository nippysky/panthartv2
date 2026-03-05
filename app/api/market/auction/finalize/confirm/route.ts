/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/auction/finalize/confirm/route.ts

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import prisma from "@/src/lib/db";
import { AuctionStatus } from "@/src/lib/generated/prisma/client";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

function sameAddr(a: string, b: string) {
  return (a || "").toLowerCase() === (b || "").toLowerCase();
}

function normAddr(a: string) {
  return ethers.getAddress(a);
}

function isHex32(x: string) {
  return ethers.isHexString(x, 32);
}

export async function POST(req: NextRequest) {
  let step = "start";

  try {
    step = "parse_body";
    const body = (await req.json().catch(() => null)) as
      | {
          dbId?: string; // Auction row id in DB (preferred)
          txHashFinalized?: string; // finalize tx hash (0x…)
          auctionId?: string; // optional on-chain id (digits)
          contract?: string; // optional guard
          tokenId?: string; // optional guard
        }
      | null;

    const dbId = (body?.dbId || "").trim();
    const txHashRaw = (body?.txHashFinalized || "").trim();
    const auctionIdRaw = (body?.auctionId || "").trim();

    if (!dbId) return json(400, { ok: false, error: "Missing dbId" });
    if (!txHashRaw || !isHex32(txHashRaw)) {
      return json(400, { ok: false, error: "Invalid txHashFinalized" });
    }

    const txHashFinalized = txHashRaw.toLowerCase();

    step = "load_db";
    const row = await prisma.auction.findUnique({
      where: { id: dbId },
      select: {
        id: true,
        status: true,
        txHashFinalized: true,
        txHashCancelled: true,
        nftId: true,
        sellerAddress: true,
        nft: { select: { contract: true, tokenId: true } },
      },
    });

    if (!row?.id || !row.nft?.contract || !row.nft?.tokenId) {
      return json(404, { ok: false, error: "Auction not found" });
    }

    // Idempotent: already ENDED with same hash
    if (
      row.status === AuctionStatus.ENDED &&
      (row.txHashFinalized || "").toLowerCase() === txHashFinalized
    ) {
      return json(200, { ok: true, updated: { id: row.id, status: row.status } });
    }

    // Never finalize a cancelled auction (DB integrity)
    if (row.status === AuctionStatus.CANCELLED) {
      return json(409, { ok: false, error: "Auction is CANCELLED; cannot finalize" });
    }

    step = "env";
    const RPC_HTTP_URL =
      process.env.RPC_HTTP_URL ||
      process.env.RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_HTTP_URL ||
      "https://rpc.ankr.com/electroneum";

    const MARKETPLACE_ADDR =
      process.env.MARKETPLACE_CORE_ADDRESS ||
      process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS ||
      process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
      "";

    if (!MARKETPLACE_ADDR || !ethers.isAddress(MARKETPLACE_ADDR)) {
      return json(500, {
        ok: false,
        error: "Missing MARKETPLACE_CORE_ADDRESS (or NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS)",
      });
    }

    const provider = new ethers.JsonRpcProvider(RPC_HTTP_URL);
    const marketplaceAddr = normAddr(MARKETPLACE_ADDR);
    const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
    const mkt = new ethers.Contract(marketplaceAddr, MARKETPLACE_CORE_ABI as any, provider);

    step = "receipt";
    const receipt = await provider.getTransactionReceipt(txHashFinalized).catch(() => null);
    if (!receipt) return json(404, { ok: false, error: "Transaction receipt not found yet" });
    if (receipt.status !== 1) {
      return json(409, { ok: false, error: "Finalize transaction failed on-chain" });
    }

    // Optional guard checks (if caller passes them)
    const wantContract = normAddr(row.nft.contract);
    const wantTokenId = String(row.nft.tokenId);

    const contractBody =
      body?.contract && ethers.isAddress(body.contract) ? normAddr(body.contract) : null;
    const tokenIdBody = body?.tokenId ? String(body.tokenId) : null;

    if (contractBody && !sameAddr(contractBody, wantContract)) {
      return json(422, { ok: false, error: "contract mismatch" });
    }
    if (tokenIdBody && tokenIdBody !== wantTokenId) {
      return json(422, { ok: false, error: "tokenId mismatch" });
    }

    step = "detect_settle_event";
    // Your ABI emits AuctionSettled on finalize()
    // We treat the event as primary evidence.
    let sawSettled = false;
    let auctionIdFromEvent: bigint | null = null;

    for (const lg of receipt.logs || []) {
      if (!lg?.address || !ethers.isAddress(lg.address)) continue;
      if (!sameAddr(lg.address, marketplaceAddr)) continue;

      try {
        const parsed = iface.parseLog({ topics: lg.topics as any, data: lg.data as any });
        if (!parsed) continue;

        if (parsed.name !== "AuctionSettled") continue;

        const args: any = parsed.args;

        const aIdRaw = args?.auctionId ?? args?.id ?? null;
        if (aIdRaw != null) {
          auctionIdFromEvent = typeof aIdRaw === "bigint" ? aIdRaw : BigInt(aIdRaw.toString());
        }

        sawSettled = true;
        break;
      } catch {
        // ignore unrelated logs
      }
    }

    step = "resolve_chain_id";
    const auctionIdBody = auctionIdRaw && /^[0-9]+$/.test(auctionIdRaw) ? BigInt(auctionIdRaw) : null;
    const chainId = auctionIdBody ?? auctionIdFromEvent;

    // If we have on-chain id, verify it matches our NFT & is settled
    if (chainId != null) {
      step = "read_auction_state";
      const A = await mkt.auctions(chainId).catch(() => null);
      if (!A) {
        // Couldn't read state; fall back to event evidence
        if (!sawSettled) {
          return json(422, { ok: false, error: "No AuctionSettled evidence found" });
        }
      } else {
        const tokenAddr = String(A[1] ?? "");
        const tokenIdChain = (A[2] as bigint) ?? BigInt(0);
        const settled = Boolean(A[13]);

        if (ethers.isAddress(tokenAddr)) {
          const tokenAddrNorm = normAddr(tokenAddr);
          if (!sameAddr(tokenAddrNorm, wantContract) || tokenIdChain.toString() !== wantTokenId) {
            return json(422, { ok: false, error: "On-chain auction does not match this NFT" });
          }
        }

        if (!settled) {
          // If event says settled but read says not settled, that's inconsistent → don't mark ENDED.
          return json(409, {
            ok: false,
            error: "Auction not settled on-chain; not marking ENDED yet",
          });
        }
      }
    } else {
      // No chain id; require event evidence
      if (!sawSettled) {
        return json(422, { ok: false, error: "No AuctionSettled evidence found" });
      }
    }

    step = "update_db";
    const updated = await prisma.auction.update({
      where: { id: dbId },
      data: {
        status: AuctionStatus.ENDED,
        txHashFinalized,
      },
      select: { id: true, status: true, txHashFinalized: true },
    });

    return json(200, {
      ok: true,
      updated,
      chainId: chainId != null ? chainId.toString() : null,
    });
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Unknown error";
    console.error("[api/market/auction/finalize/confirm] FAIL", { step, msg, stack: e?.stack });
    return json(500, { ok: false, error: msg, step });
  }
}