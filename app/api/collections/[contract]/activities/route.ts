// app/api/collections/[contract]/activities/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

/**
 * Collection Activities Feed (server)
 * -----------------------------------
 * Aggregates *all* activity rows tied to any NFT in a collection:
 *  - Canonical sales (MarketplaceSale)  → type: "Sale"
 *  - App/chain activities (NFTActivity) → type: "Listing" | "Unlisting" | "Transfer" | "Bid" | "Mint" | "Auction"...
 *  - Listing lifecycle (MarketplaceListing)             → "Listing" (create), "Unlisting" (cancel/expire)
 *  - Auction lifecycle (Auction, AuctionBid)            → "Auction Create" | "Auction Finalize" | "Bid"
 *
 * Response is normalized and chronologically sorted (DESC), with cursor pagination.
 * Currency-aware rendering happens by resolving token decimals/symbols before formatting.
 */

const ETN_DECIMALS = 18;

const isRealHash = (h?: string) => /^0x[0-9a-fA-F]{64}$/.test(String(h || ""));

function toTitle(s: string) {
  return s ? s.slice(0, 1).toUpperCase() + s.slice(1).toLowerCase() : s;
}

function canonType(input: string): string {
  const t = input?.toUpperCase?.() || "";
  switch (t) {
    case "LISTED":
    case "LISTING":
      return "LISTING";
    case "UNLISTING":
    case "CANCELLED_LISTING":
    case "CANCELLED_AUCTION":
    case "EXPIRED":
      return "UNLISTING";
    case "SALE":
      return "SALE";
    case "TRANSFER":
      return "TRANSFER";
    case "BID":
      return "BID";
    case "MINT":
      return "MINT";
    case "AUCTION":
    case "AUCTION_CREATE":
    case "AUCTION_STARTED":
      return "AUCTION_CREATE";
    case "AUCTION_FINALIZE":
    case "AUCTION_ENDED":
      return "AUCTION_FINALIZE";
    default:
      return t || "TRANSFER";
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

function priceFromActivityRow(
  row: any,
  currenciesByAddr: Map<string, CurrencyMeta>,
  currenciesById: Map<string, CurrencyMeta>
) {
  // Native ETN first
  if (row.priceEtnWei != null) {
    const wei = typeof row.priceEtnWei === "string" ? row.priceEtnWei : String(row.priceEtnWei);
    return { amount: decimalStrToFloat(wei, ETN_DECIMALS), symbol: "ETN" as const };
  }

  const raw = (row.rawData ?? {}) as any;

  // New (ID-based) shape
  if (raw?.currencyId && raw?.priceTokenAmount != null) {
    const meta = currenciesById.get(String(raw.currencyId));
    if (meta) {
      return {
        amount: decimalStrToFloat(String(raw.priceTokenAmount), meta.decimals),
        symbol: meta.symbol,
      };
    }
  }

  // Legacy (address-based) shape
  if (raw?.currencyAddress && raw?.amountWei != null) {
    const addr = String(raw.currencyAddress).toLowerCase();
    const meta = currenciesByAddr.get(addr);
    if (meta) {
      return {
        amount: decimalStrToFloat(String(raw.amountWei), meta.decimals),
        symbol: meta.symbol,
      };
    }
  }

  return { amount: null as number | null, symbol: null as string | null };
}

type UiRow = {
  id: string;
  type: string;
  tokenId: string;
  nftName?: string | null;
  imageUrl?: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  price: number | null;
  currencySymbol?: string | null;
  timestamp: string; // ISO
  txHash: string; // blank → no link
  marketplace?: string | null;
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ contract: string }> }
) {
  await prismaReady;

  const { contract } = await context.params;
  if (!contract) return NextResponse.json({ error: "Missing contract" }, { status: 400 });

  const url = new URL(req.url);

  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") ?? "30", 10)));

  // optional filters
  const typeFilter = (url.searchParams.get("type") || "").toUpperCase(); // e.g., SALE | LISTING | BID | TRANSFER ...
  const walletFilter = (url.searchParams.get("wallet") || "").toLowerCase(); // from/to contains
  const currencyIdFilter = url.searchParams.get("currencyId") || null;
  const fromISO = url.searchParams.get("from");
  const toISO = url.searchParams.get("to");

  // cursor = base64({ ts, id })
  const cursorB64 = url.searchParams.get("cursor");
  let cursorTs: string | null = null;
  let cursorId: string | null = null;
  if (cursorB64) {
    try {
      const d = JSON.parse(Buffer.from(cursorB64, "base64").toString("utf8"));
      cursorTs = d?.ts || null;
      cursorId = d?.id || null;
    } catch {
      // ignore bad cursor
    }
  }

  try {
    // Resolve canonical contract & prefetch NFT map (name/image by id)
    const collection = await prisma.collection.findFirst({
      where: { contract: { equals: contract, mode: "insensitive" } },
      select: { contract: true },
    });
    if (!collection) return NextResponse.json({ items: [], nextCursor: null });

    const canon = collection.contract;

    // Currency catalog (for price rendering)
    const allCurrencies = await prisma.currency.findMany({
      select: { id: true, tokenAddress: true, symbol: true, decimals: true, active: true },
    });
    const currenciesByAddr = new Map<string, CurrencyMeta>();
    const currenciesById = new Map<string, CurrencyMeta>();
    for (const c of allCurrencies) {
      const meta = { symbol: c.symbol, decimals: c.decimals ?? 18 };
      if (c.tokenAddress) currenciesByAddr.set(String(c.tokenAddress).toLowerCase(), meta);
      currenciesById.set(c.id, meta);
    }

    // Time bounds
    const timeWhere: any = {};
    if (fromISO) timeWhere.gte = new Date(fromISO);
    if (toISO) timeWhere.lte = new Date(toISO);

    // --- 1) Canonical sales (MarketplaceSale) — joined to NFT for tokenId/name/image
    const saleRows = await prisma.marketplaceSale.findMany({
      where: {
        nft: { contract: { equals: canon, mode: "insensitive" } },
        ...(Object.keys(timeWhere).length ? { timestamp: timeWhere } : {}),
        ...(currencyIdFilter ? { currencyId: currencyIdFilter } : {}),
      },
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        buyerAddress: true,
        sellerAddress: true,
        priceEtnWei: true,
        priceTokenAmount: true,
        currencyId: true,
        timestamp: true,
        txHash: true,
        logIndex: true,
        nft: { select: { tokenId: true, name: true, imageUrl: true } },
      },
    });

    const mappedSales: UiRow[] = saleRows
      .map((s) => {
        // price
        let amount: number | null = null;
        let symbol: string | null = null;
        if (s.priceTokenAmount != null && s.currencyId) {
          const meta = currenciesById.get(s.currencyId);
          if (meta) {
            amount = decimalStrToFloat(String(s.priceTokenAmount), meta.decimals);
            symbol = meta.symbol;
          }
        } else if (s.priceEtnWei != null) {
          amount = decimalStrToFloat(String(s.priceEtnWei), ETN_DECIMALS);
          symbol = "ETN";
        }

        return {
          id: `sale-${s.id}`,
          type: "Sale",
          tokenId: s.nft.tokenId,
          nftName: s.nft.name,
          imageUrl: s.nft.imageUrl,
          fromAddress: s.sellerAddress,
          toAddress: s.buyerAddress,
          price: amount,
          currencySymbol: symbol,
          timestamp: s.timestamp.toISOString(),
          txHash: isRealHash(s.txHash) ? s.txHash : "",
          marketplace: "Panthart",
        };
      })
      .filter((row) =>
        walletFilter
          ? (row.fromAddress?.toLowerCase() ?? "").includes(walletFilter) ||
            (row.toAddress?.toLowerCase() ?? "").includes(walletFilter)
          : true
      );

    const saleHashSet = new Set<string>(
      mappedSales.map((r) => (isRealHash(r.txHash) ? r.txHash : "")).filter(Boolean)
    );

    // --- 2) App/chain activities (NFTActivity) at collection scope
    const actRows = await prisma.nFTActivity.findMany({
      where: {
        contract: { equals: canon, mode: "insensitive" },
        ...(Object.keys(timeWhere).length ? { timestamp: timeWhere } : {}),
      },
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit * 2, // we’ll dedupe vs sales; overfetch a bit
      select: {
        id: true,
        tokenId: true,
        type: true,
        fromAddress: true,
        toAddress: true,
        priceEtnWei: true,
        txHash: true,
        timestamp: true,
        marketplace: true,
        rawData: true,
        nft: { select: { name: true, imageUrl: true } },
      },
    });

    const mappedActs: UiRow[] = actRows
      .map((r) => {
        const priceMeta = priceFromActivityRow(r, currenciesByAddr, currenciesById);

        let uiType = canonType(r.type);
        // Soft-normalize some labels for UI
        if (uiType === "AUCTION_CREATE") {
          uiType = "AUCTION_CREATE";
        } else if (uiType === "AUCTION_FINALIZE") {
          uiType = "AUCTION_FINALIZE";
        }

        const tx = isRealHash(r.txHash) ? r.txHash : "";

        return {
          id: `act-${r.id}`,
          type: toTitle(
            uiType === "AUCTION_CREATE"
              ? "Auction Create"
              : uiType === "AUCTION_FINALIZE"
              ? "Auction Finalize"
              : uiType
          ),
          tokenId: r.tokenId,
          nftName: r.nft?.name ?? null,
          imageUrl: r.nft?.imageUrl ?? null,
          fromAddress: r.fromAddress,
          toAddress: r.toAddress,
          price: priceMeta.amount,
          currencySymbol: priceMeta.symbol,
          timestamp: r.timestamp.toISOString(),
          txHash: tx,
          marketplace: r.marketplace ?? null,
        };
      })
      .filter((row) => {
        // Drop synthetic Sale rows; keep canonical sales only
        if (row.type === "Sale" && !isRealHash(row.txHash)) return false;
        // Suppress Transfer rows that share a tx with a Sale
        if (row.type === "Transfer" && isRealHash(row.txHash) && saleHashSet.has(row.txHash)) {
          return false;
        }
        return true;
      })
      .filter((row) =>
        walletFilter
          ? (row.fromAddress?.toLowerCase() ?? "").includes(walletFilter) ||
            (row.toAddress?.toLowerCase() ?? "").includes(walletFilter)
          : true
      );

    // --- 3) Listing lifecycle (MarketplaceListing)
    // We treat:
    //  - create → "Listing" at startTime/createdAt
    //  - cancel/expire → "Unlisting" at updatedAt/endTime
    const listingRows = await prisma.marketplaceListing.findMany({
      where: {
        nft: { contract: { equals: canon, mode: "insensitive" } },
        ...(Object.keys(timeWhere).length ? { updatedAt: timeWhere } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        updatedAt: true,
        txHashCreated: true,
        txHashCancelled: true,
        sellerAddress: true,
        priceEtnWei: true,
        priceTokenAmount: true,
        currencyId: true,
        nft: { select: { tokenId: true, name: true, imageUrl: true } },
      },
    });

    const mappedListings: UiRow[] = listingRows
      .map((r) => {
        let type: "Listing" | "Unlisting";
        let when: Date;
        let tx = "";

        if (r.status === "ACTIVE") {
          type = "Listing";
          when = r.startTime ?? r.createdAt;
          tx = isRealHash(r.txHashCreated ?? undefined) ? r.txHashCreated ?? "" : "";
        } else if (r.status === "CANCELLED" || r.status === "EXPIRED" || r.status === "SOLD") {
          type = "Unlisting";
          when = r.endTime ?? r.updatedAt ?? r.createdAt;
          tx = isRealHash(r.txHashCancelled ?? undefined) ? r.txHashCancelled ?? "" : "";
        } else {
          return null;
        }

        // price
        let amount: number | null = null;
        let symbol: string | null = null;

        if (r.priceTokenAmount != null && r.currencyId) {
          const meta = currenciesById.get(r.currencyId);
          if (meta) {
            amount = decimalStrToFloat(String(r.priceTokenAmount), meta.decimals);
            symbol = meta.symbol;
          }
        } else if (r.priceEtnWei != null) {
          amount = decimalStrToFloat(String(r.priceEtnWei), ETN_DECIMALS);
          symbol = "ETN";
        }

        return {
          id: `list-${r.id}-${type}`,
          type,
          tokenId: r.nft.tokenId,
          nftName: r.nft.name,
          imageUrl: r.nft.imageUrl,
          fromAddress: r.sellerAddress,
          toAddress: null,
          price: amount,
          currencySymbol: symbol,
          timestamp: when.toISOString(),
          txHash: tx,
          marketplace: "Panthart",
        } satisfies UiRow;
      })
      .filter(Boolean) as UiRow[];

    // --- 4) Auction events (Auction + AuctionBid)
    const auctionRows = await prisma.auction.findMany({
      where: {
        nft: { contract: { equals: canon, mode: "insensitive" } },
        ...(Object.keys(timeWhere).length ? { updatedAt: timeWhere } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        updatedAt: true,
        sellerAddress: true,
        startPriceEtnWei: true,
        startPriceTokenAmount: true,
        currencyId: true,
        txHashCreated: true,
        txHashFinalized: true,
        nft: { select: { tokenId: true, name: true, imageUrl: true } },
      },
    });

    const mappedAuctions: UiRow[] = auctionRows
      .map((a) => {
        // create
        const create: UiRow = {
          id: `auc-${a.id}-create`,
          type: "Auction Create",
          tokenId: a.nft.tokenId,
          nftName: a.nft.name,
          imageUrl: a.nft.imageUrl,
          fromAddress: a.sellerAddress,
          toAddress: null,
          price:
            a.startPriceTokenAmount != null && a.currencyId
              ? (() => {
                  const meta = currenciesById.get(a.currencyId!);
                  return meta
                    ? decimalStrToFloat(String(a.startPriceTokenAmount), meta.decimals)
                    : null;
                })()
              : a.startPriceEtnWei != null
              ? decimalStrToFloat(String(a.startPriceEtnWei), ETN_DECIMALS)
              : null,
          currencySymbol:
            a.startPriceTokenAmount != null && a.currencyId
              ? currenciesById.get(a.currencyId!)?.symbol ?? null
              : a.startPriceEtnWei != null
              ? "ETN"
              : null,
          timestamp: (a.startTime ?? a.createdAt).toISOString(),
          txHash: isRealHash(a.txHashCreated ?? undefined) ? a.txHashCreated! : "",
          marketplace: "Panthart",
        };

        // finalize/cancel
        const finalize: UiRow | null =
          a.status === "ENDED" || a.status === "CANCELLED"
            ? {
                id: `auc-${a.id}-final`,
                type: a.status === "ENDED" ? "Auction Finalize" : "Unlisting",
                tokenId: a.nft.tokenId,
                nftName: a.nft.name,
                imageUrl: a.nft.imageUrl,
                fromAddress: a.sellerAddress,
                toAddress: null,
                price: null,
                currencySymbol: null,
                timestamp: (a.endTime ?? a.updatedAt ?? a.createdAt).toISOString(),
                txHash: isRealHash(a.txHashFinalized ?? undefined) ? a.txHashFinalized! : "",
                marketplace: "Panthart",
              }
            : null;

        return [create, finalize].filter(Boolean) as UiRow[];
      })
      .flat();

    const bidRows = await prisma.auctionBid.findMany({
      where: {
        auction: { nft: { contract: { equals: canon, mode: "insensitive" } } },
        ...(Object.keys(timeWhere).length ? { timestamp: timeWhere } : {}),
        ...(currencyIdFilter ? { currencyId: currencyIdFilter } : {}),
      },
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        bidderAddress: true,
        amountWei: true, // for native or token (we keep currencyId to interpret)
        currencyId: true,
        timestamp: true,
        txHash: true,
        auction: { select: { nft: { select: { tokenId: true, name: true, imageUrl: true } } } },
      },
    });

    const mappedBids: UiRow[] = bidRows.map((b) => {
      // Interpret amountWei using currencyId (if null → it's native ETN)
      const isToken = Boolean(b.currencyId);
      const amount = decimalStrToFloat(
        String(b.amountWei),
        isToken ? currenciesById.get(b.currencyId!)?.decimals ?? 18 : ETN_DECIMALS
      );
      const symbol = isToken ? currenciesById.get(b.currencyId!)?.symbol ?? null : "ETN";

      return {
        id: `bid-${b.id}`,
        type: "Bid",
        tokenId: b.auction.nft.tokenId,
        nftName: b.auction.nft.name,
        imageUrl: b.auction.nft.imageUrl,
        fromAddress: b.bidderAddress,
        toAddress: null,
        price: amount,
        currencySymbol: symbol,
        timestamp: b.timestamp.toISOString(),
        txHash: isRealHash(b.txHash) ? b.txHash : "",
        marketplace: "Panthart",
      };
    });

    // --- Merge, filter by type/wallet if requested, sort, paginate w/ cursor
    const merged = [
      ...mappedSales,
      ...mappedActs,
      ...mappedListings,
      ...mappedAuctions,
      ...mappedBids,
    ];

    // Type filter (matches normalized UI label)
    const filteredByType = typeFilter
      ? merged.filter((r) => r.type.toUpperCase().replace(/\s+/g, "_") === typeFilter)
      : merged;

    // Wallet filter is already applied to some branches; re-apply globally for safety
    const fullyFiltered = walletFilter
      ? filteredByType.filter(
          (r) =>
            (r.fromAddress?.toLowerCase() ?? "").includes(walletFilter) ||
            (r.toAddress?.toLowerCase() ?? "").includes(walletFilter)
        )
      : filteredByType;

    // Sort DESC
    fullyFiltered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Cursor filter (apply AFTER sort)
    const afterCursor =
      cursorTs && cursorId
        ? fullyFiltered.filter(
            (row) =>
              new Date(row.timestamp).getTime() < new Date(cursorTs!).getTime() ||
              (row.timestamp === cursorTs && row.id < cursorId!)
          )
        : fullyFiltered;

    const page = afterCursor.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      page.length === limit && last
        ? Buffer.from(JSON.stringify({ ts: last.timestamp, id: last.id }), "utf8").toString(
            "base64"
          )
        : null;

    return NextResponse.json(
      { items: page, nextCursor },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[GET /api/collections/[contract]/activities]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
