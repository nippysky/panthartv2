/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import {
  AuctionStatus,
  ListingStatus,
  NftStatus,
  CurrencyKind,
  Prisma,
} from "@/src/lib/generated/prisma/client";

type HeaderDTO = {
  id?: string;
  name?: string | null;
  description?: string | null;
  contract: string;
  logoUrl?: string | null;
  coverUrl?: string | null;

  website?: string | null;
  instagram?: string | null;
  x?: string | null;
  discord?: string | null;
  telegram?: string | null;

  // ✅ needed for gating owner actions in UI
  ownerAddress?: string | null;

  floorPrice?: number | null; // ETN
  volume?: number | null; // ETN

  supply?: number | null;
  itemsCount?: number | null;
  ownersCount?: number | null;

  listingActiveCount?: number | null;
  auctionActiveCount?: number | null;

  rarityEnabled?: boolean | null;
  rarityPopulation?: number | null;
};

function ipfsToHttp(url?: string | null) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;
  if (u.startsWith("ipfs://")) {
    const cid = u.replace("ipfs://", "");
    return `https://ipfs.io/ipfs/${cid}`;
  }
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

function weiToEtn(wei: any): number {
  if (wei == null) return 0;
  const s = (wei as any).toString?.() ?? String(wei);
  return Number(s) / 1e18;
}

function safeStr(u?: any): string | null {
  if (u == null) return null;
  const s = String(u).trim();
  return s || null;
}

function normalizeUrl(u?: string | null): string | null {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

/** Native ETN floor + native ETN all-time volume. */
async function computeNativeStats(contract: string) {
  const now = new Date();

  const cheapest = await prisma.marketplaceListing.findFirst({
    where: {
      status: ListingStatus.ACTIVE,
      nft: { contract },
      startTime: { lte: now },
      AND: [
        { OR: [{ endTime: null }, { endTime: { gt: now } }] },
        { OR: [{ currencyId: null }, { currency: { kind: CurrencyKind.NATIVE } }] },
      ],
    },
    orderBy: { priceEtnWei: "asc" },
    select: { priceEtnWei: true },
  });

  const floorPrice = cheapest?.priceEtnWei ? weiToEtn(cheapest.priceEtnWei) : null;

  const rows = await prisma.$queryRaw<Array<{ sumWei: any }>>(Prisma.sql`
    SELECT COALESCE(SUM(s."priceEtnWei")::numeric, 0) AS "sumWei"
    FROM "MarketplaceSale" s
    JOIN "NFT" n ON n."id" = s."nftId"
    LEFT JOIN "Currency" c ON c."id" = s."currencyId"
    WHERE lower(n.contract) = lower(${contract})
      AND (s."currencyId" IS NULL OR c."kind" = 'NATIVE')
  `);

  const sumWei = toNumber(rows?.[0]?.sumWei ?? 0);
  const volume = sumWei > 0 ? sumWei / 1e18 : 0;

  return { floorPrice, volume };
}

async function computeRarityPopulation(contract: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ cnt: any }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS cnt
      FROM "NFTRarity" r
      WHERE lower(r.contract) = lower(${contract})
        AND r.rank IS NOT NULL
    `);
    const pop = Number(rows?.[0]?.cnt ?? 0);
    return { rarityPopulation: pop, rarityEnabled: pop > 0 };
  } catch {
    return { rarityPopulation: 0, rarityEnabled: false };
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ contract: string }> }
) {
  await prismaReady;
  const { contract: rawContract } = await context.params;

  const col = await prisma.collection.findFirst({
    where: { contract: { equals: rawContract, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      description: true,
      contract: true,
      logoUrl: true,
      coverUrl: true,
      website: true,
      instagram: true,
      x: true,
      discord: true,
      telegram: true,
      supply: true,
      ownersCount: true,
      itemsCount: true,
      ownerAddress: true, // ✅
    },
  });

  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canon = col.contract;
  const now = new Date();

  const itemsCount = await prisma.nFT.count({
    where: { contract: canon, status: NftStatus.SUCCESS },
  });

  const [listingActiveCount, auctionActiveCount] = await Promise.all([
    prisma.marketplaceListing.count({
      where: {
        status: ListingStatus.ACTIVE,
        nft: { contract: canon },
        startTime: { lte: now },
        OR: [{ endTime: null }, { endTime: { gt: now } }],
      },
    }),
    prisma.auction.count({
      where: {
        status: AuctionStatus.ACTIVE,
        nft: { contract: canon },
        startTime: { lte: now },
        endTime: { gt: now },
      },
    }),
  ]);

  const [{ floorPrice, volume }, rarity] = await Promise.all([
    computeNativeStats(canon),
    computeRarityPopulation(canon),
  ]);

  const header: HeaderDTO = {
    id: col.id,
    name: col.name ?? null,
    description: col.description ?? null,
    contract: canon,

    logoUrl: ipfsToHttp(col.logoUrl),
    coverUrl: ipfsToHttp(col.coverUrl),

    website: col.website ?? null,
    instagram: col.instagram ?? null,
    x: col.x ?? null,
    discord: col.discord ?? null,
    telegram: col.telegram ?? null,

    ownerAddress: col.ownerAddress ?? null,

    floorPrice,
    volume,

    supply: col.supply ?? null,
    itemsCount: itemsCount ?? col.itemsCount ?? null,
    ownersCount: col.ownersCount ?? 0,

    listingActiveCount,
    auctionActiveCount,

    rarityEnabled: rarity.rarityEnabled,
    rarityPopulation: rarity.rarityPopulation,
  };

  const resp = NextResponse.json(header, { status: 200 });
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ contract: string }> }
) {
  await prismaReady;
  const { contract: rawParam } = await context.params;

  try {
    const col = await prisma.collection.findFirst({
      where: { contract: { equals: rawParam, mode: "insensitive" } },
      select: { id: true, ownerAddress: true },
    });
    if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ownerHeader = req.headers.get("x-owner-wallet");
    if (!ownerHeader) {
      return NextResponse.json({ error: "Missing x-owner-wallet" }, { status: 401 });
    }
    if (String(col.ownerAddress || "").toLowerCase() !== ownerHeader.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const data: Prisma.CollectionUpdateInput = {};
    if ("description" in body) data.description = safeStr((body as any).description);
    if ("website" in body) data.website = normalizeUrl(safeStr((body as any).website));
    if ("x" in body) data.x = normalizeUrl(safeStr((body as any).x));
    if ("instagram" in body) data.instagram = normalizeUrl(safeStr((body as any).instagram));
    if ("telegram" in body) data.telegram = normalizeUrl(safeStr((body as any).telegram));
    if ("discord" in body) data.discord = normalizeUrl(safeStr((body as any).discord));
    if ("logoUrl" in body) data.logoUrl = safeStr((body as any).logoUrl);
    if ("coverUrl" in body) data.coverUrl = safeStr((body as any).coverUrl);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    await prisma.collection.update({ where: { id: col.id }, data });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[PATCH /api/collections/[contract]]", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
