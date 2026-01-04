// app/api/profile/[address]/activity/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

const ETN_DECIMALS = 18;

/* ----------------------------- helpers ----------------------------- */
const isRealHash = (h?: string) => /^0x[0-9a-fA-F]{64}$/.test(String(h || ""));
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
function decimalStrToFloat(decStr: string, decimals: number) {
  try {
    const n = BigInt(decStr);
    const base = 10n ** BigInt(decimals);
    const whole = Number(n / base);
    const frac = Number(n % base) / Number(base);
    return +(whole + frac).toFixed(6);
  } catch {
    return NaN;
  }
}

type CurrencyMeta = { symbol: string; decimals: number };

function canonTypeToUiKind(t: string, me: string, from?: string | null, to?: string | null): string {
  const up = t?.toUpperCase?.() || "";
  switch (up) {
    case "LISTING":
    case "LISTED":
      return "LISTED";
    case "UNLISTING":
    case "CANCELLED_LISTING":
      return "CANCELLED";
    case "SALE":
      return "SALE";
    case "BID":
      return "BID";
    case "MINT":
      return "MINT";
    case "AUCTION":
    case "AUCTION_STARTED":
      return "LISTED";
    case "CANCELLED_AUCTION":
      return "CANCELLED";
    case "TRANSFER":
    default:
      if (from && from.toLowerCase() === me.toLowerCase()) return "TRANSFER_OUT";
      if (to && to.toLowerCase() === me.toLowerCase()) return "TRANSFER_IN";
      return "TRANSFER_IN";
  }
}

