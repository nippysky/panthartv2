/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/listing/cancel/confirm/route.ts
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
  return ethers.getAddress(a);
}

export async function POST(req: NextRequest) {
  await prismaReady;

  const body = (await req.json().catch(() => null)) as
    | {
        dbId?: string;
        txHashCancelled?: string;
        contract?: string;
        tokenId?: string;
        chainId?: string; // listingId on-chain
      }
    | null;

  const dbId = (body?.dbId || "").trim();
  const txHashRaw = (body?.txHashCancelled || "").trim();

  if (!dbId) return json(400, { ok: false, error: "Missing dbId" });
  if (!txHashRaw || !ethers.isHexString(txHashRaw, 32)) {
    return json(400, { ok: false, error: "Invalid txHashCancelled" });
  }

  const txHashCancelled = txHashRaw.toLowerCase();

  const row = await prisma.marketplaceListing.findUnique({
    where: { id: dbId },
    select: {
      id: true,
      status: true,
      txHashCancelled: true,
      nft: { select: { contract: true, tokenId: true } },
    },
  });

  if (!row?.id || !row.nft?.contract || !row.nft?.tokenId) {
    return json(404, { ok: false, error: "Listing not found" });
  }

  // Idempotent
  if (
    row.status === ListingStatus.CANCELLED &&
    (row.txHashCancelled || "").toLowerCase() === txHashCancelled
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
    process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS ||
    process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
    "";

  if (!MARKETPLACE_ADDR || !ethers.isAddress(MARKETPLACE_ADDR)) {
    return json(500, {
      ok: false,
      error:
        "Missing MARKETPLACE_CORE_ADDRESS (or NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS / NEXT_PUBLIC_MARKETPLACE_ADDRESS)",
    });
  }

  const provider = new ethers.JsonRpcProvider(RPC_HTTP_URL);
  const marketplace = normAddr(MARKETPLACE_ADDR);
  const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
  const market = new ethers.Contract(marketplace, MARKETPLACE_CORE_ABI as any, provider);

  const receipt = await provider.getTransactionReceipt(txHashCancelled).catch(() => null);
  if (!receipt) return json(404, { ok: false, error: "Transaction receipt not found yet" });
  if (receipt.status !== 1) return json(409, { ok: false, error: "Cancel failed on-chain" });

  const wantContract = normAddr(row.nft.contract);
  const wantTokenId = String(row.nft.tokenId);

  const contractBody =
    body?.contract && ethers.isAddress(body.contract) ? normAddr(body.contract) : null;
  const tokenIdBody = body?.tokenId ? String(body.tokenId) : null;
  const chainIdBody =
    body?.chainId && /^[0-9]+$/.test(String(body.chainId).trim())
      ? BigInt(String(body.chainId).trim())
      : null;

  if (contractBody && !sameAddr(contractBody, wantContract)) {
    return json(422, { ok: false, error: "contract mismatch" });
  }
  if (tokenIdBody && tokenIdBody !== wantTokenId) {
    return json(422, { ok: false, error: "tokenId mismatch" });
  }

  // Step A: parse ListingCancelled event for listingId (evidence)
  let sawCancelEvent = false;
  let listingIdFromEvent: bigint | null = null;

  for (const lg of receipt.logs || []) {
    if (!lg?.address || !ethers.isAddress(lg.address)) continue;
    if (!sameAddr(lg.address, marketplace)) continue;

    try {
      const parsed = iface.parseLog({ topics: lg.topics as any, data: lg.data as any });
      if (!parsed) continue;
      if (parsed.name !== "ListingCancelled") continue;

      const args: any = parsed.args;
      const lIdRaw = args?.listingId ?? null;
      if (lIdRaw != null) {
        listingIdFromEvent = typeof lIdRaw === "bigint" ? lIdRaw : BigInt(lIdRaw.toString());
      }

      sawCancelEvent = true;
      break;
    } catch {
      // ignore unrelated logs
    }
  }

  // Step B: strong truth check via listings(listingId).active === false
  const listingId = chainIdBody ?? listingIdFromEvent;
  if (listingId == null) {
    return json(422, { ok: false, error: "Missing chainId (listingId) and no event listingId found" });
  }

  const L = await market.listings(listingId).catch(() => null);
  if (!L) return json(502, { ok: false, error: "Failed to read on-chain listing state" });

  // tuple per ABI: seller, token, tokenId, ... active at index 9
  const tokenAddrRaw = String(L[1] ?? "");
  const tokenIdRaw = (L[2] as bigint) ?? BigInt(0);
  const active = Boolean(L[9]);

  if (ethers.isAddress(tokenAddrRaw)) {
    const tokenAddr = normAddr(tokenAddrRaw);
    if (!sameAddr(tokenAddr, wantContract) || tokenIdRaw.toString() !== wantTokenId) {
      return json(422, { ok: false, error: "On-chain listing does not match this NFT" });
    }
  }

  if (active) {
    return json(409, {
      ok: false,
      error: sawCancelEvent
        ? "Listing cancel event seen but chain still active"
        : "Listing still active on-chain; not marking CANCELLED yet",
    });
  }

  const updated = await prisma.marketplaceListing.update({
    where: { id: dbId },
    data: {
      status: ListingStatus.CANCELLED,
      txHashCancelled,
    },
    select: { id: true, status: true, txHashCancelled: true },
  });

  return json(200, { ok: true, updated });
}