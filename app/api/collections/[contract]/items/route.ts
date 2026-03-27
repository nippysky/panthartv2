/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/collections/[contract]/items/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma, { prismaReady } from "@/src/lib/db";
import {
  AuctionStatus,
  ListingStatus,
  NftStatus,
} from "@/src/lib/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { detectMediaType, isVideoType } from "@/src/lib/media";

function normalizeMaybeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapItem(n: {
  id: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  tokenUri: string | null;
  rawMetadata: any;
  createdAt: Date;
  listingEntries?: Array<{ id: string }>;
  auctionEntries?: Array<{ id: string }>;
}) {
  const rawM: any = n.rawMetadata ?? {};

  /**
   * DB/source-of-truth order:
   * 1. explicit DB imageUrl column
   * 2. DB rawMetadata.image
   * 3. DB rawMetadata.image_url
   *
   * Keep the raw DB value exactly as stored.
   * Do NOT gateway-convert here.
   */
  const rawImage =
    normalizeMaybeString(n.imageUrl) ??
    normalizeMaybeString(rawM?.image) ??
    normalizeMaybeString(rawM?.image_url) ??
    normalizeMaybeString(rawM?.imageUrl) ??
    null;

  /**
   * DB/source-of-truth animation fields from raw metadata.
   * Keep exactly as stored.
   */
  const rawAnimation =
    normalizeMaybeString(rawM?.animation_url) ??
    normalizeMaybeString(rawM?.animationUrl) ??
    normalizeMaybeString(rawM?.animation) ??
    null;

  const mimeType =
    normalizeMaybeString(rawM?.mimeType) ??
    normalizeMaybeString(rawM?.contentType) ??
    null;

  const mediaType = detectMediaType(rawAnimation ?? rawImage, mimeType);
  const hasVideo = isVideoType(mediaType);

  return {
    id: n.id,
    tokenId: n.tokenId,
    name: n.name ?? normalizeMaybeString(rawM?.name) ?? null,
    imageUrl: rawImage,
    animationUrl: rawAnimation,
    tokenUri: n.tokenUri ?? null,
    mediaType,
    hasVideo,
    isListed: (n.listingEntries?.length ?? 0) > 0,
    isAuctioned: (n.auctionEntries?.length ?? 0) > 0,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ contract: string }> }
) {
  await prismaReady;
  const { contract: rawContract } = await context.params;

  const url = new URL(req.url);

  const limit = Math.max(
    1,
    Math.min(60, parseInt(url.searchParams.get("limit") || "24", 10))
  );
  const cursor = url.searchParams.get("cursor") || null;

  const search = url.searchParams.get("search")?.trim() || "";
  const listed = url.searchParams.get("listed") === "true";
  const auctioned = url.searchParams.get("auctioned") === "true";

  const sort = (url.searchParams.get("sort") || "newest").toLowerCase();

  const col = await prisma.collection.findFirst({
    where: { contract: { equals: rawContract, mode: "insensitive" } },
    select: { contract: true },
  });

  if (!col) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const canon = col.contract;
  const now = new Date();

  const where: any = {
    contract: canon,
    status: NftStatus.SUCCESS,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { tokenId: { contains: search } },
    ];
  }

  if (listed || auctioned) {
    where.AND = where.AND ?? [];

    if (listed) {
      where.AND.push({
        listingEntries: {
          some: {
            status: ListingStatus.ACTIVE,
            startTime: { lte: now },
            OR: [{ endTime: null }, { endTime: { gt: now } }],
          },
        },
      });
    }

    if (auctioned) {
      where.AND.push({
        auctionEntries: {
          some: {
            status: AuctionStatus.ACTIVE,
            startTime: { lte: now },
            endTime: { gt: now },
          },
        },
      });
    }
  }

  if (sort === "rarity_asc" || sort === "rarity_desc") {
    const dir = sort === "rarity_desc" ? "DESC" : "ASC";

    let cursorRank: number | null = null;
    let cursorId: string | null = null;

    if (cursor) {
      try {
        const d = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
        cursorRank = typeof d?.rank === "number" ? d.rank : null;
        cursorId = typeof d?.id === "string" ? d.id : null;
      } catch {
        // ignore malformed cursor
      }
    }

    const rows = await prisma.$queryRawUnsafe<{ id: string; rank: number }[]>(
      `
      SELECT n.id, r.rank
      FROM "NFT" n
      JOIN "NFTRarity" r
        ON lower(r.contract) = lower(n.contract)
       AND r."tokenId" = n."tokenId"
      WHERE lower(n.contract) = lower($1)
        AND n.status = $2
        ${search ? `AND (n.name ILIKE $3 OR n."tokenId" ILIKE $4)` : ""}
        ${
          cursorRank != null && cursorId
            ? `AND (r.rank ${dir === "ASC" ? ">" : "<"} $${search ? 5 : 3}
                  OR (r.rank = $${search ? 5 : 3} AND n.id ${dir === "ASC" ? ">" : "<"} $${search ? 6 : 4}))`
            : ""
        }
      ORDER BY r.rank ${dir}, n.id ${dir}
      LIMIT $${search ? (cursorRank != null ? 7 : 5) : cursorRank != null ? 5 : 3}
      `,
      ...(search
        ? [
            canon,
            NftStatus.SUCCESS,
            `%${search}%`,
            `%${search}%`,
            ...(cursorRank != null && cursorId ? [cursorRank, cursorId] : []),
            limit,
          ]
        : [
            canon,
            NftStatus.SUCCESS,
            ...(cursorRank != null && cursorId ? [cursorRank, cursorId] : []),
            limit,
          ])
    );

    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const nfts = await prisma.nFT.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        tokenId: true,
        name: true,
        imageUrl: true,
        tokenUri: true,
        rawMetadata: true,
        createdAt: true,
        listingEntries: {
          where: {
            status: ListingStatus.ACTIVE,
            startTime: { lte: now },
            OR: [{ endTime: null }, { endTime: { gt: now } }],
          },
          take: 1,
          select: { id: true },
        },
        auctionEntries: {
          where: {
            status: AuctionStatus.ACTIVE,
            startTime: { lte: now },
            endTime: { gt: now },
          },
          take: 1,
          select: { id: true },
        },
      },
    });

    const map = new Map(nfts.map((n) => [n.id, n]));
    const items = ids
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((n) => mapItem(n!));

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last
        ? Buffer.from(
            JSON.stringify({ rank: last.rank, id: last.id }),
            "utf8"
          ).toString("base64")
        : null;

    return NextResponse.json(
      { items, nextCursor },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const orderBy =
    sort === "oldest"
      ? ({ createdAt: "asc" } as const)
      : ({ createdAt: "desc" } as const);

  const raw = await prisma.nFT.findMany({
    where,
    orderBy: [orderBy, { id: "asc" }],
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      tokenId: true,
      name: true,
      imageUrl: true,
      tokenUri: true,
      rawMetadata: true,
      createdAt: true,
      listingEntries: {
        where: {
          status: ListingStatus.ACTIVE,
          startTime: { lte: now },
          OR: [{ endTime: null }, { endTime: { gt: now } }],
        },
        take: 1,
        select: { id: true },
      },
      auctionEntries: {
        where: {
          status: AuctionStatus.ACTIVE,
          startTime: { lte: now },
          endTime: { gt: now },
        },
        take: 1,
        select: { id: true },
      },
    },
  });

  const items = raw.map(mapItem);
  const nextCursor = raw.length === limit ? raw[raw.length - 1].id : null;

  return NextResponse.json(
    { items, nextCursor },
    { headers: { "Cache-Control": "no-store" } }
  );
}