/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/auction/cancel/confirm/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import prisma, { prismaReady } from "@/src/lib/db";
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

export async function POST(req: NextRequest) {
  await prismaReady;

  const body = (await req.json().catch(() => null)) as
    | {
        dbId?: string;
        txHashCancelled?: string | null;
      }
    | null;

  const dbId = (body?.dbId || "").trim();
  const txHashRaw = (body?.txHashCancelled || "").trim();

  if (!dbId) return json(400, { ok: false, error: "Missing dbId" });
  if (!txHashRaw || !ethers.isHexString(txHashRaw, 32)) {
    return json(400, { ok: false, error: "Invalid txHashCancelled" });
  }

  const txHashCancelled = txHashRaw.toLowerCase();

  const row = await prisma.auction.findUnique({
    where: { id: dbId },
    select: {
      id: true,
      status: true,
      txHashCancelled: true,
      nftId: true,
      nft: { select: { contract: true, tokenId: true } },
    },
  });

  if (!row?.id || !row.nft?.contract || !row.nft?.tokenId) {
    return json(404, { ok: false, error: "Auction not found" });
  }

  // Idempotent
  if (
    row.status === AuctionStatus.CANCELLED &&
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
  const marketplaceAddr = normAddr(MARKETPLACE_ADDR);
  const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
  const mkt = new ethers.Contract(marketplaceAddr, MARKETPLACE_CORE_ABI as any, provider);

  const receipt = await provider.getTransactionReceipt(txHashCancelled).catch(() => null);
  if (!receipt) return json(404, { ok: false, error: "Transaction receipt not found yet" });
  if (receipt.status !== 1) return json(409, { ok: false, error: "Cancel tx failed on-chain" });

  const wantContract = normAddr(row.nft.contract);
  const wantTokenId = String(row.nft.tokenId);

  // Find AuctionCancelled(auctionId)
  let auctionId: bigint | null = null;

  for (const lg of receipt.logs || []) {
    if (!lg?.address || !ethers.isAddress(lg.address)) continue;
    if (!sameAddr(lg.address, marketplaceAddr)) continue;

    try {
      const parsed = iface.parseLog({ topics: lg.topics as any, data: lg.data as any });
      if (!parsed || parsed.name !== "AuctionCancelled") continue;

      const idRaw = parsed.args?.auctionId ?? parsed.args?.id ?? null;
      if (idRaw == null) continue;

      auctionId = typeof idRaw === "bigint" ? idRaw : BigInt(idRaw.toString());
      break;
    } catch {
      // ignore
    }
  }

  if (auctionId == null) {
    return json(422, { ok: false, error: "No AuctionCancelled event found in receipt" });
  }

  // Verify this auctionId belongs to this NFT
  const A = await mkt.auctions(auctionId).catch(() => null);
  if (!A) return json(409, { ok: false, error: "Could not read auction state" });

  const tokenRaw = String(A?.[1] ?? "");
  const tokenIdRaw = (A?.[2] as bigint) ?? BigInt(0);

  if (!ethers.isAddress(tokenRaw)) {
    return json(409, { ok: false, error: "Auction token address invalid" });
  }

  const token = normAddr(tokenRaw);
  if (!sameAddr(token, wantContract) || tokenIdRaw.toString() !== wantTokenId) {
    return json(422, { ok: false, error: "AuctionCancelled does not match this NFT" });
  }

  const updated = await prisma.auction.update({
    where: { id: dbId },
    data: {
      status: AuctionStatus.CANCELLED,
      txHashCancelled,
    },
    select: { id: true, status: true, txHashCancelled: true },
  });

  return json(200, { ok: true, updated, auctionId: auctionId.toString() });
}