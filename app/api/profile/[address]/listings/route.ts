// app/api/profile/[address]/listings/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { AuctionStatus, CurrencyKind, ListingStatus } from "@/lib/generated/prisma";

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
 * Active listings CREATED by the address (seller), regardless of current owner.
 * Returns per-listing rows with nested nft and price (ETN or ERC-20).
 * Supports search & sort; simple offset pagination.
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
    | "highToLow"
    | "endingSoon";

  const now = new Date();

  const listings = await prisma.marketplaceListing.findMany({
    where: {
      sellerAddress: { equals: address, mode: "insensitive" },
      status: ListingStatus.ACTIVE,
      startTime: { lte: now },
      OR: [{ endTime: null }, { endTime: { gt: now } }],
      nft: search
        ? {
            AND: [
              { status: "SUCCESS" as const },
              {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { tokenId: { contains: search } },
                ],
              },
            ],
          }
        : { status: "SUCCESS" as const },
    },
    select: {
      id: true,
      priceEtnWei: true,
      priceTokenAmount: true,
      startTime: true,
      endTime: true,
      currency: { select: { symbol: true, decimals: true, kind: true } },
      nft: {
        select: {
          id: true,
          tokenId: true,
          name: true,
          imageUrl: true,
          description: true,
          contract: true,
          standard: true,
          collectionId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy:
      sort === "endingSoon"
        ? [{ endTime: "asc" }]
        : [{ priceEtnWei: "asc" }, { priceTokenAmount: "asc" }],
    take: 1000,
  });

  // Determine if there's also an active auction by this seller for the same NFT (shouldn't happen for 721, but safe)
  const nftIds = Array.from(new Set(listings.map((l) => l.nft.id)));
  const auctions = await prisma.auction.findMany({
    where: {
      nftId: { in: nftIds },
      sellerAddress: { equals: address, mode: "insensitive" },
      status: AuctionStatus.ACTIVE,
      startTime: { lte: now },
      endTime: { gt: now },
    },
    select: { id: true, nftId: true },
  });
  const activeAuctionByNft = new Set(auctions.map((a) => a.nftId));

  const mapped = listings.map((row) => {
    let listingPrice: number | undefined;
    let listingPriceWei: string | undefined;
    let listingCurrencySymbol: string | null | undefined;

    if (!row.currency || row.currency.kind === CurrencyKind.NATIVE) {
      if (row.priceEtnWei != null) {
        listingPrice = weiToEtn(row.priceEtnWei as any);
        listingPriceWei = (row.priceEtnWei as any)?.toString?.() ?? String(row.priceEtnWei);
        listingCurrencySymbol = "ETN";
      }
    } else if (row.currency.kind === CurrencyKind.ERC20 && row.priceTokenAmount != null) {
      const dec = Number(row.currency.decimals ?? 18);
      listingPrice = Number(row.priceTokenAmount) / 10 ** dec;
      listingPriceWei = (row.priceTokenAmount as any)?.toString?.() ?? String(row.priceTokenAmount);
      listingCurrencySymbol = row.currency.symbol || "ERC20";
    }

    return {
      id: row.id,
      nft: {
        id: row.nft.id,
        tokenId: row.nft.tokenId,
        name: row.nft.name,
        imageUrl: row.nft.imageUrl,
        contract: row.nft.contract,
        description: row.nft.description,
        standard: row.nft.standard,
        collectionId: row.nft.collectionId,
        createdAt: row.nft.createdAt.toISOString(),
        updatedAt: row.nft.updatedAt.toISOString(),
      },
      isAuctioned: activeAuctionByNft.has(row.nft.id),
      startTime: row.startTime.toISOString(),
      endTime: row.endTime ? row.endTime.toISOString() : null,

      listingPrice,
      listingPriceWei,
      listingCurrencySymbol,
    };
  });

  // client sorting for low/high if both ETN+ERC20 are mixed
  if (sort === "lowToHigh" || sort === "highToLow") {
    const inf = Number.POSITIVE_INFINITY;
    mapped.sort((a, b) => {
      const pa = a.listingPrice ?? inf;
      const pb = b.listingPrice ?? inf;
      return sort === "lowToHigh" ? pa - pb : pb - pa;
    });
  } else if (sort === "") {
    mapped.sort(
      (a, b) =>
        (a.listingPrice ?? Number.POSITIVE_INFINITY) -
          (b.listingPrice ?? Number.POSITIVE_INFINITY) ||
        new Date(b.nft.updatedAt).getTime() - new Date(a.nft.updatedAt).getTime()
    );
  }

  const slice = mapped.slice(offset, offset + limit);
  const nextCursor = offset + limit < mapped.length ? encodeOffsetCursor(offset + limit) : null;

  return NextResponse.json(
    { listings: slice, nextCursor },
    { headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=60" } }
  );
}
