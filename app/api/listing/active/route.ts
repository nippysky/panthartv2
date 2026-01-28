/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/listing/active/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma, { prismaReady } from "@/src/lib/db";
import { CurrencyKind, ListingStatus } from "@/src/lib/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

function lower(s?: string | null) {
  return (s ?? "").toLowerCase();
}

/** Expand scientific-notation numbers to a plain integer string (positive exponents). */
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
      const split = fracPart.length + needed; // needed is negative
      return (sign + intPart + fracPart.slice(0, split)).replace(
        /^(-?)0+(\d)/,
        "$1$2"
      );
    }
  }

  // value < 1; for base units we return "0"
  return "0";
}

/** Convert Prisma Decimal / string / number to BigInt safely (no scientific notation). */
function toBigIntSafe(x: any): bigint | null {
  if (x == null) return null;

  // Prisma Decimal: prefer toFixed(0) to avoid exponent output
  if (typeof x === "object" && typeof x.toFixed === "function") {
    const s = x.toFixed(0);
    return BigInt(s.replace(/^0+$/, "0"));
  }

  let s = String(x).trim();
  if (/e/i.test(s)) s = expandSciToIntegerString(s);
  s = s.replace(/\..*$/, ""); // drop any fractional part
  s = s.replace(/^[-+]?0+(?=\d)/, (m) => (m.startsWith("-") ? "-" : "")); // strip leading zeros
  if (s === "" || s === "-" || s === "+") s = "0";
  return BigInt(s);
}

function pow10BigInt(decimals: number): bigint {
  let p = BigInt(1);
  for (let i = 0; i < decimals; i++) p *= BigInt(10);
  return p;
}

/** UI-friendly decimal string (no Number overflow) */
function formatUnitsSafe(wei: bigint, decimals: number): string {
  if (decimals <= 0) return wei.toString();
  const base = pow10BigInt(decimals);
  const whole = wei / base;
  const frac = wei % base;

  if (frac === BigInt(0)) return whole.toString();

  let fracStr = frac.toString().padStart(decimals, "0");
  // trim trailing zeros
  fracStr = fracStr.replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

function getRpcUrl() {
  return (
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://rpc.ankr.com/electroneum"
  );
}

function getMarketplaceAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;
  if (!addr || !ethers.isAddress(addr)) {
    throw new Error("Missing NEXT_PUBLIC_MARKETPLACE_ADDRESS (valid 0x address).");
  }
  return addr as `0x${string}`;
}

const MARKET_ABI = [
  "function listings(uint256 listingId) view returns (address seller,address token,uint256 tokenId,uint256 quantity,uint8 standard,address currency,uint256 price,uint64 startTime,uint64 endTime,bool active)",
] as const;

// singleton-ish (per server instance)
let _provider: ethers.JsonRpcProvider | null = null;
let _market: ethers.Contract | null = null;

function getMarket() {
  if (_market) return _market;
  _provider = _provider ?? new ethers.JsonRpcProvider(getRpcUrl());
  _market = new ethers.Contract(getMarketplaceAddress(), MARKET_ABI, _provider);
  return _market;
}

type DbRow = {
  id: string;
  startTime: Date;
  endTime: Date | null;
  sellerAddress: string | null;
  quantity: number | null;
  priceEtnWei: any;
  priceTokenAmount: any;
  currency: {
    id: string;
    symbol: string | null;
    decimals: number | null;
    kind: CurrencyKind;
    tokenAddress: string | null;
  } | null;
  nft: {
    contract: string;
    tokenId: string;
    name: string | null;
    imageUrl: string | null;
    standard: string | null;
    owner: { walletAddress: string | null } | null;
  };
};

async function chainTruthForListing(row: DbRow) {
  const market = getMarket();

  // listing id MUST be numeric string
  let listingId: bigint;
  try {
    listingId = BigInt(String(row.id));
  } catch {
    return null;
  }

  // read on-chain struct
  const L = await market.listings(listingId).catch(() => null);
  if (!L) return null;

  const seller = String(L[0] ?? "");
  const tokenAddr = String(L[1] ?? "");
  const tokenId = (L[2] as bigint) ?? BigInt(0);
  const qty = (L[3] as bigint) ?? BigInt(0);
  const currencyAddr = String(L[5] ?? "");
  const price = (L[6] as bigint) ?? BigInt(0);
  const start = Number(L[7] as bigint);
  const end = Number(L[8] as bigint);
  const active = Boolean(L[9]);

  // must be active on-chain
  if (!active) return null;

  // must match token
  if (lower(tokenAddr) !== lower(row.nft.contract)) return null;
  if (tokenId.toString() !== String(row.nft.tokenId)) return null;

  const now = Math.floor(Date.now() / 1000);
  const isLive = now >= start && (end === 0 || now <= end);

  return {
    listingIdStr: listingId.toString(),
    sellerAddress: seller && ethers.isAddress(seller) ? seller : row.sellerAddress,
    quantity: qty > BigInt(0) ? Number(qty) : Number(row.quantity ?? 1),
    currencyAddr: currencyAddr && ethers.isAddress(currencyAddr) ? currencyAddr : null,
    priceWei: price,
    startTimeISO: new Date(start * 1000).toISOString(),
    endTimeISO: end === 0 ? null : new Date(end * 1000).toISOString(),
    isLive,
  };
}

