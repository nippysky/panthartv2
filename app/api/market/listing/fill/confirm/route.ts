/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/listing/fill/confirm/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { ListingStatus } from "@/src/lib/generated/prisma/client";
import { ethers } from "ethers";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

function sameAddr(a: string, b: string) {
  return (a || "").toLowerCase() === (b || "").toLowerCase();
}

function normAddr(a: string) {
  return ethers.getAddress(a); // checksum
}

export async function POST(req: NextRequest) {
  await prismaReady;

  const body = (await req.json().catch(() => null)) as
    | {
        dbId?: string;
        txHashFilled?: string;
        // optional extra checks
        contract?: string;
        tokenId?: string;
        chainId?: string; // listingId on-chain (digits)
      }
    | null;

  const dbId = (body?.dbId || "").trim();
  const txHashRaw = (body?.txHashFilled || "").trim();

  if (!dbId) return json(400, { ok: false, error: "Missing dbId" });
  if (!txHashRaw || !ethers.isHexString(txHashRaw, 32)) {
    return json(400, { ok: false, error: "Invalid txHashFilled" });
  }

  const txHashFilled = txHashRaw.toLowerCase(); // tx hashes are safe to normalize

  const row = await prisma.marketplaceListing.findUnique({
    where: { id: dbId },
    select: {
      id: true,
      status: true,
      txHashFilled: true,
      nftId: true,
      nft: { select: { contract: true, tokenId: true } },
    },
  });

  if (!row?.id || !row.nft?.contract || !row.nft?.tokenId) {
    return json(404, { ok: false, error: "Listing not found" });
  }

  // Idempotent: if already SOLD with same hash
  if (
    row.status === ListingStatus.SOLD &&
    (row.txHashFilled || "").toLowerCase() === txHashFilled
  ) {
    return json(200, { ok: true, updated: { id: row.id, status: row.status } });
  }

  const RPC_HTTP_URL =
    process.env.RPC_HTTP_URL ||
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_HTTP_URL ||
    "https://rpc.ankr.com/electroneum";

  const MARKETPLACE_ADDR =
    process.env.MARKETPLACE_CORE_ADDRESS ||
    process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
    "";

  if (!MARKETPLACE_ADDR || !ethers.isAddress(MARKETPLACE_ADDR)) {
    return json(500, {
      ok: false,
      error: "Missing MARKETPLACE_CORE_ADDRESS (or NEXT_PUBLIC_MARKETPLACE_ADDRESS)",
    });
  }

  const provider = new ethers.JsonRpcProvider(RPC_HTTP_URL);
  const marketplace = normAddr(MARKETPLACE_ADDR);
  const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
  const market = new ethers.Contract(marketplace, MARKETPLACE_CORE_ABI as any, provider);

  const receipt = await provider.getTransactionReceipt(txHashFilled).catch(() => null);
  if (!receipt) return json(404, { ok: false, error: "Transaction receipt not found yet" });
  if (receipt.status !== 1) return json(409, { ok: false, error: "Buy transaction failed on-chain" });

  const wantContract = normAddr(row.nft.contract);
  const wantTokenId = String(row.nft.tokenId);

  const contractBody = body?.contract && ethers.isAddress(body.contract) ? normAddr(body.contract) : null;
  const tokenIdBody = body?.tokenId ? String(body.tokenId) : null;
  const chainIdBody =
    body?.chainId && /^[0-9]+$/.test(String(body.chainId).trim()) ? BigInt(String(body.chainId).trim()) : null;

  // Extra guard if caller passed them
  if (contractBody && !sameAddr(contractBody, wantContract)) {
    return json(422, { ok: false, error: "contract mismatch" });
  }
  if (tokenIdBody && tokenIdBody !== wantTokenId) {
    return json(422, { ok: false, error: "tokenId mismatch" });
  }

  // ----
  // Step A: try to detect a “fill” style event in the receipt logs (best-effort, ABI-name tolerant)
  // ----
  const likelyFillNames = new Set([
    "ListingFilled",
    "ListingPurchased",
    "ItemSold",
    "Sale",
    "Purchased",
    "Bought",
  ]);

  let sawFillForNft = false;
  let listingIdFromEvent: bigint | null = null;

  for (const lg of receipt.logs || []) {
    if (!lg?.address || !ethers.isAddress(lg.address)) continue;
    if (!sameAddr(lg.address, marketplace)) continue;

    try {
      const parsed = iface.parseLog({ topics: lg.topics as any, data: lg.data as any });
      if (!parsed) continue;

      if (!likelyFillNames.has(parsed.name)) continue;

      const args: any = parsed.args;

      const tokenAddrRaw = (args?.token ?? args?.collection ?? "")?.toString?.() ?? "";
      const tokenAddr = ethers.isAddress(tokenAddrRaw) ? normAddr(tokenAddrRaw) : "";
      const tokenIdRaw = args?.tokenId ?? null;
      const tokenId =
        typeof tokenIdRaw === "bigint"
          ? tokenIdRaw
          : tokenIdRaw != null
          ? BigInt(tokenIdRaw.toString())
          : null;

      if (!tokenAddr || !sameAddr(tokenAddr, wantContract)) continue;
      if (tokenId == null || tokenId.toString() !== wantTokenId) continue;

      const lIdRaw = args?.listingId ?? args?.id ?? null;
      if (lIdRaw != null) {
        listingIdFromEvent = typeof lIdRaw === "bigint" ? lIdRaw : BigInt(lIdRaw.toString());
      }

      sawFillForNft = true;
      break;
    } catch {
      // ignore unrelated logs
    }
  }

  // ----
  // Step B: strong truth check: if we have chainId, read listing state and ensure not active anymore.
  // If we don’t, we still allow update if we saw a fill event for the NFT.
  // ----
  const chainId = chainIdBody ?? listingIdFromEvent;

  if (chainId != null) {
    const L = await market.listings(chainId).catch(() => null);
    if (L) {
      const tokenAddr = String(L[1] ?? "");
      const tokenId = (L[2] as bigint) ?? BigInt(0);
      const active = Boolean(L[9]);

      // verify identity first
      if (ethers.isAddress(tokenAddr)) {
        const tokenAddrNorm = normAddr(tokenAddr);
        if (!sameAddr(tokenAddrNorm, wantContract) || tokenId.toString() !== wantTokenId) {
          return json(422, { ok: false, error: "On-chain listing does not match this NFT" });
        }
      }

      // if still active, it’s not sold (or not yet reflected)
      if (active) {
        // if we saw fill logs but listing still active, something is inconsistent; don’t mark SOLD.
        return json(409, {
          ok: false,
          error: "Listing still active on-chain; not marking SOLD yet",
        });
      }
    } else {
      // couldn’t read listing state; fall back to event evidence
      if (!sawFillForNft) {
        return json(422, { ok: false, error: "No fill evidence found for this NFT" });
      }
    }
  } else {
    // no chainId; require event evidence
    if (!sawFillForNft) {
      return json(422, { ok: false, error: "No fill evidence found for this NFT" });
    }
  }

  const updated = await prisma.marketplaceListing.update({
    where: { id: dbId },
    data: {
      status: ListingStatus.SOLD,
      txHashFilled,
    },
    select: { id: true, status: true, txHashFilled: true },
  });

  return json(200, { ok: true, updated });
}