/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/collections.ts
import prisma, { prismaReady } from "@/src/lib/db";
import { Prisma, CurrencyKind } from "@/src/lib/generated/prisma/client";

export type SortKey = "volume" | "floor" | "newest";

export type CollectionListItem = {
  id: string;
  name: string;
  symbol: string;
  contract: string;
  logoUrl: string | null;
  coverUrl: string | null;
  itemsCount: number;
  ownersCount: number;
  indexStatus: "PENDING" | "QUEUED" | "INDEXING" | "COMPLETED" | "ERROR";
  floorActive: number | null;     // currency-aware
  volumeAllTime: number;          // currency-aware
};

export type CollectionsPageResp = {
  items: CollectionListItem[];
  nextCursor: string | null;
};

function toNumber(x: any): number {
  if (x == null) return 0;
  try { return Number((x as any).toString()); } catch { return Number(x) || 0; }
}

async function resolveCurrencyMeta(currencyQ: string | null) {
  if (!currencyQ || currencyQ.trim().toLowerCase() === "native") {
    return { id: undefined as string | undefined, symbol: "ETN", decimals: 18, kind: "NATIVE" as const };
  }
  const cur = await prisma.currency.findFirst({
    where: { id: currencyQ, active: true },
    select: { id: true, symbol: true, decimals: true, kind: true },
  });
  if (!cur) throw new Error("Unknown currency");
  return {
    id: cur.id,
    symbol: cur.symbol,
    decimals: cur.decimals ?? 18,
    kind: cur.kind === CurrencyKind.ERC20 ? ("ERC20" as const) : ("NATIVE" as const),
  };
}

/** FLOOR per currency (omit when none; UI shows “—”). */
async function fetchMinFloorsCurrency(
  collectionIds: string[],
  currencyMeta: { id?: string; kind: "NATIVE" | "ERC20"; decimals: number }
) {
  if (collectionIds.length === 0) return new Map<string, number | null>();

  const now = new Date();

  const listings = await prisma.marketplaceListing.findMany({
    where: {
      status: "ACTIVE",
      startTime: { lte: now },
      AND: [
        { OR: [{ endTime: null }, { endTime: { gt: now } }] },
        ...(currencyMeta.kind === "NATIVE"
          ? [{ OR: [{ currencyId: null }, { currency: { kind: CurrencyKind.NATIVE } }] }]
          : [{ currencyId: currencyMeta.id! }]),
      ],
      nft: { collectionId: { in: collectionIds } },
    },
    select: {
      priceEtnWei: true,
      priceTokenAmount: true,
      currency: { select: { decimals: true } },
      nft: { select: { collectionId: true } },
    },
    orderBy: [{ priceEtnWei: "asc" }, { priceTokenAmount: "asc" }],
    take: 10000,
  });

  const map = new Map<string, number | null>();

  for (const rec of listings) {
    const cid = rec.nft.collectionId!;
    let human: number | null = null;

    if (currencyMeta.kind === "NATIVE") {
      const base = (rec.priceEtnWei as any)?.toString?.();
      if (!base) continue;
      human = Number(base) / 1e18;
    } else {
      const base = (rec.priceTokenAmount as any)?.toString?.();
      if (!base) continue;
      const dec = rec.currency?.decimals ?? currencyMeta.decimals;
      human = Number(base) / 10 ** dec;
    }

    const prev = map.get(cid);
    if (prev == null || (human != null && human < prev)) map.set(cid, human);
  }

  return map;
}

