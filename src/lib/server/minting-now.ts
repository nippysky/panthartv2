// lib/server/minting-now.ts
import "server-only";

import prisma, { prismaReady } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { ethers } from "ethers";
import { memoizeAsync, cacheKey } from "@/lib/server/chain-cache";
import { ERC721_DROP_ABI } from "@/lib/abis/ERC721DropABI";
import { ERC1155_SINGLE_ABI } from "@/lib/abis/ERC1155SingleDropABI";
import { MintingNowItem, MintingNowItemSchema } from "@/lib/types/minting-now";

/* Premium placeholder (Cloudinary) */
const PLACEHOLDER =
  "https://res.cloudinary.com/dx1bqxtys/image/upload/v1750638432/panthart/amy5m5u7nxmhlh8brv6d.png";

/* Server-side RPC provider (ethers v6) */
function getProvider(): ethers.AbstractProvider | null {
  const url = process.env.RPC_URL;
  try {
    return url ? new ethers.JsonRpcProvider(url) : null;
  } catch {
    return null;
  }
}

/* Cached on-chain reads */
async function getErc721MintedOnChain(
  provider: ethers.AbstractProvider | null,
  contract: string
): Promise<number | null> {
  if (!provider) return null;
  const key = cacheKey(["minted721", contract]);
  return memoizeAsync<number | null>(key, 12_000, async () => {
    try {
      const c = new ethers.Contract(contract, ERC721_DROP_ABI, provider);
      const total: bigint = await c.totalSupply();
      // Mint counts are typically well within Number safe range; if not, clamp to MAX_SAFE_INTEGER.
      const n = Number(total);
      return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
    } catch {
      return null;
    }
  });
}

async function getErc1155MintedOnChain(
  provider: ethers.AbstractProvider | null,
  contract: string
): Promise<number | null> {
  if (!provider) return null;
  const key = cacheKey(["minted1155", contract]);
  return memoizeAsync<number | null>(key, 12_000, async () => {
    try {
      const c = new ethers.Contract(contract, ERC1155_SINGLE_ABI, provider);
      const total: bigint = await c.totalMinted();
      const n = Number(total);
      return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
    } catch {
      return null;
    }
  });
}

/** Legacy: return a flat list (kept for compatibility in a few places) */
export async function getMintingNowItems(limit = 20): Promise<MintingNowItem[]> {
  const page = await getMintingNowPage(limit, null);
  return page.items;
}