export async function GET(req: NextRequest) {
  await prismaReady;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 24), 60);
  const cursor = searchParams.get("cursor");

  // ✅ strict truth filter: for ERC721, seller MUST equal current DB owner
  const strictOwner = searchParams.get("strictOwner") === "1";

  // optional filters
  const contractParam = searchParams.get("contract") || undefined;
  const tokenIdParam = searchParams.get("tokenId") || undefined;

  // fast-path count
  const countOnly = searchParams.get("count") === "1";

  // chain-truth is auto-enabled for token page requests (strictOwner + token filter)
  const chainTruth =
    searchParams.get("chain") === "1" || (strictOwner && !!contractParam && !!tokenIdParam);

  try {
    const whereBase: any = {
      status: ListingStatus.ACTIVE,
      OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
    };

    if (contractParam || tokenIdParam) {
      whereBase.nft = {};
      if (contractParam) {
        whereBase.nft.contract = {
          equals: contractParam,
          mode: "insensitive" as const,
        };
      }
      if (tokenIdParam) {
        whereBase.nft.tokenId = tokenIdParam;
      }
    }

    if (countOnly) {
      const count = await prisma.marketplaceListing.count({ where: whereBase });
      return NextResponse.json({ count });
    }

    const rows = (await prisma.marketplaceListing.findMany({
      where: whereBase,
      orderBy: { startTime: "desc" },
      take: limit + 1,
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
            owner: { select: { walletAddress: true } },
          },
        },
      },
    })) as unknown as DbRow[];

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, -1) : rows;

    // If chainTruth is enabled, validate each candidate (token page is usually limit=1)
    const truthResults = chainTruth
      ? await Promise.all(
          page.map(async (l) => {
            try {
              const truth = await chainTruthForListing(l);
              return { row: l, truth };
            } catch {
              return { row: l, truth: null as any };
            }
          })
        )
      : page.map((l) => ({ row: l, truth: null as any }));

    const filtered = truthResults
      .filter(({ row, truth }) => {
        // if chainTruth enabled, drop non-truthy entries
        if (chainTruth && !truth) return false;

        if (!strictOwner) return true;

        const std = (row.nft.standard ?? "ERC721").toUpperCase();
        if (std === "ERC1155") return true;

        const ownerWallet = row.nft.owner?.walletAddress ?? null;
        if (!ownerWallet) return false;

        const seller = chainTruth ? (truth!.sellerAddress ?? row.sellerAddress) : row.sellerAddress;
        return lower(seller) === lower(ownerWallet);
      })
      .map(({ row, truth }) => {
        // currency resolution
        const chainCurrencyAddr = truth?.currencyAddr ?? null;
        const chainIsNative = !chainCurrencyAddr || chainCurrencyAddr === ethers.ZeroAddress;

        // If chain currency is ERC20, try to align decimals/symbol from DB currency (best-effort)
        const dbCur = row.currency;
        const dbIsNative = (dbCur?.kind ?? CurrencyKind.NATIVE) === CurrencyKind.NATIVE;

        const isNative = chainTruth ? chainIsNative : dbIsNative;

        const decimals = isNative ? 18 : dbCur?.decimals ?? 18;
        const symbol = isNative ? "ETN" : dbCur?.symbol ?? "ERC20";
        const tokenAddress = isNative ? null : (dbCur?.tokenAddress ?? chainCurrencyAddr);

        // price resolution
        const qty = Number(truth?.quantity ?? Number(row.quantity ?? 1)) || 1;

        const totalWei =
          chainTruth && truth?.priceWei != null
            ? (truth.priceWei as bigint)
            : toBigIntSafe(isNative ? row.priceEtnWei : row.priceTokenAmount);

        const unitWei = totalWei != null && qty > 0 ? totalWei / BigInt(qty) : null;

        const startISO = chainTruth ? truth!.startTimeISO : row.startTime.toISOString();
        const endISO = chainTruth ? truth!.endTimeISO : row.endTime ? row.endTime.toISOString() : null;

        const now = Date.now();
        const isLive =
          chainTruth
            ? Boolean(truth!.isLive)
            : (() => {
                const startMs = row.startTime.getTime();
                const endMs = row.endTime ? row.endTime.getTime() : null;
                return now >= startMs && (!endMs || now <= endMs);
              })();

        const sellerAddr = chainTruth ? (truth!.sellerAddress ?? row.sellerAddress) : row.sellerAddress;

        return {
          id: row.id,
          nft: {
            contract: row.nft.contract,
            tokenId: row.nft.tokenId,
            name:
              row.nft.name ??
              `${row.nft.contract.slice(0, 6)}…${row.nft.contract.slice(-4)} #${row.nft.tokenId}`,
            image: row.nft.imageUrl,
            standard: row.nft.standard ?? "ERC721",
          },
          startTime: startISO,
          endTime: endISO,
          isLive,
          currency: {
            id: dbCur?.id ?? null,
            kind: isNative ? "NATIVE" : "ERC20",
            symbol,
            decimals,
            tokenAddress: tokenAddress ?? null,
          },
          price: {
            unitWei: unitWei != null ? unitWei.toString() : null,
            unit: unitWei != null ? formatUnitsSafe(unitWei, decimals) : null,
            totalWei: totalWei != null ? totalWei.toString() : null,
            total: totalWei != null ? formatUnitsSafe(totalWei, decimals) : null,
          },
          sellerAddress: sellerAddr,
          quantity: qty,
        };
      });

    const nextCursor = hasMore ? rows[rows.length - 1].id : null;
    return NextResponse.json({ items: filtered, nextCursor });
  } catch (e) {
    console.error("[api listing active] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
