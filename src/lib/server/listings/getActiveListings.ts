/* eslint-disable @typescript-eslint/no-explicit-any */
// src/server/listings/getActiveListings.ts
import "server-only";

import { unstable_cache } from "next/cache";
import prisma, { prismaReady } from "@/src/lib/db";
import { CurrencyKind, ListingStatus } from "@/src/lib/generated/prisma/client";

/** Cursor is just the DB id (stable + matches your existing route). */
export type ListingsCursor = string | null;

export type ActiveListingFeedItem = {
  id: string; // stays compatible with existing route (chainId or dbId depending on chain mode)
  dbId: string;
  chainId: string | null;

  nft: {
    contract: string;
    tokenId: string;
    name: string | null;
    image: string | null;
    standard: string; // "ERC721" | "ERC1155"
  };

  quantity: number;
  sellerAddress: string | null;
  seller: { address: string | null; username: string | null };

  startTime: string;
  endTime: string | null;
  isLive: boolean;

  currency: {
    id: string | null;
    kind: "NATIVE" | "ERC20";
    symbol: string;
    decimals: number;
    tokenAddress: string | null;
  };

  price: {
    unitWei: string | null;
    unit: string | null;
    totalWei: string | null;
    total: string | null;
  };

  /** ✅ ready-to-render UI string (server computed) */
  priceLabel: string;

  /** ✅ always token page */
  href: string;
};

/* ---------- bigint-safe formatting ---------- */

function expandSciToIntegerString(s: string): string {
  s = s.trim().toLowerCase();
  if (!/e/.test(s)) return s;

  const [mant, expStr] = s.split("e");
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return s;

  const sign = mant.startsWith("-") ? "-" : "";
  const m = mant.replace(/^[+-]/, "");
  const [intPart, fracPartRaw = ""] = m.split(".");
  const fracPart = fracPartRaw.replace(/[^0-9]/g, "");

  if (exp >= 0) {
    const needed = exp - fracPart.length;
    if (needed >= 0) {
      return (sign + intPart + fracPart + "0".repeat(needed)).replace(
        /^(-?)0+(\d)/,
        "$1$2"
      );
    } else {
      const split = fracPart.length + needed;
      return (sign + intPart + fracPart.slice(0, split)).replace(
        /^(-?)0+(\d)/,
        "$1$2"
      );
    }
  }

  return "0";
}

function toBigIntSafe(x: any): bigint | null {
  if (x == null) return null;

  // Prisma Decimal
  if (typeof x === "object" && typeof x.toFixed === "function") {
    const s = x.toFixed(0);
    return BigInt(s.replace(/^0+$/, "0"));
  }

  let s = String(x).trim();
  if (/e/i.test(s)) s = expandSciToIntegerString(s);
  s = s.replace(/\..*$/, "");
  s = s.replace(/^[-+]?0+(?=\d)/, (m) => (m.startsWith("-") ? "-" : ""));
  if (s === "" || s === "-" || s === "+") s = "0";
  return BigInt(s);
}

function pow10BigInt(decimals: number): bigint {
  let p = BigInt(1);
  for (let i = 0; i < decimals; i++) p *= BigInt(10);
  return p;
}