/** ALL-TIME volume per currency (fast aggregate). */
async function fetchAllTimeVolumesCurrency(
  collectionIds: string[],
  currencyMeta: { id?: string; kind: "NATIVE" | "ERC20"; decimals: number }
) {
  const map = new Map<string, number>();
  if (collectionIds.length === 0) return map;

  // NOTE: uses the same native rule as production floor:
  // native = currencyId NULL OR currency.kind = NATIVE
  if (currencyMeta.kind === "NATIVE") {
    const rows = await prisma.$queryRaw<Array<{ collectionId: string; sumWei: any }>>(Prisma.sql`
      SELECT n."collectionId" AS "collectionId",
             COALESCE(SUM(s."priceEtnWei")::numeric, 0) AS "sumWei"
      FROM "MarketplaceSale" s
      JOIN "NFT" n ON n."id" = s."nftId"
      LEFT JOIN "Currency" c ON c."id" = s."currencyId"
      WHERE n."collectionId" IN (${Prisma.join(collectionIds)})
        AND (s."currencyId" IS NULL OR c."kind" = 'NATIVE')
      GROUP BY n."collectionId"
    `);

    for (const r of rows) {
      const wei = toNumber(r.sumWei);
      map.set(r.collectionId, wei / 1e18);
    }
    return map;
  }

  // ERC20: sum token amount, divide by decimals
  const rows = await prisma.$queryRaw<Array<{ collectionId: string; sumToken: any }>>(Prisma.sql`
    SELECT n."collectionId" AS "collectionId",
           COALESCE(SUM(s."priceTokenAmount")::numeric, 0) AS "sumToken"
    FROM "MarketplaceSale" s
    JOIN "NFT" n ON n."id" = s."nftId"
    WHERE n."collectionId" IN (${Prisma.join(collectionIds)})
      AND s."currencyId" = ${currencyMeta.id!}
    GROUP BY n."collectionId"
  `);

  const scale = 10 ** (currencyMeta.decimals ?? 18);
  for (const r of rows) {
    const amt = toNumber(r.sumToken);
    map.set(r.collectionId, amt / scale);
  }
  return map;
}

export function normalizeCollectionsQuery(sp: Record<string, string | string[] | undefined>) {
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? undefined;

  const sort = (pick("sort") ?? "volume") as SortKey;
  const currency = (pick("currency") ?? "native").toString();
  const cursor = (pick("cursor") ?? null) as string | null;

  return {
    sort: sort === "floor" || sort === "newest" || sort === "volume" ? sort : "volume",
    currency,
    cursor,
  };
}

export async function getCollectionsPage(args: {
  sort: SortKey;
  currency: string;
  limit: number;
  cursor: string | null;
}): Promise<CollectionsPageResp> {
  await prismaReady;

  const limit = Math.min(Math.max(args.limit || 24, 6), 30);
  const currencyMeta = await resolveCurrencyMeta(args.currency);

  const orderBy =
    args.sort === "newest" ? [{ createdAt: "desc" as const }, { id: "asc" as const }]
    : args.sort === "floor" ? [{ floorPrice: "desc" as const }, { id: "asc" as const }]
    : [{ volume: "desc" as const }, { id: "asc" as const }];

  const raw = await prisma.collection.findMany({
    orderBy,
    select: {
      id: true,
      name: true,
      symbol: true,
      contract: true,
      logoUrl: true,
      coverUrl: true,
      itemsCount: true,
      ownersCount: true,
      indexStatus: true,
    },
    take: limit,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  });

  const nextCursor = raw.length === limit ? raw[raw.length - 1].id : null;

  const ids = raw.map((c) => c.id);

  const [floorMap, volumeMap] = await Promise.all([
    fetchMinFloorsCurrency(ids, currencyMeta),
    fetchAllTimeVolumesCurrency(ids, currencyMeta),
  ]);

  const items: CollectionListItem[] = raw.map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    contract: c.contract,
    logoUrl: c.logoUrl,
    coverUrl: c.coverUrl,
    itemsCount: c.itemsCount ?? 0,
    ownersCount: c.ownersCount ?? 0,
    indexStatus: (String(c.indexStatus || "PENDING").toUpperCase() as any),
    floorActive: (floorMap.get(c.id) ?? null) as number | null,
    volumeAllTime: volumeMap.get(c.id) ?? 0,
  }));

  return { items, nextCursor };
}
