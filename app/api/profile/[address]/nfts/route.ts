export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { Prisma, AuctionStatus, ListingStatus, NftStatus } from "@/src/lib/generated/prisma/client";

export type ProfileNftItem = {
  id: string;
  contract: string;
  tokenId: string;
  name?: string | null;
  imageUrl?: string | null;

  isListed?: boolean;
  listPriceEtn?: number | null;

  isAuction?: boolean;
  auctionBidEtn?: number | null;
};

function safeAddr(a: string) {
  const s = String(a ?? "").trim();
  if (!s) return null;
  if (s.length > 120) return null;
  return s;
}

function ipfsToHttp(url?: string | null) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.replace("ipfs://", "")}`;
  return u;
}

function weiToEtn(wei: unknown): number {
  if (wei == null) return 0;
  // Prisma Decimal has toString()
  const s =
    typeof wei === "bigint"
      ? wei.toString()
      : typeof wei === "number"
      ? String(wei)
      : (wei as { toString?: () => string })?.toString?.() ?? String(wei);

  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return n / 1e18;
}

function clampLimit(v: string | null, d = 36, max = 60) {
  const n = Number(v ?? "");
  if (!Number.isFinite(n) || n <= 0) return d;
  return Math.min(Math.floor(n), max);
}

async function getErc1155NftIdsForOwner(params: {
  ownerAddress: string;
  search?: string;
  maxIds?: number;
}): Promise<string[]> {
  const { ownerAddress, search, maxIds = 5000 } = params;

  // Search applies to tokenId OR name (name is on NFT, so we filter inside the join)
  const like = search ? `%${search}%` : null;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT n."id"
    FROM "NFT" n
    JOIN "Erc1155Holding" h
      ON lower(n."contract") = lower(h."contract")
     AND n."tokenId" = h."tokenId"
    WHERE lower(h."ownerAddress") = lower(${ownerAddress})
      AND h."balance" > 0
      AND n."status" = ${NftStatus.SUCCESS}
      ${
        like
          ? Prisma.sql`AND (n."tokenId" ILIKE ${like} OR coalesce(n."name",'') ILIKE ${like})`
          : Prisma.empty
      }
    LIMIT ${maxIds}
  `);

  return rows.map((r) => r.id);
}

export async function GET(req: NextRequest, context: { params: Promise<{ address: string }> }) {
  await prismaReady;

  const { address: raw } = await context.params;
  const address = safeAddr(raw);
  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 36, 80);
  const cursor = sp.get("cursor");

  const search = (sp.get("search") ?? "").trim();
  const listed = sp.get("listed") === "1";
  const auctioned = sp.get("auctioned") === "1";
  const sort = (sp.get("sort") ?? "newest").toLowerCase() === "oldest" ? "oldest" : "newest";

  const now = new Date();

  // ✅ ERC1155 ownership comes from holdings table
  const erc1155Ids = await getErc1155NftIdsForOwner({
    ownerAddress: address,
    search: search || undefined,
    maxIds: 5000,
  });

  // ✅ unified ownership: (ERC721 owner relation) OR (ERC1155 holding)
  const ownershipOr: Prisma.NFTWhereInput[] = [
    { owner: { walletAddress: { equals: address, mode: "insensitive" } } },
  ];
  if (erc1155Ids.length) ownershipOr.push({ id: { in: erc1155Ids } });

  const where: Prisma.NFTWhereInput = {
    status: NftStatus.SUCCESS,
    OR: ownershipOr,
  };

  if (search) {
    where.AND = [
      ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
      {
        OR: [
          { tokenId: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      },
    ];
  }

  const activeListingWhere: Prisma.MarketplaceListingWhereInput = {
    status: ListingStatus.ACTIVE,
    startTime: { lte: now },
    OR: [{ endTime: null }, { endTime: { gt: now } }],
  };

  const activeAuctionWhere: Prisma.AuctionWhereInput = {
    status: AuctionStatus.ACTIVE,
    startTime: { lte: now },
    endTime: { gt: now },
  };

  if (listed) where.listingEntries = { some: activeListingWhere };
  if (auctioned) where.auctionEntries = { some: activeAuctionWhere };

  const rows = await prisma.nFT.findMany({
    where,
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy:
      sort === "newest"
        ? [{ createdAt: "desc" }, { id: "desc" }]
        : [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      contract: true,
      tokenId: true,
      name: true,
      imageUrl: true,
      listingEntries: {
        where: activeListingWhere,
        take: 1,
        orderBy: { priceEtnWei: "asc" },
        select: { priceEtnWei: true },
      },
      auctionEntries: {
        where: activeAuctionWhere,
        take: 1,
        orderBy: { endTime: "asc" },
        select: { highestBidEtnWei: true, startPriceEtnWei: true },
      },
    },
  });

  const items: ProfileNftItem[] = rows.map((r) => {
    const l = r.listingEntries?.[0];
    const a = r.auctionEntries?.[0];

    const isListed = !!l;
    const isAuction = !!a;

    const listPriceEtn = l?.priceEtnWei != null ? weiToEtn(l.priceEtnWei) : null;
    const bidWei = a?.highestBidEtnWei ?? a?.startPriceEtnWei ?? null;
    const auctionBidEtn = bidWei != null ? weiToEtn(bidWei) : null;

    return {
      id: r.id,
      contract: r.contract,
      tokenId: r.tokenId,
      name: r.name ?? null,
      imageUrl: ipfsToHttp(r.imageUrl),
      isListed,
      listPriceEtn: isListed ? listPriceEtn : null,
      isAuction,
      auctionBidEtn: isAuction ? auctionBidEtn : null,
    };
  });

  const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id ?? null : null;

  const resp = NextResponse.json({ items, nextCursor }, { status: 200 });
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}
