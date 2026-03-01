/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";

type Row = {
  id: string;
  type: string;
  contract: string;
  tokenId: string;
  nftName?: string | null;
  imageUrl?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  price?: number | null;
  timestamp: string;
  txHash: string;
};

function safeAddr(a: string) {
  const s = String(a ?? "").trim();
  if (!s) return null;
  if (s.length > 120) return null;
  return s;
}

function clampLimit(v: string | null, d = 30, max = 60) {
  const n = Number(v ?? "");
  if (!Number.isFinite(n) || n <= 0) return d;
  return Math.min(Math.floor(n), max);
}

function ipfsToHttp(url?: string | null) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.replace("ipfs://", "")}`;
  return u;
}

function weiToEtn(wei: any): number {
  if (wei == null) return 0;
  const s = (wei as any).toString?.() ?? String(wei);
  return Number(s) / 1e18;
}

/**
 * Keep your UI tidy:
 * ListingPurchased => SALE
 * AuctionSettled => AUCTION_FINALIZE
 * Everything else => uppercase as-is
 */
function normalizeType(raw: string): string {
  const t = (raw || "").trim();
  const upper = t.toUpperCase();
  if (upper === "LISTINGPURCHASED" || upper === "LISTING_PURCHASED") return "SALE";
  if (upper === "AUCTIONSETTLED" || upper === "AUCTION_SETTLED") return "AUCTION_FINALIZE";
  return upper;
}

export async function GET(req: NextRequest, context: { params: Promise<{ address: string }> }) {
  await prismaReady;

  const { address: raw } = await context.params;
  const address = safeAddr(raw);
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 30, 80);
  const cursor = sp.get("cursor");
  const type = (sp.get("type") ?? "").trim();

  const where: any = {
    OR: [
      { fromAddress: { equals: address, mode: "insensitive" } },
      { toAddress: { equals: address, mode: "insensitive" } },
    ],
  };

  if (type) where.type = { equals: type, mode: "insensitive" };

  const rows = await prisma.nFTActivity.findMany({
    where,
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    select: {
      id: true,
      type: true,
      contract: true,
      tokenId: true,
      fromAddress: true,
      toAddress: true,
      priceEtnWei: true,
      txHash: true,
      timestamp: true,
      nft: { select: { name: true, imageUrl: true } },
    },
  });

  const items: Row[] = rows.map((r) => ({
    id: r.id,
    type: normalizeType(r.type ?? ""),
    contract: r.contract,
    tokenId: r.tokenId,
    nftName: r.nft?.name ?? null,
    imageUrl: ipfsToHttp(r.nft?.imageUrl ?? null),
    fromAddress: r.fromAddress ?? null,
    toAddress: r.toAddress ?? null,
    price: r.priceEtnWei != null ? weiToEtn(r.priceEtnWei) : null,
    timestamp: r.timestamp.toISOString(),
    txHash: r.txHash,
  }));

  const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id ?? null : null;

  const resp = NextResponse.json({ items, nextCursor }, { status: 200 });
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}
