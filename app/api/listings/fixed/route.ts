// app/api/listings/fixed/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import {
  ListingStatus,
  NftStatus,
  Prisma,
} from "@/lib/generated/prisma";
import { formatNumber } from "@/lib/utils";

/* ---------------- cursor helpers ---------------- */
function parseCursor(cur?: string | null) {
  if (!cur) return null;
  const [ts, id] = cur.split("|");
  if (!ts || !id) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return { createdAt: d, id };
}

/* ---------------- BigInt-safe unit helpers ---------------- */

/** Expand numbers/strings like "6e+21" or Prisma.Decimal to a base-unit BigInt. */
function toBigIntUnits(val: unknown): bigint {
  if (typeof val === "bigint") return val;
  if (val == null) return 0n;

  if (typeof val === "number") return toBigIntUnits(String(val));

  if (typeof val === "string") {
    let s = val.trim();
    if (s.endsWith("n")) s = s.slice(0, -1);

    // plain integer
    if (/^[+-]?\d+$/.test(s)) return BigInt(s);

    // scientific notation: 1.23e18, 1e+24, etc.
    const m = s.toLowerCase().match(/^([+-]?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/i);
    if (m) {
      const sign = m[1] === "-" ? "-" : "";
      const intPart = m[2] || "0";
      const fracPart = m[3] || "";
      const exp = parseInt(m[4], 10);

      const digits = intPart + fracPart;
      const shift = exp - fracPart.length;

      if (shift >= 0) return BigInt(sign + digits + "0".repeat(shift));
      const places = -shift; // move decimal left of digits
      return BigInt(sign + "0".repeat(places) + digits);
    }

    // "123.000" -> 123
    if (/^[+-]?\d+\.\d+$/.test(s)) {
      const [a, b] = s.split(".");
      if (/^0+$/.test(b)) return BigInt(a);
    }

    // If Prisma gives something else unexpected
    throw new Error(`Unsupported unit format: ${val}`);
  }

  if (typeof val === "object") {
    const maybe = (val as any)?.toString?.();
    if (typeof maybe === "string" && maybe !== "[object Object]") {
      return toBigIntUnits(maybe);
    }
  }

  throw new Error(`Unsupported unit type: ${typeof val}`);
}

/** Format a base-unit BigInt with given decimals into a human string (trim zeros). */
function formatFromUnits(amount: bigint, decimals: number, maxFrac = 6): string {
  const neg = amount < 0n ? "-" : "";
  const s = (neg ? -amount : amount).toString();
  const pad = s.padStart(decimals + 1, "0");
  const int = pad.slice(0, pad.length - decimals);
  let frac = pad.slice(pad.length - decimals);

  // drop trailing zeros; cap fractional digits
  frac = frac.replace(/0+$/, "");
  if (maxFrac >= 0 && frac.length > maxFrac) frac = frac.slice(0, maxFrac).replace(/0+$/, "");

  return frac ? `${neg}${int}.${frac}` : `${neg}${int}`;
}

/* ---------------- route ---------------- */

export async function GET(req: NextRequest) {
  await prismaReady;

  try {
    const { searchParams } = new URL(req.url);
    const pageSize = Math.min(Math.max(Number(searchParams.get("take") ?? 24), 6), 60);
    const cursorRaw = searchParams.get("cursor");
    const cursor = parseCursor(cursorRaw);

    const now = new Date();

    const where: Prisma.MarketplaceListingWhereInput = {
      status: ListingStatus.ACTIVE,
      startTime: { lte: now },
      OR: [{ endTime: null }, { endTime: { gt: now } }],
      nft: { status: NftStatus.SUCCESS, imageUrl: { not: null as any } },
    };

    const orderBy: Prisma.MarketplaceListingOrderByWithRelationInput[] = [
      { createdAt: "desc" },
      { id: "desc" },
    ];

    const results = await prisma.marketplaceListing.findMany({
      where,
      orderBy,
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        sellerAddress: true,
        quantity: true,
        priceEtnWei: true,
        priceTokenAmount: true,
        nft: {
          select: {
            contract: true,
            tokenId: true,
            name: true,
            imageUrl: true,
            standard: true,
          },
        },
        currency: {
          select: { symbol: true, decimals: true, kind: true, tokenAddress: true, id: true },
        },
      },
    });

    const items = results.map((row) => {
      const isNative =
        !row.currency || row.currency.tokenAddress == null || row.currency.symbol === "ETN";

      // ✅ Force 18 for native ETN (never trust a bad decimals value here)
      const decimals = isNative ? 18 : (row.currency?.decimals ?? 18);

      // Expand to BigInt base units (handles "1e+24" correctly)
      const rawUnits = isNative ? row.priceEtnWei : (row.priceTokenAmount ?? "0");
      const amount = toBigIntUnits(rawUnits as any);

      // Human string (unabbreviated) and a short label for UI
      const human = formatFromUnits(amount, decimals, 6);
      const symbol = isNative ? "ETN" : row.currency?.symbol ?? "TOKEN";
      const priceLabel = `${formatNumber(Number(human))} ${symbol}`;

      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        contract: row.nft.contract,
        tokenId: row.nft.tokenId,
        name: row.nft.name,
        media: row.nft.imageUrl,
        standard: row.nft.standard,
        quantity: row.quantity,
        seller: row.sellerAddress,

        // kept for compatibility with your client (plain string, not abbreviated)
        price: human,
        currency: {
          symbol,
          decimals,
          tokenAddress: row.currency?.tokenAddress ?? null,
          kind: row.currency?.kind ?? "NATIVE",
        },

        // ✅ new: ready-to-render label consistent with spotlight
        priceLabel,

        href: `/collections/${row.nft.contract}/${row.nft.tokenId}`,
      };
    });

    const nextCursor =
      results.length === pageSize
        ? `${results[results.length - 1].createdAt.toISOString()}|${results[results.length - 1].id}`
        : null;

    return NextResponse.json({ ok: true, items, nextCursor });
  } catch (e: any) {
    console.error("[GET /api/listings/fixed] error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
