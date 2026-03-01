/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { CurrencyKind, Prisma, ListingStatus } from "@/src/lib/generated/prisma/client";

export type ProfileCollectionItem = {
  id: string;
  contract: string;
  name: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  itemsCount?: number | null;
  ownersCount?: number | null;
  floorPrice?: number | null;
  volume?: number | null;
};

function safeAddr(a: string) {
  const s = String(a ?? "").trim();
  if (!s) return null;
  if (s.length > 120) return null;
  return s;
}

function clampLimit(v: string | null, d = 24, max = 40) {
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

function toNumber(x: any): number {
  if (x == null) return 0;
  try {
    return Number((x as any).toString());
  } catch {
    return Number(x) || 0;
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ address: string }> }) {
  await prismaReady;

  const { address: raw } = await context.params;
  const address = safeAddr(raw);
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 24, 50);
  const cursor = sp.get("cursor");
  const search = (sp.get("search") ?? "").trim();

  const where: any = {
    creator: { walletAddress: { equals: address, mode: "insensitive" } },
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { contract: { contains: search, mode: "insensitive" } },
    ];
  }

  const cols = await prisma.collection.findMany({
    where,
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      contract: true,
      name: true,
      logoUrl: true,
      coverUrl: true,
      itemsCount: true,
      ownersCount: true,
    },
  });

  const contracts = cols.map((c) => String(c.contract));
  const now = new Date();

  // Compute native floor per contract (active listings only)
  const floorRows = contracts.length
    ? await prisma.$queryRaw<Array<{ contract: string; minWei: any }>>(Prisma.sql`
        SELECT lower(n.contract) AS contract,
               MIN(l."priceEtnWei")::numeric AS "minWei"
        FROM "MarketplaceListing" l
        JOIN "NFT" n ON n."id" = l."nftId"
        LEFT JOIN "Currency" c ON c."id" = l."currencyId"
        WHERE l."status" = ${ListingStatus.ACTIVE}
          AND l."startTime" <= ${now}
          AND (l."endTime" IS NULL OR l."endTime" > ${now})
          AND (l."currencyId" IS NULL OR c."kind" = ${CurrencyKind.NATIVE})
          AND lower(n.contract) IN (${Prisma.join(contracts.map((x) => x.toLowerCase()))})
        GROUP BY lower(n.contract)
      `)
    : [];

  // Compute all-time native volume per contract
  const volRows = contracts.length
    ? await prisma.$queryRaw<Array<{ contract: string; sumWei: any }>>(Prisma.sql`
        SELECT lower(n.contract) AS contract,
               COALESCE(SUM(s."priceEtnWei")::numeric, 0) AS "sumWei"
        FROM "MarketplaceSale" s
        JOIN "NFT" n ON n."id" = s."nftId"
        LEFT JOIN "Currency" c ON c."id" = s."currencyId"
        WHERE (s."currencyId" IS NULL OR c."kind" = ${CurrencyKind.NATIVE})
          AND lower(n.contract) IN (${Prisma.join(contracts.map((x) => x.toLowerCase()))})
        GROUP BY lower(n.contract)
      `)
    : [];

  const floorMap = new Map<string, number>();
  for (const r of floorRows) floorMap.set(String(r.contract), toNumber(r.minWei) / 1e18);

  const volMap = new Map<string, number>();
  for (const r of volRows) volMap.set(String(r.contract), toNumber(r.sumWei) / 1e18);

  const items: ProfileCollectionItem[] = cols.map((c) => {
    const key = String(c.contract).toLowerCase();
    return {
      id: c.id,
      contract: c.contract,
      name: c.name,
      logoUrl: ipfsToHttp(c.logoUrl),
      coverUrl: ipfsToHttp(c.coverUrl),
      itemsCount: c.itemsCount ?? 0,
      ownersCount: c.ownersCount ?? 0,
      floorPrice: floorMap.has(key) ? floorMap.get(key)! : null,
      volume: volMap.has(key) ? volMap.get(key)! : null,
    };
  });

  const nextCursor = cols.length === limit ? cols[cols.length - 1]?.id ?? null : null;

  const resp = NextResponse.json({ items, nextCursor }, { status: 200 });
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}
