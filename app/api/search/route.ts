// app/api/search/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import Fuse from "fuse.js";

/** Group keys returned to the client (keep these plural to match the response shape) */
type GroupKey = "users" | "collections" | "nfts";

/** The item shape consumed by your popover */
type SearchItem = {
  id: string;
  label: string;
  image: string;
  href: string;
  type: GroupKey;
  subtitle?: string;
};

/* --------------------------------- helpers -------------------------------- */

const PLACEHOLDER =
  "https://res.cloudinary.com/dx1bqxtys/image/upload/v1750638432/panthart/amy5m5u7nxmhlh8brv6d.png";

const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, " ");
}

function isEthAddress(q: string) {
  return ETH_ADDR_RE.test(q);
}

function parseContractTokenId(
  q: string
): { contract: string; tokenId: string } | null {
  const m = q
    .trim()
    .match(/(0x[a-fA-F0-9]{40})\s*(?:[#/:\s])\s*([0-9]+)$/);
  if (!m) return null;
  return { contract: m[1], tokenId: m[2] };
}

function dedupeByHref(items: SearchItem[]): SearchItem[] {
  const seen = new Set<string>();
  const out: SearchItem[] = [];
  for (const it of items) {
    if (seen.has(it.href)) continue;
    seen.add(it.href);
    out.push(it);
  }
  return out;
}

/* ---------------------------------- route --------------------------------- */

export async function GET(req: Request) {
  await prismaReady;

  const { searchParams } = new URL(req.url);
  const qRaw = normalizeQuery(searchParams.get("q") || "");

  // Empty → return empty groups
  if (!qRaw) {
    return NextResponse.json({
      users: [] as SearchItem[],
      collections: [] as SearchItem[],
      nfts: [] as SearchItem[],
      recent: [] as SearchItem[],
    });
  }

  const isAddress = isEthAddress(qRaw);
  const parsedPair = parseContractTokenId(qRaw);
  const maybeTokenId = /^\d+$/.test(qRaw) ? qRaw : null;

  /**
   * ✅ Early exit for very short text queries.
   * We still allow:
   * - full address
   * - pure number tokenId
   * - contract+tokenId
   */
  if (!isAddress && !maybeTokenId && !parsedPair && qRaw.length < 2) {
    return NextResponse.json({
      users: [] as SearchItem[],
      collections: [] as SearchItem[],
      nfts: [] as SearchItem[],
      recent: [] as SearchItem[],
    });
  }

  /**
   * ✅ Fast exact matches (more relevant + fewer rows)
   * - exact wallet address user
   * - exact contract collection
   * - exact contract+tokenId NFT
   */
  const [exactUser, exactCollection, exactNft] = await Promise.all([
    isAddress
      ? prisma.user.findFirst({
          where: { walletAddress: { equals: qRaw, mode: "insensitive" } },
          select: {
            id: true,
            username: true,
            walletAddress: true,
            profileAvatar: true,
          },
        })
      : Promise.resolve(null),

    isAddress
      ? prisma.collection.findFirst({
          where: { contract: { equals: qRaw, mode: "insensitive" } },
          select: {
            id: true,
            name: true,
            symbol: true,
            logoUrl: true,
            contract: true,
          },
        })
      : Promise.resolve(null),

    parsedPair
      ? prisma.nFT.findUnique({
          where: {
            contract_tokenId: {
              contract: parsedPair.contract,
              tokenId: parsedPair.tokenId,
            },
          },
          select: {
            id: true,
            name: true,
            imageUrl: true,
            tokenId: true,
            contract: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const directItems: SearchItem[] = [];

  if (exactUser) {
    directItems.push({
      id: exactUser.id,
      label:
        exactUser.username && exactUser.username.trim().length
          ? exactUser.username
          : `${exactUser.walletAddress.slice(0, 6)}...${exactUser.walletAddress.slice(-4)}`,
      image: exactUser.profileAvatar || PLACEHOLDER,
      href: `/profile/${exactUser.walletAddress}`,
      type: "users",
      subtitle: exactUser.walletAddress,
    });
  }

  if (exactCollection) {
    directItems.push({
      id: exactCollection.id,
      label: exactCollection.name || exactCollection.symbol || exactCollection.contract,
      image: exactCollection.logoUrl ?? PLACEHOLDER,
      href: `/collections/${exactCollection.contract}`,
      type: "collections",
      subtitle: exactCollection.symbol
        ? `${exactCollection.symbol} • ${exactCollection.contract}`
        : exactCollection.contract,
    });
  }

  if (exactNft) {
    directItems.push({
      id: exactNft.id,
      label: exactNft.name ?? `#${exactNft.tokenId}`,
      image: exactNft.imageUrl ?? PLACEHOLDER,
      href: `/collections/${exactNft.contract}/${exactNft.tokenId}`,
      type: "nfts",
      subtitle: `${exactNft.contract} • #${exactNft.tokenId}`,
    });
  }

  /**
   * ✅ Main searches (smaller takes, because we cap to 5 per group anyway)
   * For address queries we still allow "contains" (but exact match already handled).
   */
  const TAKE = 20;

  const [users, collections, nfts] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: qRaw, mode: "insensitive" } },
          { walletAddress: { contains: qRaw, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        walletAddress: true,
        profileAvatar: true,
      },
      take: TAKE,
    }),

    prisma.collection.findMany({
      where: {
        OR: [
          { name: { contains: qRaw, mode: "insensitive" } },
          { symbol: { contains: qRaw, mode: "insensitive" } },
          { contract: { contains: qRaw, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        logoUrl: true,
        contract: true,
      },
      take: TAKE,
    }),

    prisma.nFT.findMany({
      where: {
        status: "SUCCESS",
        OR: [
          { name: { contains: qRaw, mode: "insensitive" } },
          ...(maybeTokenId ? [{ tokenId: { equals: maybeTokenId } }] : []),
          { contract: { contains: qRaw, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        tokenId: true,
        contract: true,
        updatedAt: true, // helps natural ordering
      },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
    }),
  ]);

  // Map DB rows → SearchItem
  const userItems: SearchItem[] = users.map((u) => ({
    id: u.id,
    label:
      u.username && u.username.trim().length
        ? u.username
        : `${u.walletAddress.slice(0, 6)}...${u.walletAddress.slice(-4)}`,
    image: u.profileAvatar || PLACEHOLDER,
    href: `/profile/${u.walletAddress}`,
    type: "users",
    subtitle: u.walletAddress,
  }));

  const collectionItems: SearchItem[] = collections.map((c) => ({
    id: c.id,
    label: c.name || c.symbol || c.contract,
    image: c.logoUrl ?? PLACEHOLDER,
    href: `/collections/${c.contract}`,
    type: "collections",
    subtitle: c.symbol ? `${c.symbol} • ${c.contract}` : c.contract,
  }));

  const nftItems: SearchItem[] = nfts.map((n) => ({
    id: n.id,
    label: n.name ?? `#${n.tokenId}`,
    image: n.imageUrl ?? PLACEHOLDER,
    href: `/collections/${n.contract}/${n.tokenId}`,
    type: "nfts",
    subtitle: `${n.contract} • #${n.tokenId}`,
  }));

  // Combine (direct first) + dedupe
  const combined = dedupeByHref([
    ...directItems,
    ...userItems,
    ...collectionItems,
    ...nftItems,
  ]);

  // If the pool is already tiny, skip heavy fuzzy work
  const MAX_POOL_FOR_FUSE = 60;
  const pool = combined.slice(0, MAX_POOL_FOR_FUSE);

  // Fuzzy-rank by label + subtitle
  const fuse = new Fuse(pool, {
    keys: ["label", "subtitle"],
    threshold: 0.35,
    ignoreLocation: true,
  });

  const ranked = fuse.search(qRaw).map((r) => r.item);

  // Boost exact address hits (very important)
  const boosted = ranked.sort((a, b) => {
    const qLower = qRaw.toLowerCase();
    const aExact =
      isAddress &&
      (a.subtitle?.toLowerCase() === qLower ||
        a.label.toLowerCase() === qLower);
    const bExact =
      isAddress &&
      (b.subtitle?.toLowerCase() === qLower ||
        b.label.toLowerCase() === qLower);

    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return 0;
  });

  // Group + cap (5 each)
  const grouped: Record<GroupKey, SearchItem[]> = {
    users: [],
    collections: [],
    nfts: [],
  };

  for (const item of boosted) {
    if (grouped[item.type].length < 5) grouped[item.type].push(item);
  }

  return NextResponse.json({
    users: grouped.users,
    collections: grouped.collections,
    nfts: grouped.nfts,
    recent: [] as SearchItem[],
  });
}
