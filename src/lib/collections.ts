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
  floorActive: number | null; // currency-aware (ACTIVE listings)
  volumeAllTime: number; // currency-aware (all-time sales)
};

export type CollectionsPageResp = {
  items: CollectionListItem[];
  nextCursor: string | null;
};

type CurrencyMeta =
  | { kind: "NATIVE"; id?: undefined; symbol: string; decimals: number }
  | { kind: "ERC20"; id: string; symbol: string; decimals: number };

type CursorObj =
  | { id: string; v: number } // volume/floor sort value (coalesced)
  | { id: string; t: string }; // newest timestamp ISO

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeNumber(x: any): number | null {
  if (x == null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function encodeCursor(obj: CursorObj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function decodeCursor(raw: string | null): CursorObj | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64").toString("utf8");
    const d = JSON.parse(json);

    if (d && typeof d.id === "string" && typeof d.v === "number") {
      return { id: d.id, v: d.v };
    }
    if (d && typeof d.id === "string" && typeof d.t === "string") {
      return { id: d.id, t: d.t };
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveCurrencyMeta(currencyQ: string | null): Promise<CurrencyMeta> {
  if (!currencyQ || currencyQ.trim().toLowerCase() === "native") {
    return { kind: "NATIVE", symbol: "ETN", decimals: 18 };
  }

  const cur = await prisma.currency.findFirst({
    where: { id: currencyQ, active: true },
    select: { id: true, symbol: true, decimals: true, kind: true },
  });

  if (!cur) throw new Error("Unknown currency");

  const decimals = cur.decimals ?? 18;

  if (cur.kind === CurrencyKind.ERC20) {
    return { kind: "ERC20", id: cur.id, symbol: cur.symbol, decimals };
  }

  // If it's a "native" currency row, treat it like native rules.
  return { kind: "NATIVE", symbol: cur.symbol, decimals };
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

/**
 * Currency-aware collection paging:
 * - floor = MIN(active listing price) in chosen currency
 * - volume = SUM(all-time sales) in chosen currency
 * - sorting uses computed values (not stale collection columns)
 * - cursor is base64 JSON: {id, v} for floor/volume, {id, t} for newest
 */
export async function getCollectionsPage(args: {
  sort: SortKey;
  currency: string;
  limit: number;
  cursor: string | null;
}): Promise<CollectionsPageResp> {
  await prismaReady;

  const limit = clamp(args.limit || 24, 6, 30);
  const currencyMeta = await resolveCurrencyMeta(args.currency);
  const now = new Date();

  const cur = decodeCursor(args.cursor);

  // -------------------------
  // NEWEST (createdAt desc)
  // -------------------------
  if (args.sort === "newest") {
    const cursorTime =
      cur && "t" in cur ? new Date(cur.t) : null;
    const cursorId =
      cur && "t" in cur ? cur.id : null;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        symbol: string;
        contract: string;
        logoUrl: string | null;
        coverUrl: string | null;
        itemsCount: number | null;
        ownersCount: number | null;
        indexStatus: string | null;
        createdAt: Date;
        floorActive: number | null;
        volumeAllTime: number | null;
      }>
    >(Prisma.sql`
      WITH
      floor_cte AS (
        ${currencyMeta.kind === "NATIVE"
          ? Prisma.sql`
            SELECT n."collectionId" AS "collectionId",
                   (MIN(ml."priceEtnWei")::numeric / 1e18)::double precision AS "floorActive"
            FROM "MarketplaceListing" ml
            JOIN "NFT" n ON n."id" = ml."nftId"
            LEFT JOIN "Currency" ccur ON ccur."id" = ml."currencyId"
            WHERE ml."status" = 'ACTIVE'
              AND ml."startTime" <= ${now}
              AND (ml."endTime" IS NULL OR ml."endTime" > ${now})
              AND (ml."currencyId" IS NULL OR ccur."kind" = 'NATIVE')
            GROUP BY n."collectionId"
          `
          : Prisma.sql`
            SELECT n."collectionId" AS "collectionId",
                   (MIN(ml."priceTokenAmount")::numeric / power(10, ${currencyMeta.decimals}))::double precision AS "floorActive"
            FROM "MarketplaceListing" ml
            JOIN "NFT" n ON n."id" = ml."nftId"
            WHERE ml."status" = 'ACTIVE'
              AND ml."startTime" <= ${now}
              AND (ml."endTime" IS NULL OR ml."endTime" > ${now})
              AND ml."currencyId" = ${currencyMeta.id}
            GROUP BY n."collectionId"
          `}
      ),
      volume_cte AS (
        ${currencyMeta.kind === "NATIVE"
          ? Prisma.sql`
            SELECT n."collectionId" AS "collectionId",
                   (COALESCE(SUM(s."priceEtnWei")::numeric, 0) / 1e18)::double precision AS "volumeAllTime"
            FROM "MarketplaceSale" s
            JOIN "NFT" n ON n."id" = s."nftId"
            LEFT JOIN "Currency" ccur ON ccur."id" = s."currencyId"
            WHERE (s."currencyId" IS NULL OR ccur."kind" = 'NATIVE')
            GROUP BY n."collectionId"
          `
          : Prisma.sql`
            SELECT n."collectionId" AS "collectionId",
                   (COALESCE(SUM(s."priceTokenAmount")::numeric, 0) / power(10, ${currencyMeta.decimals}))::double precision AS "volumeAllTime"
            FROM "MarketplaceSale" s
            JOIN "NFT" n ON n."id" = s."nftId"
            WHERE s."currencyId" = ${currencyMeta.id}
            GROUP BY n."collectionId"
          `}
      )
      SELECT
        c."id",
        c."name",
        c."symbol",
        c."contract",
        c."logoUrl",
        c."coverUrl",
        c."itemsCount",
        c."ownersCount",
        c."indexStatus",
        c."createdAt",
        f."floorActive" AS "floorActive",
        v."volumeAllTime" AS "volumeAllTime"
      FROM "Collection" c
      LEFT JOIN floor_cte f ON f."collectionId" = c."id"
      LEFT JOIN volume_cte v ON v."collectionId" = c."id"
      WHERE
        ${
          cursorTime && cursorId
            ? Prisma.sql`(c."createdAt" < ${cursorTime} OR (c."createdAt" = ${cursorTime} AND c."id" > ${cursorId}))`
            : Prisma.sql`TRUE`
        }
      ORDER BY c."createdAt" DESC, c."id" ASC
      LIMIT ${limit}
    `);

    const items: CollectionListItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      symbol: r.symbol,
      contract: r.contract,
      logoUrl: r.logoUrl,
      coverUrl: r.coverUrl,
      itemsCount: r.itemsCount ?? 0,
      ownersCount: r.ownersCount ?? 0,
      indexStatus: (String(r.indexStatus || "PENDING").toUpperCase() as any),
      floorActive: safeNumber(r.floorActive),
      volumeAllTime: safeNumber(r.volumeAllTime) ?? 0,
    }));

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last
        ? encodeCursor({ id: last.id, t: last.createdAt.toISOString() })
        : null;

    return { items, nextCursor };
  }

  // -------------------------
  // FLOOR / VOLUME (computed)
  // -------------------------
  const isFloor = args.sort === "floor";

  // sorting keys:
  // - floor: null should go LAST -> coalesce to -1 (assuming prices are never negative)
  // - volume: null treated as 0
  const cursorVal =
    cur && "v" in cur ? cur.v : null;
  const cursorId =
    cur && "v" in cur ? cur.id : null;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      symbol: string;
      contract: string;
      logoUrl: string | null;
      coverUrl: string | null;
      itemsCount: number | null;
      ownersCount: number | null;
      indexStatus: string | null;
      floorActive: number | null;
      volumeAllTime: number | null;
    }>
  >(Prisma.sql`
    WITH
    floor_cte AS (
      ${currencyMeta.kind === "NATIVE"
        ? Prisma.sql`
          SELECT n."collectionId" AS "collectionId",
                 (MIN(ml."priceEtnWei")::numeric / 1e18)::double precision AS "floorActive"
          FROM "MarketplaceListing" ml
          JOIN "NFT" n ON n."id" = ml."nftId"
          LEFT JOIN "Currency" ccur ON ccur."id" = ml."currencyId"
          WHERE ml."status" = 'ACTIVE'
            AND ml."startTime" <= ${now}
            AND (ml."endTime" IS NULL OR ml."endTime" > ${now})
            AND (ml."currencyId" IS NULL OR ccur."kind" = 'NATIVE')
          GROUP BY n."collectionId"
        `
        : Prisma.sql`
          SELECT n."collectionId" AS "collectionId",
                 (MIN(ml."priceTokenAmount")::numeric / power(10, ${currencyMeta.decimals}))::double precision AS "floorActive"
          FROM "MarketplaceListing" ml
          JOIN "NFT" n ON n."id" = ml."nftId"
          WHERE ml."status" = 'ACTIVE'
            AND ml."startTime" <= ${now}
            AND (ml."endTime" IS NULL OR ml."endTime" > ${now})
            AND ml."currencyId" = ${currencyMeta.id}
          GROUP BY n."collectionId"
        `}
    ),
    volume_cte AS (
      ${currencyMeta.kind === "NATIVE"
        ? Prisma.sql`
          SELECT n."collectionId" AS "collectionId",
                 (COALESCE(SUM(s."priceEtnWei")::numeric, 0) / 1e18)::double precision AS "volumeAllTime"
          FROM "MarketplaceSale" s
          JOIN "NFT" n ON n."id" = s."nftId"
          LEFT JOIN "Currency" ccur ON ccur."id" = s."currencyId"
          WHERE (s."currencyId" IS NULL OR ccur."kind" = 'NATIVE')
          GROUP BY n."collectionId"
        `
        : Prisma.sql`
          SELECT n."collectionId" AS "collectionId",
                 (COALESCE(SUM(s."priceTokenAmount")::numeric, 0) / power(10, ${currencyMeta.decimals}))::double precision AS "volumeAllTime"
          FROM "MarketplaceSale" s
          JOIN "NFT" n ON n."id" = s."nftId"
          WHERE s."currencyId" = ${currencyMeta.id}
          GROUP BY n."collectionId"
        `}
    )
    SELECT
      c."id",
      c."name",
      c."symbol",
      c."contract",
      c."logoUrl",
      c."coverUrl",
      c."itemsCount",
      c."ownersCount",
      c."indexStatus",
      f."floorActive" AS "floorActive",
      v."volumeAllTime" AS "volumeAllTime"
    FROM "Collection" c
    LEFT JOIN floor_cte f ON f."collectionId" = c."id"
    LEFT JOIN volume_cte v ON v."collectionId" = c."id"
    WHERE
      ${
        cursorVal != null && cursorId
          ? isFloor
            ? Prisma.sql`
              (
                COALESCE(f."floorActive", -1) < ${cursorVal}
                OR (COALESCE(f."floorActive", -1) = ${cursorVal} AND c."id" > ${cursorId})
              )
            `
            : Prisma.sql`
              (
                COALESCE(v."volumeAllTime", 0) < ${cursorVal}
                OR (COALESCE(v."volumeAllTime", 0) = ${cursorVal} AND c."id" > ${cursorId})
              )
            `
          : Prisma.sql`TRUE`
      }
    ORDER BY
      ${
        isFloor
          ? Prisma.sql`COALESCE(f."floorActive", -1) DESC, c."id" ASC`
          : Prisma.sql`COALESCE(v."volumeAllTime", 0) DESC, c."id" ASC`
      }
    LIMIT ${limit}
  `);

  const items: CollectionListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    symbol: r.symbol,
    contract: r.contract,
    logoUrl: r.logoUrl,
    coverUrl: r.coverUrl,
    itemsCount: r.itemsCount ?? 0,
    ownersCount: r.ownersCount ?? 0,
    indexStatus: (String(r.indexStatus || "PENDING").toUpperCase() as any),
    floorActive: safeNumber(r.floorActive),
    volumeAllTime: safeNumber(r.volumeAllTime) ?? 0,
  }));

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last
      ? encodeCursor({
          id: last.id,
          v: isFloor
            ? (safeNumber(last.floorActive) ?? -1)
            : (safeNumber(last.volumeAllTime) ?? 0),
        })
      : null;

  return { items, nextCursor };
}
