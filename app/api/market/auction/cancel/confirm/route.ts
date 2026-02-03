/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/auction/cancel/confirm/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { AuctionStatus } from "@/src/lib/generated/prisma/client";
import { ethers } from "ethers";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

function sameAddr(a: string, b: string) {
  return (a || "").toLowerCase() === (b || "").toLowerCase();
}

function normAddr(a: string) {
  return ethers.getAddress(a);
}

export async function POST(req: NextRequest) {
  await prismaReady;

  const body = (await req.json().catch(() => null)) as
    | { dbId?: string; txHashCancelled?: string }
    | null;

  const dbId = (body?.dbId || "").trim();
  const txHashCancelled = (body?.txHashCancelled || "").trim();

  if (!dbId) {
    return NextResponse.json({ error: "Missing dbId" }, { status: 400 });
  }

  if (!txHashCancelled || !ethers.isHexString(txHashCancelled, 32)) {
    return NextResponse.json({ error: "Invalid txHashCancelled" }, { status: 400 });
  }

  // Load row + NFT identity
  const row = await prisma.auction.findUnique({
    where: { id: dbId },
    select: {
      id: true,
      status: true,
      nftId: true,
      nft: { select: { contract: true, tokenId: true } },
    },
  });

  if (!row?.id || !row.nft?.contract || !row.nft?.tokenId) {
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }

  // Verify receipt contains AuctionCancelled for this NFT
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
    return NextResponse.json(
      { error: "Missing MARKETPLACE_CORE_ADDRESS (or NEXT_PUBLIC_MARKETPLACE_ADDRESS)" },
      { status: 500 }
    );
  }

  const provider = new ethers.JsonRpcProvider(RPC_HTTP_URL);
  const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
  const marketplace = normAddr(MARKETPLACE_ADDR);

  const receipt = await provider.getTransactionReceipt(txHashCancelled).catch(() => null);
  if (!receipt) {
    return NextResponse.json(
      { error: "Transaction receipt not found yet" },
      { status: 404 }
    );
  }
  if (receipt.status !== 1) {
    return NextResponse.json(
      { error: "Cancel transaction failed on-chain" },
      { status: 409 }
    );
  }

  const wantContract = row.nft.contract;
  const wantTokenId = String(row.nft.tokenId);

  let found = false;

  for (const lg of receipt.logs || []) {
    if (!lg?.address || !ethers.isAddress(lg.address)) continue;
    if (!sameAddr(lg.address, marketplace)) continue;

    try {
      const parsed = iface.parseLog({ topics: lg.topics as any, data: lg.data as any });
      if (!parsed || parsed.name !== "AuctionCancelled") continue;

      const tokenAddr =
        (parsed.args?.token ?? parsed.args?.collection ?? "")?.toString?.() ?? "";
      const tokenAddrNorm = ethers.isAddress(tokenAddr) ? normAddr(tokenAddr) : "";

      const tIdRaw = parsed.args?.tokenId ?? null;
      const tokenIdOnchain =
        typeof tIdRaw === "bigint"
          ? tIdRaw
          : tIdRaw != null
          ? BigInt(tIdRaw.toString())
          : null;

      if (!tokenAddrNorm || !sameAddr(tokenAddrNorm, wantContract)) continue;
      if (tokenIdOnchain == null) continue;
      if (tokenIdOnchain.toString() !== wantTokenId) continue;

      found = true;
      break;
    } catch {
      // ignore unrelated logs
    }
  }

  if (!found) {
    return NextResponse.json(
      { error: "No AuctionCancelled event found for this NFT in tx receipt" },
      { status: 422 }
    );
  }

  const updated = await prisma.auction.update({
    where: { id: dbId },
    data: {
      status: AuctionStatus.CANCELLED,
      txHashCancelled: txHashCancelled.toLowerCase(),
    },
    select: { id: true, status: true },
  });

  return NextResponse.json({ ok: true, updated });
}