/** New: paginated, cursor = ISO timestamp (createdAt of last item in previous page) */
export async function getMintingNowPage(
  limit = 20,
  cursorISO: string | null
): Promise<{ items: MintingNowItem[]; nextCursor: string | null }> {
  await prismaReady;

  const now = new Date();
  const provider = getProvider();

  /** ---- Prisma typings (so _count/presale/publicSale are known) ---- */
  const includeCollection = {
    _count: { select: { nfts: true } },
    publicSale: true,
    presale: true,
  } satisfies Prisma.CollectionInclude;

  type CollectionRow = Prisma.CollectionGetPayload<{ include: typeof includeCollection }>;

  const selectSingle1155 = {
    id: true,
    name: true,
    description: true,
    contract: true,
    imageUrl: true,
    maxSupply: true,
    mintPriceEtnWei: true,
    createdAt: true,
    indexStatus: true,
  } satisfies Prisma.Single1155Select;

  type Single1155Row = Prisma.Single1155GetPayload<{ select: typeof selectSingle1155 }>;

  // ------------------- ERC721 drops -------------------
  // We no longer filter by "live only" in SQL – we bring in all drops
  // that have a configured public sale and then classify:
  //   - presale (active)
  //   - public (live)
  //   - upcoming (public/presale start in the future)
  const cRows = (await prisma.collection.findMany({
    where: {
      standard: "ERC721",
      supply: { not: null },
      isOrphan: false,
      // Require a publicSale so we always have a public mint phase to show
      publicSale: { isNot: null },
    },
    include: includeCollection,
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(limit * 2, 40),
  })) as unknown as CollectionRow[];

  // ------------------- ERC1155 single drops -------------------
  const sRows = (await prisma.single1155.findMany({
    where: { indexStatus: "COMPLETED" },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(limit * 2, 40),
    select: selectSingle1155,
  })) as unknown as Single1155Row[];

  type Raw = { createdAt: Date; data: MintingNowItem };
  const out: Raw[] = [];

  // ---- Map ERC721 ----
  for (const c of cRows) {
    const mintedOnChain = await getErc721MintedOnChain(provider, c.contract);
    const minted: number = mintedOnChain ?? (c._count.nfts ?? 0);

    const supply = c.supply ?? 0;

    // Hard stop: no supply or sold out
    if (supply <= 0 || minted >= supply || !c.publicSale) continue;

    const publicStart = c.publicSale.startTime;
    const presaleStart = c.presale?.startTime;
    const presaleEnd = c.presale?.endTime;

    const presaleActive =
      !!c.presale &&
      !!presaleStart &&
      !!presaleEnd &&
      presaleStart <= now &&
      presaleEnd > now;

    const publicActive = publicStart <= now;

    const presaleUpcoming =
      !!c.presale && !!presaleStart && presaleStart > now;

    const publicUpcoming = publicStart > now;

    const anyActive = presaleActive || publicActive;
    const anyUpcoming = presaleUpcoming || publicUpcoming;

    // If it’s neither active nor upcoming, we don’t surface it
    if (!anyActive && !anyUpcoming) continue;

    let status: MintingNowItem["status"];
    if (presaleActive) {
      status = "presale";
    } else if (publicActive) {
      status = "public";
    } else {
      // Not live yet, but at least one phase is in the future
      status = "upcoming";
    }

    const mintedPct =
      supply > 0 ? Math.min(100, Math.max(0, (minted / supply) * 100)) : 0;

    const base: MintingNowItem = {
      id: c.id,
      kind: "erc721",
      name: c.name || "Collection",
      description: c.description ?? null,
      contract: c.contract,
      href: `/minting-now/${c.contract}`,
      logoUrl: c.logoUrl || PLACEHOLDER,
      coverUrl: c.coverUrl || c.logoUrl || PLACEHOLDER,
      supply,
      minted,
      mintedPct,
      status,
      publicSale: {
        startISO: c.publicSale.startTime.toISOString(),
        // ✅ stringify bigints for wire safety
        priceEtnWei: c.publicSale.priceEtnWei.toString(),
      },
      // Presale details are useful even when upcoming, so we include them always if present
      ...(c.presale
        ? {
            presale: {
              startISO: c.presale.startTime.toISOString(),
              endISO: c.presale.endTime.toISOString(),
              priceEtnWei: c.presale.priceEtnWei.toString(),
            },
          }
        : {}),
    };

    const parsed = MintingNowItemSchema.safeParse(base);
    if (parsed.success) {
      out.push({ createdAt: c.createdAt, data: parsed.data });
    }
  }

  // ---- Map ERC1155 ----
  for (const s of sRows) {
    const supply = s.maxSupply ?? 0;
    if (supply <= 0) continue;

    const mintedOnChain = await getErc1155MintedOnChain(provider, s.contract);

    let mintedFromDb = 0;
    if (mintedOnChain == null) {
      const sumBal = await prisma.erc1155Balance.aggregate({
        where: { single1155Id: s.id },
        _sum: { balance: true },
      });
      mintedFromDb = Number(sumBal._sum.balance ?? 0);
    }

    const minted: number = mintedOnChain ?? mintedFromDb;
    if (minted >= supply) continue;

    const mintedPct = Math.min(100, Math.max(0, (minted / supply) * 100));

    const item: MintingNowItem = {
      id: s.id,
      kind: "erc1155",
      name: s.name || "Drop",
      description: s.description ?? null,
      contract: s.contract,
      href: `/minting-now/erc1155/${s.contract}`,
      logoUrl: s.imageUrl || PLACEHOLDER,
      coverUrl: s.imageUrl || PLACEHOLDER,
      supply,
      minted,
      mintedPct,
      // ERC1155 singles are effectively “live from creation”
      status: "public",
      publicSale: {
        startISO: s.createdAt.toISOString(),
        // ✅ stringify bigints for wire safety
        priceEtnWei: s.mintPriceEtnWei.toString(),
      },
    };

    const parsed = MintingNowItemSchema.safeParse(item);
    if (parsed.success) {
      out.push({ createdAt: s.createdAt, data: parsed.data });
    }
  }

  // Sort newest first
  out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Cursor: only return items strictly older than cursorISO (to avoid dupes)
  let filtered = out;
  if (cursorISO) {
    const cutoff = new Date(cursorISO).getTime();
    filtered = out.filter((x) => x.createdAt.getTime() < cutoff);
  }

  const slice = filtered.slice(0, limit);
  const nextCursor = slice.length > 0 ? slice[slice.length - 1].createdAt.toISOString() : null;

  return { items: slice.map((x) => x.data), nextCursor };
}
