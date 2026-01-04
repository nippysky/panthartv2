export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/**
 * Top Collections (windowed)
 * - Windows: 24h, 7d, 30d
 * - Currency-aware: NATIVE (ETN) or specific ERC-20 by id
 * - FLOOR = cheapest *active listing* per collection in the chosen currency
 * - Volumes:
 *    • Ranking uses windowed volume (current window)
 *    • Display uses all-time volume (currency-aware), to match the collection page
 * - Filters out collections that haven't started (unless no schedule exists)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

// ✅ Import Prisma as a VALUE (not `import type`)
import { Prisma, CurrencyKind } from "@/lib/generated/prisma";

import { ethers } from "ethers";
import { memoizeAsync, cacheKey } from "@/lib/server/chain-cache";
import { ERC721_DROP_ABI } from "@/lib/abis/ERC721DropABI";

/* ----------------------------- Small helpers ----------------------------- */

type WindowKey = "24h" | "7d" | "30d";
const WINDOW_DEFAULT: WindowKey = "24h";

function parseWindow(v: string | null): WindowKey {
  if (v === "24h" || v === "7d" || v === "30d") return v;
  return WINDOW_DEFAULT;
}

function windowToMs(windowKey: WindowKey): number {
  switch (windowKey) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

function weiToHuman(baseStr: string, decimals = 18) {
  const n = Number(baseStr);
  return n / 10 ** decimals;
}

function pctChange(curr: number, prev: number): number {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

/** Ethers v6 provider */
function getProvider(): ethers.AbstractProvider | null {
  const url = process.env.RPC_URL;
  try {
    return url ? new ethers.JsonRpcProvider(url) : null;
  } catch {
    return null;
  }
}

/** Cached chain totalSupply() (ttlMs ~ 12s). */
async function getMintedOnChainCached(
  provider: ethers.AbstractProvider | null,
  contract: string,
  ttlMs = 12_000
): Promise<number | null> {
  if (!provider) return null;
  const key = cacheKey(["minted721", contract.toLowerCase()]);
  return memoizeAsync<number | null>(key, ttlMs, async () => {
    try {
      const c = new ethers.Contract(contract, ERC721_DROP_ABI, provider);
      const ts: bigint = await c.totalSupply();
      return Number(ts);
    } catch {
      return null;
    }
  });
}

/** Only show collections that have started (presale OR public) OR have no sale schedule (legacy). */
type HasSaleFields = {
  presale: { startTime: Date; endTime: Date } | null;
  publicSale: { startTime: Date } | null;
};
function hasStarted(c: HasSaleFields, now: Date): boolean {
  const hasPresale = !!c.presale;
  const hasPublic = !!c.publicSale;
  if (!hasPresale && !hasPublic) return true; // no schedule → always eligible
  const presaleStarted = hasPresale ? now >= c.presale!.startTime : false;
  const publicStarted = hasPublic ? now >= c.publicSale!.startTime : false;
  return presaleStarted || publicStarted;
}

/** Prisma-select for collection base fields used here */
const selectCollection = {
  id: true,
  name: true,
  contract: true,
  logoUrl: true,
  coverUrl: true,
  floorPrice: true, // DB ETN snapshot (legacy fallback, not used except if no listings and NATIVE)
  volume: true, // DB all-time ETN snapshot (display-only legacy)
  itemsCount: true, // DB minted fallback
  supply: true,
  indexStatus: true,
  presale: { select: { startTime: true, endTime: true } },
  publicSale: { select: { startTime: true } },
} satisfies Prisma.CollectionSelect;

type CollectionRow = Prisma.CollectionGetPayload<{ select: typeof selectCollection }>;

/* ---------------------------- Currency helpers --------------------------- */

type CurrencyMeta =
  | { id: "native"; symbol: "ETN"; decimals: 18; kind: "NATIVE" }
  | { id: string; symbol: string; decimals: number; kind: "NATIVE" | "ERC20" };

async function resolveCurrency(q: string | null): Promise<CurrencyMeta> {
  const val = (q || "native").trim().toLowerCase();
  if (val === "native")
    return { id: "native", symbol: "ETN", decimals: 18, kind: "NATIVE" };
  const cur = await prisma.currency.findFirst({
    where: { id: q!, active: true },
    select: { id: true, symbol: true, decimals: true, kind: true },
  });
  if (!cur) throw new Error("Unknown currency");
  return {
    id: cur.id,
    symbol: cur.symbol,
    decimals: cur.decimals ?? 18,
    kind: cur.kind === CurrencyKind.ERC20 ? "ERC20" : "NATIVE",
  };
}

function whereForCurrency(
  kind: CurrencyMeta["kind"],
  id?: string
): Prisma.MarketplaceSaleWhereInput {
  return kind === "NATIVE"
    ? { OR: [{ currencyId: null }, { currency: { kind: CurrencyKind.NATIVE } }] }
    : { currencyId: id! };
}

/* ---------------------- Floor = cheapest active listing ---------------------- */

async function listingFloorPerCollection(
  candidateIds: string[],
  cur: CurrencyMeta,
  now: Date
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!candidateIds.length) return map;

  const rows = await prisma.marketplaceListing.findMany({
    where: {
      status: "ACTIVE",
      startTime: { lte: now },
      nft: { collectionId: { in: candidateIds }, status: "SUCCESS" },
      AND: [
        { OR: [{ endTime: null }, { endTime: { gt: now } }] },
        ...(cur.kind === "NATIVE"
          ? [{ OR: [{ currencyId: null }, { currency: { kind: CurrencyKind.NATIVE } }] }]
          : [{ currencyId: cur.id }]),
      ],
    },
    select: {
      priceEtnWei: true,
      priceTokenAmount: true,
      currency: { select: { decimals: true } },
      nft: { select: { collectionId: true } },
    },
    orderBy: [{ priceEtnWei: "asc" }, { priceTokenAmount: "asc" }],
    take: 20_000,
  });

  for (const r of rows) {
    const cid = r.nft.collectionId!;
    const baseStr =
      cur.kind === "NATIVE"
        ? (r.priceEtnWei as any)?.toString?.()
        : (r.priceTokenAmount as any)?.toString?.();
    if (!baseStr) continue;

    const dec = cur.kind === "NATIVE" ? 18 : r.currency?.decimals ?? cur.decimals;
    const human = weiToHuman(baseStr, dec);

    const prev = map.get(cid);
    if (prev == null || human < prev) map.set(cid, human);
  }

  return map;
}

/* --------------------------------- GET --------------------------------- */

export async function GET(req: NextRequest) {
  await prismaReady;

  try {
    const provider = getProvider();

    const url = new URL(req.url);
    const windowKey = parseWindow(url.searchParams.get("window"));
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 10, 20));
    const currencyQ = (url.searchParams.get("currency") || "native").trim();

    const now = new Date();

    const ms = windowToMs(windowKey);
    const startA = new Date(now.getTime() - ms);
    const startB = new Date(now.getTime() - ms * 2);

    const curMeta = await resolveCurrency(currencyQ);

    type SaleRow = {
      priceEtnWei: Prisma.Decimal;
      priceTokenAmount: Prisma.Decimal | null;
      timestamp: Date;
      currency: { decimals: number | null } | null;
      nft: { collectionId: string | null };
    };

    const whereNative = whereForCurrency("NATIVE");

    const fetchSalesWindow = async (from: Date, to?: Date): Promise<SaleRow[]> => {
      const base: Prisma.MarketplaceSaleWhereInput = {
        timestamp: { gte: from, ...(to ? { lt: to } : {}) },
        ...(curMeta.kind === "NATIVE" ? whereNative : { currencyId: curMeta.id as string }),
      };
      return prisma.marketplaceSale.findMany({
        where: base,
        select: {
          priceEtnWei: true,
          priceTokenAmount: true,
          timestamp: true,
          currency: { select: { decimals: true } },
          nft: { select: { collectionId: true } },
        },
        orderBy: { timestamp: "desc" },
        take: 200_000,
      });
    };

    const [currentSales, previousSales] = await Promise.all([
      fetchSalesWindow(startA),
      fetchSalesWindow(startB, startA),
    ]);

    const sumByCollection = (rows: SaleRow[]) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const cid = r.nft.collectionId;
        if (!cid) continue;
        if (curMeta.kind === "NATIVE") {
          const base = (r.priceEtnWei as any)?.toString?.();
          if (!base) continue;
          m.set(cid, (m.get(cid) ?? 0) + weiToHuman(base, 18));
        } else {
          const base = (r.priceTokenAmount as any)?.toString?.();
          if (!base) continue;
          const dec = r.currency?.decimals ?? curMeta.decimals;
          m.set(cid, (m.get(cid) ?? 0) + weiToHuman(base, dec));
        }
      }
      return m;
    };

    const currMap = sumByCollection(currentSales);
    const prevMap = sumByCollection(previousSales);

    const rankedCollectionIds = [...currMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cid]) => cid);

    const baseRanked = await prisma.collection.findMany({
      where: { id: { in: rankedCollectionIds } },
      select: selectCollection,
    });
    const eligibleRanked = baseRanked.filter((c) => hasStarted(c, now));

    let candidates: CollectionRow[] = eligibleRanked;

    if (candidates.length < limit) {
      const need = limit - candidates.length;
      const filler = await prisma.collection.findMany({
        where: {
          id: { notIn: candidates.map((x) => x.id) },
          OR: [
            { presale: { is: { startTime: { lte: now } } } },
            { publicSale: { is: { startTime: { lte: now } } } },
            { AND: [{ presale: { is: null } }, { publicSale: { is: null } }] },
          ],
        },
        orderBy: { volume: "desc" },
        take: need,
        select: selectCollection,
      });
      const fillerEligible = filler.filter((c) => hasStarted(c, now));
      candidates = [...candidates, ...fillerEligible].slice(0, limit);
    }

    const candidateIds = candidates.map((c) => c.id);

    // Floor = cheapest active listing (currency-aware)
    const floors = await listingFloorPerCollection(candidateIds, curMeta, now);

    // All-time volume (currency-aware) for display
    const allTimeSales = await prisma.marketplaceSale.findMany({
      where: curMeta.kind === "NATIVE" ? whereNative : { currencyId: curMeta.id },
      select: {
        priceEtnWei: true,
        priceTokenAmount: true,
        currency: { select: { decimals: true } },
        nft: { select: { collectionId: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 300_000,
    });

    const allTimeMap = (() => {
      const m = new Map<string, number>();
      for (const r of allTimeSales) {
        const cid = r.nft.collectionId!;
        if (!cid) continue;
        if (curMeta.kind === "NATIVE") {
          const base = (r.priceEtnWei as any)?.toString?.();
          if (!base) continue;
          m.set(cid, (m.get(cid) ?? 0) + weiToHuman(base, 18));
        } else {
          const base = (r.priceTokenAmount as any)?.toString?.();
          if (!base) continue;
          const dec = r.currency?.decimals ?? curMeta.decimals;
          m.set(cid, (m.get(cid) ?? 0) + weiToHuman(base, dec));
        }
      }
      return m;
    })();

    const shaped = await Promise.all(
      candidates.map(async (c) => {
        const provider = getProvider();
        const mintedOnChain = await getMintedOnChainCached(provider, c.contract);
        const minted = mintedOnChain ?? c.itemsCount ?? 0;
        const supply = Number.isFinite(c?.supply) && c?.supply != null ? Number(c.supply) : 0;
        const isSoldOut = supply > 0 && minted >= supply;

        const presaleActive =
          !!c.presale && now >= c.presale.startTime && now <= c.presale.endTime && !isSoldOut;
        const publicActive = !!c.publicSale && now >= c.publicSale.startTime && !isSoldOut;

        const sale = presaleActive
          ? { isActive: true, activePhase: "presale" as const }
          : publicActive
          ? { isActive: true, activePhase: "public" as const }
          : { isActive: false, activePhase: null };

        const volCurr = currMap.get(c.id) ?? 0;
        const volPrev = prevMap.get(c.id) ?? 0;
        const change = pctChange(volCurr, volPrev);

        return {
          id: c.id,
          name: c.name,
          contract: c.contract,
          logoUrl: c.logoUrl,
          coverUrl: c.coverUrl,
          floor: floors.get(c.id) ?? 0, // match collection page behavior
          floorBase: null,
          volumeWindow: volCurr,
          volumePrevWindow: volPrev,
          changePct: change,
          volumeAllTime: allTimeMap.get(c.id) ?? 0, // display this in UI
          sale,
          isFullyIndexed:
            (supply > 0 && minted >= supply) ||
            String(c.indexStatus ?? "").toUpperCase() === "COMPLETED",
          isSoldOut,
          currency: curMeta,
        };
      })
    );

    shaped.sort((a, b) => b.volumeWindow - a.volumeWindow);

    const resp = NextResponse.json({ collections: shaped, nextCursor: null }, { status: 200 });
    resp.headers.set("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    return resp;
  } catch (err) {
    console.error("[api/collections/top] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
