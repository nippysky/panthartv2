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

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  await prismaReady;

  const body = (await req.json().catch(() => null)) as
    | { dbId?: string; txHashCancelled?: string }
    | null;

  const dbId = (body?.dbId || "").trim();
  const txHashCancelledRaw = (body?.txHashCancelled || "").trim();

  if (!dbId) return json(400, { ok: false, error: "Missing dbId" });
  if (!txHashCancelledRaw || !ethers.isHexString(txHashCancelledRaw, 32)) {
    return json(400, { ok: false, error: "Invalid txHashCancelled" });
  }

  const txHashCancelled = txHashCancelledRaw.toLowerCase();

  // Load row + NFT identity
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

  // ✅ Idempotency: if already cancelled with same hash, return ok
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
    process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
    "";

  if (!MARKETPLACE_ADDR || !ethers.isAddress(MARKETPLACE_ADDR)) {
    return json(500, {
      ok: false,
      error: "Missing MARKETPLACE_CORE_ADDRESS (or NEXT_PUBLIC_MARKETPLACE_ADDRESS)",
    });
  }

  const provider = new ethers.JsonRpcProvider(RPC_HTTP_URL);
  const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
  const marketplace = normAddr(MARKETPLACE_ADDR);

  const receipt = await provider.getTransactionReceipt(txHashCancelled).catch(() => null);
  if (!receipt) return json(404, { ok: false, error: "Transaction receipt not found yet" });
  if (receipt.status !== 1) return json(409, { ok: false, error: "Cancel transaction failed on-chain" });

  const wantContract = normAddr(row.nft.contract);
  const wantTokenId = String(row.nft.tokenId);

  let found = false;

  for (const lg of receipt.logs || []) {
    if (!lg?.address || !ethers.isAddress(lg.address)) continue;
    if (!sameAddr(lg.address, marketplace)) continue;

    try {
      const parsed = iface.parseLog({ topics: lg.topics as any, data: lg.data as any });
      if (!parsed) continue;

      // Accept a few likely cancel event names to avoid ABI naming mismatch surprises
      const name = parsed.name;
      if (name !== "AuctionCancelled" && name !== "AuctionCanceled") continue;

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
    return json(422, {
      ok: false,
      error: "No AuctionCancelled event found for this NFT in tx receipt",
    });
  }

  const updated = await prisma.auction.update({
    where: { id: dbId },
    data: {
      status: AuctionStatus.CANCELLED,
      txHashCancelled,
    },
    select: { id: true, status: true, txHashCancelled: true },
  });

  return json(200, { ok: true, updated });
}
