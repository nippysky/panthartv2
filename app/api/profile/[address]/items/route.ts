// app/api/profile/[address]/items/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Returns NFTs the address *currently owns* (ERC-721 owner OR ERC-1155 balances).
 * - Supports search, pagination (cursor = base64’d offset), sorting (existing),
 *   and now optional **collection filtering** by contract or collectionId.
 * - Response shape is unchanged.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import {
  NftStatus,
  ListingStatus,
  AuctionStatus,
  CurrencyKind,
} from "@/lib/generated/prisma";

/* ----------------------------- helpers ----------------------------- */
function encodeOffsetCursor(n: number) {
  return Buffer.from(String(n), "utf8").toString("base64url");
}
function decodeOffsetCursor(c: string | null) {
  if (!c) return 0;
  try {
    const s = Buffer.from(c, "base64url").toString("utf8");
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}
function weiToEtn(wei?: any): number | undefined {
  if (wei == null) return undefined;
  const s = typeof wei === "string" ? wei : wei.toString?.() ?? String(wei);
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return n / 1e18;
}

/* ------------------------------- GET ------------------------------- */
/**
 * Items the address currently OWNS (721 owner or 1155 balances).
 * Adds listing/auction flags and resolves cheapest listing (ETN first, else ERC-20 by decimals).
 * Optional filters:
 *   - search=<text>
 *   - collection=<contract address>
 *   - collectionId=<internal id>
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> }
) {
  await prismaReady;
  const { address } = await ctx.params;

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 20, 50));
  const offset = decodeOffsetCursor(url.searchParams.get("cursor"));
  const search = (url.searchParams.get("search") || "").trim();
  const sort = (url.searchParams.get("sort") || "") as
    | ""
    | "lowToHigh"
    | "highToLow";

  // 🔹 NEW: optional collection filters
  const collection = (url.searchParams.get("collection") || "").trim(); // contract
  const collectionId = url.searchParams.get("collectionId");

  // 1155 generic holdings
  const holdings = await prisma.erc1155Holding.findMany({
    where: {
      ownerAddress: { equals: address, mode: "insensitive" },
      balance: { gt: 0 },
    },
    select: { contract: true, tokenId: true },
    orderBy: { updatedAt: "desc" },
    take: 2000,
  });
  const holdingPairs: Prisma.NFTWhereInput[] = holdings.map((h) => ({
    AND: [
      { contract: { equals: h.contract, mode: "insensitive" } },
      { tokenId: h.tokenId },
    ],
  }));

  // platform Single1155 balances
  const s1155 = await prisma.erc1155Balance.findMany({
    where: {
      ownerAddress: { equals: address, mode: "insensitive" },
      balance: { gt: 0 },
    },
    select: { single1155Id: true },
    take: 2000,
  });
  const single1155Ids = s1155.map((b) => b.single1155Id);

  // AND filters
  const andFilters: Prisma.NFTWhereInput[] = [{ status: NftStatus.SUCCESS }];

  if (search) {
    andFilters.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { tokenId: { contains: search } },
      ],
    });
  }

  // 🔹 Apply optional collection filters (non-breaking)
  if (collection) {
    andFilters.push({ contract: { equals: collection, mode: "insensitive" } });
  }
  if (collectionId) {
    andFilters.push({ collectionId });
  }

  const now = new Date();
  const listingGate: Prisma.MarketplaceListingWhereInput = {
    status: ListingStatus.ACTIVE,
    startTime: { lte: now },
    OR: [{ endTime: null }, { endTime: { gt: now } }],
  };
  const auctionGate: Prisma.AuctionWhereInput = {
    status: AuctionStatus.ACTIVE,
    startTime: { lte: now },
    endTime: { gt: now },
  };

  // Ownership scope: 721 owners OR 1155 holdings (both tables)
  const orScope: Prisma.NFTWhereInput[] = [
    { owner: { is: { walletAddress: { equals: address, mode: "insensitive" } } } },
    ...holdingPairs,
  ];
  if (single1155Ids.length) orScope.push({ single1155Id: { in: single1155Ids } });

  const rows = await prisma.nFT.findMany({
    where: { AND: andFilters, OR: orScope },
    select: {
      id: true,
      tokenId: true,
      name: true,
      imageUrl: true,
      description: true,
      traits: true,
      attributes: true,
      tokenUri: true,
      contract: true,
      standard: true,
      royaltyBps: true,
      royaltyRecipient: true,
      collectionId: true,
      createdAt: true,
      updatedAt: true,
      listingEntries: {
        where: listingGate,
        orderBy: [{ priceEtnWei: "asc" }, { priceTokenAmount: "asc" }],
        take: 50,
        select: {
          priceEtnWei: true,
          priceTokenAmount: true,
          currency: { select: { symbol: true, decimals: true, kind: true } },
        },
      },
      auctionEntries: {
        where: auctionGate,
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });

  // Shape the response (unchanged)
  const mapped = rows.map((n) => {
    const natives = n.listingEntries.filter(
      (le) =>
        (!le.currency || le.currency.kind === CurrencyKind.NATIVE) &&
        le.priceEtnWei != null
    );
    const tokens = n.listingEntries.filter(
      (le) =>
        le.currency &&
        le.currency.kind === CurrencyKind.ERC20 &&
        le.priceTokenAmount != null
    );

    let listingPrice: number | undefined;
    let listingCurrencySymbol: string | undefined;
    let listingPriceWei: string | undefined;

    if (natives.length) {
      const cheapest = natives[0]!;
      listingPrice = weiToEtn(cheapest.priceEtnWei as any);
      listingCurrencySymbol = "ETN";
      listingPriceWei =
        (cheapest.priceEtnWei as any)?.toString?.() ??
        String(cheapest.priceEtnWei);
    } else if (tokens.length) {
      const cheapest = tokens
        .slice()
        .sort((a, b) => Number(a.priceTokenAmount) - Number(b.priceTokenAmount))[0]!;
      const dec = Number(cheapest.currency?.decimals ?? 18);
      listingPrice = Number(cheapest.priceTokenAmount) / 10 ** dec;
      listingCurrencySymbol = cheapest.currency?.symbol || "ERC20";
      listingPriceWei =
        (cheapest.priceTokenAmount as any)?.toString?.() ??
        String(cheapest.priceTokenAmount);
    }

    const isListed = listingPrice != null;
    const isAuctioned = (n.auctionEntries?.length ?? 0) > 0;

    return {
      id: n.id,
      tokenId: n.tokenId,
      name: n.name,
      imageUrl: n.imageUrl,
      description: n.description ?? null,
      traits: (n.traits as any) ?? undefined,
      attributes: (n.attributes as any) ?? undefined,
      tokenUri: n.tokenUri ?? null,
      metadataHash: null,
      standard: n.standard ?? null,
      contract: n.contract,
      royaltyBps: n.royaltyBps ?? null,
      royaltyRecipient: n.royaltyRecipient ?? null,
      collectionId: n.collectionId ?? null,

      isListed,
      listingPrice,
      listingPriceWei,
      listingCurrencySymbol,

      isAuctioned,
      viewCount: 0,
      favoriteCount: 0,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
  });

  // Sorting (unchanged)
  if (sort === "lowToHigh" || sort === "highToLow") {
    const inf = Number.POSITIVE_INFINITY;
    mapped.sort((a, b) => {
      const pa = a.listingPrice ?? inf;
      const pb = b.listingPrice ?? inf;
      return sort === "lowToHigh" ? pa - pb : pb - pa;
    });
  } else {
    mapped.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  // Offset pagination (unchanged)
  const slice = mapped.slice(offset, offset + limit);
  const nextCursor =
    offset + limit < mapped.length ? encodeOffsetCursor(offset + limit) : null;

  return NextResponse.json(
    { items: slice, nextCursor },
    { headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=60" } }
  );
}
