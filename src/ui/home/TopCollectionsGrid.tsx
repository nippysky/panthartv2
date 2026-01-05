// src/ui/home/TopCollectionsGrid.tsx
import Image from "next/image";
import Link from "next/link";
import { ethers } from "ethers";

import prisma, { prismaReady } from "@/src/lib/db";
import { Prisma } from "@/src/lib/generated/prisma";

type WindowKey = "24h" | "7d" | "30d";

const PLACEHOLDER =
  "https://res.cloudinary.com/dx1bqxtys/image/upload/v1750638432/panthart/amy5m5u7nxmhlh8brv6d.png";

function windowToMs(w: WindowKey) {
  if (w === "7d") return 7 * 24 * 60 * 60 * 1000;
  if (w === "30d") return 30 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function windowLabel(w: WindowKey) {
  if (w === "7d") return "7d";
  if (w === "30d") return "30d";
  return "24h";
}

function pctChange(curr: number, prev: number): number {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function toBigIntSafe(v: unknown): bigint {
  if (v == null) return BigInt(0);
  const s = String(v).trim();
  if (!s) return BigInt(0);

  // If DB ever returns "4e+21" or similar, normalize to integer string.
  // BigInt can't parse exponent form.
  if (/[eE]/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return BigInt(0);
    // Round towards zero for safety
    return BigInt(Math.trunc(n));
  }

  // strip decimal part if it appears
  const intPart = s.includes(".") ? s.split(".")[0] : s;

  try {
    return BigInt(intPart);
  } catch {
    return BigInt(0);
  }
}

function formatEtnCompactFromWei(wei: bigint): string {
  if (wei <= BigInt(0)) return "0.00";

  const s = ethers.formatUnits(wei, 18);
  const n = Number(s);
  if (!Number.isFinite(n)) return "0.00";

  if (n < 1000) return n.toFixed(2);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

type Row = {
  id: string;
  name: string;
  contract: string;
  logoUrl: string | null;

  floorWei: bigint; // active floor
  volumeWei: bigint; // window volume
  allTimeWei: bigint; // all-time volume (native)

  changePct: number; // vs previous equal window
};

async function sumSalesWeiByCollection(
  collectionIds: string[],
  from?: Date,
  to?: Date
): Promise<Map<string, bigint>> {
  if (!collectionIds.length) return new Map();

  const rows = await prisma.$queryRaw<
    Array<{ collectionId: string; sumWei: string | null }>
  >(Prisma.sql`
    SELECT n."collectionId" AS "collectionId",
           SUM(s."priceEtnWei")::text AS "sumWei"
    FROM "MarketplaceSale" s
    JOIN "NFT" n ON n."id" = s."nftId"
    LEFT JOIN "Currency" c ON c."id" = s."currencyId"
    WHERE n."collectionId" IN (${Prisma.join(collectionIds)})
      AND (s."currencyId" IS NULL OR c."kind" = 'NATIVE')
      ${from ? Prisma.sql`AND s."timestamp" >= ${from}` : Prisma.sql``}
      ${to ? Prisma.sql`AND s."timestamp" < ${to}` : Prisma.sql``}
    GROUP BY n."collectionId"
  `);

  const out = new Map<string, bigint>();
  for (const r of rows) out.set(r.collectionId, toBigIntSafe(r.sumWei));
  return out;
}

async function floorListingWeiByCollection(
  collectionIds: string[],
  now: Date
): Promise<Map<string, bigint>> {
  if (!collectionIds.length) return new Map();

  const rows = await prisma.$queryRaw<
    Array<{ collectionId: string; floorWei: string | null }>
  >(Prisma.sql`
    SELECT n."collectionId" AS "collectionId",
           MIN(l."priceEtnWei")::text AS "floorWei"
    FROM "MarketplaceListing" l
    JOIN "NFT" n ON n."id" = l."nftId"
    LEFT JOIN "Currency" c ON c."id" = l."currencyId"
    WHERE n."collectionId" IN (${Prisma.join(collectionIds)})
      AND n."status" = 'SUCCESS'
      AND l."status" = 'ACTIVE'
      AND l."startTime" <= ${now}
      AND (l."endTime" IS NULL OR l."endTime" > ${now})
      AND (l."currencyId" IS NULL OR c."kind" = 'NATIVE')
    GROUP BY n."collectionId"
  `);

  const out = new Map<string, bigint>();
  for (const r of rows) out.set(r.collectionId, toBigIntSafe(r.floorWei));
  return out;
}

async function computeTopCollections(windowKey: WindowKey, limit: number) {
  const now = new Date();
  const ms = windowToMs(windowKey);

  const startA = new Date(now.getTime() - ms);
  const startB = new Date(now.getTime() - ms * 2);

  // Candidate pool (fast, ensures we ALWAYS have rows even if no sales in window)
  const pool = await prisma.collection.findMany({
    select: {
      id: true,
      name: true,
      contract: true,
      logoUrl: true,
      volume: true, // snapshot fallback ranking
      updatedAt: true,
    },
    orderBy: [{ volume: "desc" }, { updatedAt: "desc" }],
    take: Math.max(50, limit * 10),
  });

  const poolIds = pool.map((c) => c.id);

  const [currMap, prevMap] = await Promise.all([
    sumSalesWeiByCollection(poolIds, startA, now),
    sumSalesWeiByCollection(poolIds, startB, startA),
  ]);

  // Rank by current window volume; tie-break by snapshot volume
  const ranked = [...pool].sort((a, b) => {
    const av = currMap.get(a.id) ?? BigInt(0);
    const bv = currMap.get(b.id) ?? BigInt(0);
    if (bv !== av) return bv > av ? 1 : -1;
    return (b.volume ?? 0) - (a.volume ?? 0);
  });

  const picked = ranked.slice(0, limit);
  const pickedIds = picked.map((c) => c.id);

  const [floors, allTimeMap] = await Promise.all([
    floorListingWeiByCollection(pickedIds, now),
    sumSalesWeiByCollection(pickedIds), // all-time volume (native)
  ]);

  const rows: Row[] = picked.map((c) => {
    const volWei = currMap.get(c.id) ?? BigInt(0);
    const prevWei = prevMap.get(c.id) ?? BigInt(0);

    const volNum = Number(ethers.formatUnits(volWei, 18));
    const prevNum = Number(ethers.formatUnits(prevWei, 18));

    return {
      id: c.id,
      name: c.name,
      contract: c.contract,
      logoUrl: c.logoUrl,

      floorWei: floors.get(c.id) ?? BigInt(0),
      volumeWei: volWei,
      allTimeWei: allTimeMap.get(c.id) ?? BigInt(0),

      changePct: pctChange(volNum, prevNum),
    };
  });

  return rows;
}

export default async function TopCollectionsGrid({
  windowKey,
  limit,
}: {
  windowKey: WindowKey;
  limit: number;
}) {
  await prismaReady;

  const rows = await computeTopCollections(windowKey, limit);
  const wl = windowLabel(windowKey);

  return (
    <div className="mt-6 space-y-3">
      {rows.map((c) => {
        const change = c.changePct;
        const isUp = change >= 0;

        return (
          <Link
            key={c.id}
            href={`/collections/${c.contract}`}
            className={[
              "group flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-4",
              "transition hover:bg-background/60",
            ].join(" ")}
          >
            <div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-border bg-background">
              <Image
                src={c.logoUrl ?? PLACEHOLDER}
                alt={c.name}
                fill
                className="object-cover"
                sizes="44px"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold">{c.name}</div>

                <div
                  className={[
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    isUp
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400",
                  ].join(" ")}
                  title={`Change vs previous ${wl}`}
                >
                  {isUp ? "+" : ""}
                  {Number.isFinite(change) ? change.toFixed(0) : "0"}%
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <span className="whitespace-nowrap">
                  Floor (active){" "}
                  <span className="font-semibold text-foreground/90">
                    {formatEtnCompactFromWei(c.floorWei)} ETN
                  </span>
                </span>

                <span className="whitespace-nowrap">
                  Vol ({wl}){" "}
                  <span className="font-semibold text-foreground/90">
                    {formatEtnCompactFromWei(c.volumeWei)} ETN
                  </span>
                </span>
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-end">
              <div className="text-xs text-muted">All-time volume</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {formatEtnCompactFromWei(c.allTimeWei)} ETN
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