function formatUnitsSafe(wei: bigint, decimals: number): string {
  if (decimals <= 0) return wei.toString();
  const base = pow10BigInt(decimals);
  const whole = wei / base;
  const frac = wei % base;
  if (frac === BigInt(0)) return whole.toString();

  let fracStr = frac.toString().padStart(decimals, "0");
  fracStr = fracStr.replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

function formatCompactNumber(n: number): string {
  try {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function formatPriceLabel(unit: string | null, symbol: string): string {
  if (!unit) return `— ${symbol}`;
  const num = Number(unit);
  if (!Number.isFinite(num)) return `${unit} ${symbol}`;
  return `${formatCompactNumber(num)} ${symbol}`;
}

/* ---------- main query ---------- */

export async function getActiveListings({
  take = 24,
  cursor = null,
}: {
  take?: number;
  cursor?: ListingsCursor;
}): Promise<{ items: ActiveListingFeedItem[]; nextCursor: ListingsCursor }> {
  await prismaReady;

  const now = new Date();

  const rows = await prisma.marketplaceListing.findMany({
    where: {
      status: ListingStatus.ACTIVE,
      startTime: { lte: now },
      OR: [{ endTime: null }, { endTime: { gt: now } }],
      nft: { status: "SUCCESS", imageUrl: { not: null as any } },
    },
    orderBy: [{ startTime: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      startTime: true,
      endTime: true,
      sellerAddress: true,
      quantity: true,
      priceEtnWei: true,
      priceTokenAmount: true,
      currency: {
        select: {
          id: true,
          symbol: true,
          decimals: true,
          kind: true,
          tokenAddress: true,
        },
      },
      nft: {
        select: {
          contract: true,
          tokenId: true,
          name: true,
          imageUrl: true,
          standard: true,
        },
      },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, -1) : rows;

  // seller username lookup (1 query)
  const sellersLc = Array.from(
    new Set(
      page
        .map((r) => r.sellerAddress?.toLowerCase())
        .filter((x): x is string => Boolean(x))
    )
  );

  const users =
    sellersLc.length > 0
      ? await prisma.user.findMany({
          where: { walletAddress: { in: sellersLc } },
          select: { walletAddress: true, username: true },
        })
      : [];

  const usernameByWallet = new Map(
    users.map((u) => [u.walletAddress.toLowerCase(), u.username || null] as const)
  );

  const items: ActiveListingFeedItem[] = page.map((row) => {
    const std = (row.nft.standard ?? "ERC721").toUpperCase();
    const is1155 = std === "ERC1155";
    const qty = Number(row.quantity ?? 1) || 1;

    const isNative =
      (row.currency?.kind ?? CurrencyKind.NATIVE) === CurrencyKind.NATIVE;

    const decimals = isNative ? 18 : row.currency?.decimals ?? 18;
    const symbol = isNative ? "ETN" : row.currency?.symbol ?? "ERC20";
    const tokenAddress = isNative ? null : row.currency?.tokenAddress ?? null;

    const totalWei = toBigIntSafe(isNative ? row.priceEtnWei : row.priceTokenAmount);
    const unitWei = totalWei != null && qty > 0 ? totalWei / BigInt(qty) : null;

    const unit = unitWei != null ? formatUnitsSafe(unitWei, decimals) : null;
    const total = totalWei != null ? formatUnitsSafe(totalWei, decimals) : null;

    const startISO = row.startTime.toISOString();
    const endISO = row.endTime ? row.endTime.toISOString() : null;

    const nowMs = Date.now();
    const isLive =
      nowMs >= row.startTime.getTime() &&
      (!row.endTime || nowMs <= row.endTime.getTime());

    const sellerAddr = row.sellerAddress ?? null;

    return {
      id: row.id,
      dbId: row.id,
      chainId: null,

      nft: {
        contract: row.nft.contract,
        tokenId: row.nft.tokenId,
        name: row.nft.name,
        image: row.nft.imageUrl,
        standard: is1155 ? "ERC1155" : "ERC721",
      },

      quantity: qty,
      sellerAddress: sellerAddr,
      seller: {
        address: sellerAddr,
        username: sellerAddr
          ? usernameByWallet.get(sellerAddr.toLowerCase()) ?? null
          : null,
      },

      startTime: startISO,
      endTime: endISO,
      isLive,

      currency: {
        id: row.currency?.id ?? null,
        kind: isNative ? "NATIVE" : "ERC20",
        symbol,
        decimals,
        tokenAddress,
      },

      price: {
        unitWei: unitWei != null ? unitWei.toString() : null,
        unit,
        totalWei: totalWei != null ? totalWei.toString() : null,
        total,
      },

      priceLabel: formatPriceLabel(unit, symbol),
      href: `/collections/${row.nft.contract}/${row.nft.tokenId}`,
    };
  });

  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;
  return { items, nextCursor };
}

/* ---------- cached wrapper (for homepage / hot paths) ---------- */
/**
 * ✅ Static edge/cache layer around getActiveListings().
 * Great for homepage sections: repeated traffic becomes instant,
 * still updates every N seconds.
 *
 * NOTE: We only cache cursor=null (the "first page") on purpose.
 * Cursor pagination stays dynamic to avoid caching a billion pages.
 */
const getActiveListingsFirstPageCached = unstable_cache(
  async (take: number) => getActiveListings({ take, cursor: null }),
  ["panth:listings:active:first-page"],
  { revalidate: 20 }
);

/**
 * API:
 * - If cursor is null, uses cached first page.
 * - Otherwise falls back to uncached DB query.
 */
export async function getActiveListingsCached({
  take = 24,
  cursor = null,
}: {
  take?: number;
  cursor?: ListingsCursor;
}): Promise<{ items: ActiveListingFeedItem[]; nextCursor: ListingsCursor }> {
  if (!cursor) return getActiveListingsFirstPageCached(take);
  return getActiveListings({ take, cursor });
}