/* ------------------------------- GET ------------------------------- */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> }
) {
  await prismaReady;
  const { address } = await ctx.params;

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 20));
  const offset = decodeOffsetCursor(url.searchParams.get("cursor"));
  const typeFilter = (url.searchParams.get("type") || "").toUpperCase() || null;

  // currencies
  const allCurrencies = await prisma.currency.findMany({
    select: { id: true, tokenAddress: true, symbol: true, decimals: true, active: true },
  });
  const currenciesById = new Map<string, CurrencyMeta>();
  const currenciesByAddr = new Map<string, CurrencyMeta>();
  for (const c of allCurrencies) {
    const meta = { symbol: c.symbol, decimals: c.decimals ?? 18 };
    currenciesById.set(c.id, meta);
    if (c.tokenAddress) currenciesByAddr.set(String(c.tokenAddress).toLowerCase(), meta);
  }

  /* ------------------ Canonical SALES first (for suppression) ------------------ */
  const saleRows = await prisma.marketplaceSale.findMany({
    where: {
      OR: [
        { buyerAddress: { equals: address, mode: "insensitive" } },
        { sellerAddress: { equals: address, mode: "insensitive" } },
      ],
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: 400,
    select: {
      id: true,
      priceEtnWei: true,
      priceTokenAmount: true,
      currencyId: true,
      timestamp: true,
      txHash: true,
      nft: { select: { contract: true, tokenId: true, name: true, imageUrl: true } },
    },
  });

  const mappedSales = saleRows.map((s) => {
    let amount: number | null = null;
    let symbol: string | null = null;
    if (s.priceTokenAmount != null && s.currencyId) {
      const meta = currenciesById.get(s.currencyId);
      amount = decimalStrToFloat((s.priceTokenAmount as any).toString(), meta?.decimals ?? 18);
      symbol = meta?.symbol ?? null;
    } else if (s.priceEtnWei != null) {
      amount = decimalStrToFloat((s.priceEtnWei as any).toString(), ETN_DECIMALS);
      symbol = "ETN";
    }
    return {
      id: `sale-${s.id}`,
      kind: "SALE",
      nft: {
        contract: s.nft.contract,
        tokenId: s.nft.tokenId,
        name: s.nft.name ?? null,
        imageUrl: s.nft.imageUrl ?? null,
      },
      price: amount,
      currencySymbol: symbol,
      txHash: isRealHash(s.txHash) ? s.txHash : "",
      timestamp: s.timestamp.toISOString(),
    };
  });

  const saleHashSet = new Set<string>(
    mappedSales.map((r) => (isRealHash(r.txHash) ? r.txHash : "")).filter(Boolean)
  );

  /* ------------------ NFTActivity (suppress dupes vs. sales) ------------------ */
  const actRows = await prisma.nFTActivity.findMany({
    where: {
      OR: [
        { fromAddress: { equals: address, mode: "insensitive" } },
        { toAddress: { equals: address, mode: "insensitive" } },
      ],
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: 500,
    select: {
      id: true,
      type: true,
      fromAddress: true,
      toAddress: true,
      priceEtnWei: true,
      txHash: true,
      timestamp: true,
      rawData: true,
      contract: true,
      tokenId: true,
      nft: { select: { name: true, imageUrl: true } },
    },
  });

  function priceFromActivityRow(row: any) {
    if (row.priceEtnWei != null) {
      return { amount: decimalStrToFloat(String(row.priceEtnWei), ETN_DECIMALS), symbol: "ETN" as const };
    }
    const raw = (row.rawData ?? {}) as any;
    if (raw?.currencyId && raw?.priceTokenAmount != null) {
      const meta = currenciesById.get(String(raw.currencyId));
      if (meta) {
        return {
          amount: decimalStrToFloat(String(raw.priceTokenAmount), meta.decimals),
          symbol: meta.symbol,
        };
      }
    }
    if (raw?.currencyAddress && raw?.amountWei != null) {
      const meta = currenciesByAddr.get(String(raw.currencyAddress).toLowerCase());
      if (meta) {
        return {
          amount: decimalStrToFloat(String(raw.amountWei), meta.decimals),
          symbol: meta.symbol,
        };
      }
    }
    return { amount: null as number | null, symbol: null as string | null };
  }

  const mappedActs = actRows
    .map((r) => {
      const p = priceFromActivityRow(r);
      const kind = canonTypeToUiKind(r.type, address, r.fromAddress, r.toAddress);
      const tx = isRealHash(r.txHash) ? r.txHash : "";

      // drop synthetic SALE rows (keep canonical sale list only)
      if (kind === "SALE" && !tx) return null;

      // suppress transfers that are part of a sale tx
      if ((kind === "TRANSFER_IN" || kind === "TRANSFER_OUT") && tx && saleHashSet.has(tx)) {
        return null;
      }

      return {
        id: `act-${r.id}`,
        kind,
        nft: {
          contract: r.contract,
          tokenId: r.tokenId,
          name: r.nft?.name ?? null,
          imageUrl: r.nft?.imageUrl ?? null,
        },
        price: p.amount,
        currencySymbol: p.symbol,
        txHash: tx,
        timestamp: r.timestamp.toISOString(),
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      kind: string;
      nft: { contract: string; tokenId: string; name?: string | null; imageUrl?: string | null };
      price: number | null;
      currencySymbol?: string | null;
      txHash: string;
      timestamp: string;
    }>;

  /* ------------------ Bids by user ------------------ */
  const bidRows = await prisma.auctionBid.findMany({
    where: { bidderAddress: { equals: address, mode: "insensitive" } },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: 400,
    select: {
      id: true,
      amountWei: true,
      currencyId: true,
      timestamp: true,
      txHash: true,
      auction: {
        select: {
          status: true,
          highestBidder: true,
          nft: { select: { contract: true, tokenId: true, name: true, imageUrl: true } },
        },
      },
    },
  });

  const mappedBids = bidRows.map((b) => {
    const meta = b.currencyId ? currenciesById.get(b.currencyId) : { symbol: "ETN", decimals: ETN_DECIMALS };
    return {
      id: `bid-${b.id}`,
      kind: "BID",
      nft: {
        contract: b.auction.nft.contract,
        tokenId: b.auction.nft.tokenId,
        name: b.auction.nft.name ?? null,
        imageUrl: b.auction.nft.imageUrl ?? null,
      },
      price: decimalStrToFloat((b.amountWei as any).toString(), meta?.decimals ?? ETN_DECIMALS),
      currencySymbol: meta?.symbol ?? "ETN",
      txHash: isRealHash(b.txHash) ? b.txHash : "",
      timestamp: b.timestamp.toISOString(),
    };
  });

  /* ------------------ Merge, de-dupe, filter, paginate ------------------ */
  // de-dupe key prefers real tx hash if present
  const seen = new Set<string>();
  const merged: Array<{
    id: string;
    kind: string;
    nft: { contract: string; tokenId: string; name?: string | null; imageUrl?: string | null };
    price: number | null;
    currencySymbol?: string | null;
    txHash: string;
    timestamp: string;
  }> = [];

  for (const row of [...mappedSales, ...mappedActs, ...mappedBids]) {
    const key = isRealHash(row.txHash)
      ? `${row.kind}|${row.txHash}`
      : `${row.kind}|${row.timestamp}|${row.nft.contract}|${row.nft.tokenId}|${row.price ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  if (typeFilter) {
    merged.splice(0, merged.length, ...merged.filter((r) => r.kind === typeFilter));
  }

  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const slice = merged.slice(offset, offset + limit);
  const nextCursor = offset + limit < merged.length ? encodeOffsetCursor(offset + limit) : null;

  return NextResponse.json(
    { activities: slice, nextCursor },
    { headers: { "Cache-Control": "no-store" } }
  );
}
