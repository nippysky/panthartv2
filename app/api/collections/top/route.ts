// src/app/api/collections/top/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { CurrencyKind, Prisma } from "@/src/lib/generated/prisma/client";
import { ethers } from "ethers";

type WindowKey = "24h" | "7d" | "30d";
const WINDOW_DEFAULT: WindowKey = "24h";

function parseWindow(v: string | null): WindowKey {
  return v === "24h" || v === "7d" || v === "30d" ? v : WINDOW_DEFAULT;
}

function windowToMs(windowKey: WindowKey): number {
  if (windowKey === "7d") return 7 * 24 * 60 * 60 * 1000;
  if (windowKey === "30d") return 30 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function toNum(baseStr: string, decimals: number) {
  const s = ethers.formatUnits(baseStr, decimals);
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function pctChange(curr: number, prev: number): number {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

type HasSaleFields = {
  presale: { startTime: Date; endTime: Date } | null;
  publicSale: { startTime: Date } | null;
};

function hasStarted(c: HasSaleFields, now: Date): boolean {
  if (!c.presale && !c.publicSale) return true;
  const presaleStarted = c.presale ? now >= c.presale.startTime : false;
  const publicStarted = c.publicSale ? now >= c.publicSale.startTime : false;
  return presaleStarted || publicStarted;
}

const selectCollection = {
  id: true,
  name: true,
  contract: true,
  logoUrl: true,
  coverUrl: true,
  floorPrice: true,
  volume: true,
  itemsCount: true,
  supply: true,
  indexStatus: true,
  presale: { select: { startTime: true, endTime: true } },
  publicSale: { select: { startTime: true } },
} satisfies Prisma.CollectionSelect;

type CollectionRow = Prisma.CollectionGetPayload<{ select: typeof selectCollection }>;

type CurrencyMeta =
  | { id: "native"; symbol: "ETN"; decimals: 18; kind: "NATIVE" }
  | { id: string; symbol: string; decimals: number; kind: "NATIVE" | "ERC20" };

async function resolveCurrency(q: string | null): Promise<CurrencyMeta> {
  const val = (q || "native").trim().toLowerCase();
  if (val === "native") return { id: "native", symbol: "ETN", decimals: 18, kind: "NATIVE" };

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

function whereForCurrency(cur: CurrencyMeta): Prisma.MarketplaceSaleWhereInput {
  if (cur.kind === "NATIVE") {
    return { OR: [{ currencyId: null }, { currency: { kind: CurrencyKind.NATIVE } }] };
  }
  return { currencyId: cur.id };
}

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
    const cid = r.nft.collectionId;
    if (!cid) continue;

    const baseStr =
      cur.kind === "NATIVE"
        ? r.priceEtnWei?.toString()
        : r.priceTokenAmount?.toString();

    if (!baseStr) continue;

    const dec =
      cur.kind === "NATIVE"
        ? 18
        : r.currency?.decimals ?? cur.decimals;

    const human = toNum(baseStr, dec);

    const prev = map.get(cid);
    if (prev == null || human < prev) map.set(cid, human);
  }

  return map;
}

export async function GET(req: NextRequest) {
  await prismaReady;

  try {
    const url = new URL(req.url);
    const windowKey = parseWindow(url.searchParams.get("window"));
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 10, 20));
    const currencyQ = (url.searchParams.get("currency") || "native").trim();

    const now = new Date();
    const ms = windowToMs(windowKey);
    const startA = new Date(now.getTime() - ms);
    const startB = new Date(now.getTime() - ms * 2);

    const curMeta = await resolveCurrency(currencyQ);
    const whereCur = whereForCurrency(curMeta);

    const fetchSalesWindow = async (from: Date, to?: Date) => {
      return prisma.marketplaceSale.findMany({
        where: {
          timestamp: { gte: from, ...(to ? { lt: to } : {}) },
          ...whereCur,
        },
        select: {
          priceEtnWei: true,
          priceTokenAmount: true,
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

    const sumByCollection = (rows: typeof currentSales) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const cid = r.nft.collectionId;
        if (!cid) continue;

        if (curMeta.kind === "NATIVE") {
          const base = r.priceEtnWei?.toString();
          if (!base) continue;
          m.set(cid, (m.get(cid) ?? 0) + toNum(base, 18));
        } else {
          const base = r.priceTokenAmount?.toString();
          if (!base) continue;
          const dec = r.currency?.decimals ?? curMeta.decimals;
          m.set(cid, (m.get(cid) ?? 0) + toNum(base, dec));
        }
      }
      return m;
    };

    const currMap = sumByCollection(currentSales);
    const prevMap = sumByCollection(previousSales);

    const rankedIds = [...currMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cid]) => cid);

    const baseRanked = await prisma.collection.findMany({
      where: { id: { in: rankedIds } },
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
      candidates = [...candidates, ...filler.filter((c) => hasStarted(c, now))].slice(0, limit);
    }

    const candidateIds = candidates.map((c) => c.id);

    const floors = await listingFloorPerCollection(candidateIds, curMeta, now);

    // ✅ BIG FIX: compute all-time sales ONLY for candidate collections (not the whole table)
    const allTimeSales = await prisma.marketplaceSale.findMany({
      where: {
        ...whereCur,
        nft: { collectionId: { in: candidateIds } },
      },
      select: {
        priceEtnWei: true,
        priceTokenAmount: true,
        currency: { select: { decimals: true } },
        nft: { select: { collectionId: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 300_000,
    });

    const allTimeMap = new Map<string, number>();
    for (const r of allTimeSales) {
      const cid = r.nft.collectionId;
      if (!cid) continue;

      if (curMeta.kind === "NATIVE") {
        const base = r.priceEtnWei?.toString();
        if (!base) continue;
        allTimeMap.set(cid, (allTimeMap.get(cid) ?? 0) + toNum(base, 18));
      } else {
        const base = r.priceTokenAmount?.toString();
        if (!base) continue;
        const dec = r.currency?.decimals ?? curMeta.decimals;
        allTimeMap.set(cid, (allTimeMap.get(cid) ?? 0) + toNum(base, dec));
      }
    }

    const shaped = candidates.map((c) => {
      const minted = c.itemsCount ?? 0;
      const supply = c.supply != null ? Number(c.supply) : 0;
      const isSoldOut = supply > 0 && minted >= supply;

      const presaleActive =
        !!c.presale && now >= c.presale.startTime && now <= c.presale.endTime && !isSoldOut;
      const publicActive =
        !!c.publicSale && now >= c.publicSale.startTime && !isSoldOut;

      const sale = presaleActive
        ? { isActive: true, activePhase: "presale" as const }
        : publicActive
        ? { isActive: true, activePhase: "public" as const }
        : { isActive: false, activePhase: null };

      const volCurr = currMap.get(c.id) ?? 0;
      const volPrev = prevMap.get(c.id) ?? 0;

      return {
        id: c.id,
        name: c.name,
        contract: c.contract,
        logoUrl: c.logoUrl,
        coverUrl: c.coverUrl,
        floor: floors.get(c.id) ?? 0,
        volumeWindow: volCurr,
        volumePrevWindow: volPrev,
        changePct: pctChange(volCurr, volPrev),
        volumeAllTime: allTimeMap.get(c.id) ?? 0,
        sale,
        isSoldOut,
        currency: curMeta,
      };
    });

    shaped.sort((a, b) => b.volumeWindow - a.volumeWindow);

    const resp = NextResponse.json({ collections: shaped, nextCursor: null }, { status: 200 });
    resp.headers.set("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    return resp;
  } catch (err) {
    console.error("[api/collections/top] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
