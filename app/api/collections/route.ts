// src/app/api/collections/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { Prisma } from "@/src/lib/generated/prisma";

type SortKey = "volume_desc" | "floor_asc" | "newest";

type CursorPayload =
  | { sort: "volume_desc"; v: number; id: string }
  | { sort: "floor_asc"; v: number; id: string }
  | { sort: "newest"; v: string; id: string };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseSort(v: string | null): SortKey {
  if (v === "floor_asc" || v === "newest" || v === "volume_desc") return v;
  return "volume_desc";
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(raw: string | null): CursorPayload | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return JSON.parse(json) as CursorPayload;
  } catch {
    return null;
  }
}
export async function GET(req: NextRequest) {
  await prismaReady;

  const url = new URL(req.url);

  const q = (url.searchParams.get("q") || "").trim();
  const sort = parseSort(url.searchParams.get("sort"));
  const standard = (url.searchParams.get("standard") || "").trim(); // "ERC721" | "ERC1155" | ""
  const indexed = url.searchParams.get("indexed") === "1"; // completed only
  const limit = clamp(Number(url.searchParams.get("limit")) || 24, 8, 48);

  const cursor = decodeCursor(url.searchParams.get("cursor"));

  // Base where
  const where: Prisma.CollectionWhereInput = {
    ...(standard ? { standard } : {}),
    ...(indexed ? { indexStatus: "COMPLETED" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { symbol: { contains: q, mode: "insensitive" } },
            // contract is CITEXT → already case-insensitive in postgres
            { contract: { contains: q } },
          ],
        }
      : {}),
  };

  // Keyset pagination conditions per sort
  let keysetWhere: Prisma.CollectionWhereInput = {};
  let orderBy: Prisma.CollectionOrderByWithRelationInput[] = [];

  if (sort === "volume_desc") {
    orderBy = [{ volume: "desc" }, { id: "desc" }];

    if (cursor && cursor.sort === "volume_desc") {
      keysetWhere = {
        OR: [
          { volume: { lt: cursor.v } },
          { AND: [{ volume: cursor.v }, { id: { lt: cursor.id } }] },
        ],
      };
    }
  }

  if (sort === "floor_asc") {
    // floorPrice is a DB snapshot; we still compute ACTIVE floor separately for display
    orderBy = [{ floorPrice: "asc" }, { id: "asc" }];

    if (cursor && cursor.sort === "floor_asc") {
      keysetWhere = {
        OR: [
          { floorPrice: { gt: cursor.v } },
          { AND: [{ floorPrice: cursor.v }, { id: { gt: cursor.id } }] },
        ],
      };
    }
  }

  if (sort === "newest") {
    orderBy = [{ createdAt: "desc" }, { id: "desc" }];

    if (cursor && cursor.sort === "newest") {
      keysetWhere = {
        OR: [
          { createdAt: { lt: new Date(cursor.v) } },
          { AND: [{ createdAt: new Date(cursor.v) }, { id: { lt: cursor.id } }] },
        ],
      };
    }
  }

  const take = limit + 1;

  const collections = await prisma.collection.findMany({
    where: { AND: [where, keysetWhere] },
    orderBy,
    take,
    select: {
      id: true,
      name: true,
      symbol: true,
      contract: true,
      logoUrl: true,
      coverUrl: true,
      standard: true,
      indexStatus: true,
      floorPrice: true, // snapshot
      volume: true, // snapshot all-time
      itemsCount: true,
      ownersCount: true,
      change24h: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = collections.length > limit;
  const page = hasMore ? collections.slice(0, limit) : collections;

  // Compute ACTIVE floor per collection for this page (native ETN only)
  // MIN(active listing.priceEtnWei) grouped by collectionId
  const now = new Date();
  const ids = page.map((c) => c.id);

  const activeFloors = ids.length
    ? await prisma.$queryRaw<
        Array<{ collectionId: string; floorWei: string | null }>
      >(Prisma.sql`
        SELECT n."collectionId" AS "collectionId",
               MIN(l."priceEtnWei")::text AS "floorWei"
        FROM "MarketplaceListing" l
        JOIN "NFT" n ON n."id" = l."nftId"
        LEFT JOIN "Currency" c ON c."id" = l."currencyId"
        WHERE n."collectionId" IN (${Prisma.join(ids)})
          AND n."status" = 'SUCCESS'
          AND l."status" = 'ACTIVE'
          AND l."startTime" <= ${now}
          AND (l."endTime" IS NULL OR l."endTime" > ${now})
          AND (l."currencyId" IS NULL OR c."kind" = 'NATIVE')
        GROUP BY n."collectionId"
      `)
    : [];

  const floorMap = new Map<string, string>();
  for (const r of activeFloors) {
    if (r.floorWei) floorMap.set(r.collectionId, r.floorWei);
  }

  const shaped = page.map((c) => ({
    ...c,
    // Active floor in wei string (or null). UI formats it.
    activeFloorWei: floorMap.get(c.id) ?? null,
  }));

  const nextCursor = hasMore
    ? (() => {
        const last = shaped[shaped.length - 1]!;
        if (sort === "volume_desc") {
          return encodeCursor({ sort, v: last.volume ?? 0, id: last.id });
        }
        if (sort === "floor_asc") {
          return encodeCursor({ sort, v: last.floorPrice ?? 0, id: last.id });
        }
        return encodeCursor({
          sort,
          v: last.createdAt.toISOString(),
          id: last.id,
        });
      })()
    : null;

  const res = NextResponse.json(
    { items: shaped, nextCursor },
    { status: 200 }
  );

  // Small edge cache. Keeps the page snappy while still “fresh enough”.
  res.headers.set("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
  return res;
}
