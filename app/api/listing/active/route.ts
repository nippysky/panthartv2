/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/listing/active/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import prisma, { prismaReady } from "@/src/lib/db";
import { CurrencyKind, ListingStatus } from "@/src/lib/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

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
      return (sign + intPart + fracPart + "0".repeat(needed)).replace(/^(-?)0+(\d)/, "$1$2");
    } else {
      const split = fracPart.length + needed;
      return (sign + intPart + fracPart.slice(0, split)).replace(/^(-?)0+(\d)/, "$1$2");
    }
  }

  return "0";
}

/** Convert Prisma Decimal / string / number to BigInt safely (no scientific notation). */
function toBigIntSafe(x: any): bigint | null {
  if (x == null) return null;

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

/** UI-friendly decimal string (no Number overflow) */
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

function getRpcUrl() {
  return process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.ankr.com/electroneum";
}

function getMarketplaceAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;
  if (!addr || !ethers.isAddress(addr)) {
    throw new Error("Missing NEXT_PUBLIC_MARKETPLACE_ADDRESS (valid 0x address).");
  }
  return addr as `0x${string}`;
}

let _provider: ethers.JsonRpcProvider | null = null;
let _market: ethers.Contract | null = null;

const MARKET_IFACE = new ethers.Interface(MARKETPLACE_CORE_ABI as any);

function getProvider() {
  _provider = _provider ?? new ethers.JsonRpcProvider(getRpcUrl());
  return _provider;
}

function getMarket() {
  if (_market) return _market;
  const provider = getProvider();
  _market = new ethers.Contract(getMarketplaceAddress(), MARKETPLACE_CORE_ABI as any, provider);
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
  txHashCreated: string | null;

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

/**
 * In-memory cache for txHashCreated -> listingId.
 */
const LISTING_ID_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const listingIdByTxHash = new Map<string, { id: bigint; ts: number }>();

function getCachedListingId(txHash: string): bigint | null {
  const key = txHash.toLowerCase();
  const hit = listingIdByTxHash.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > LISTING_ID_CACHE_TTL_MS) {
    listingIdByTxHash.delete(key);
    return null;
  }
  return hit.id;
}

function setCachedListingId(txHash: string, id: bigint) {
  const key = txHash.toLowerCase();
  listingIdByTxHash.set(key, { id, ts: Date.now() });
}

async function resolveChainListingIdFromTx(row: DbRow): Promise<bigint | null> {
  const txHash = (row.txHashCreated || "").trim();
  if (!txHash || !ethers.isHexString(txHash, 32)) return null;

  const cached = getCachedListingId(txHash);
  if (cached != null) return cached;

  const provider = getProvider();
  const receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
  if (!receipt) return null;

  const marketAddr = lower(getMarketplaceAddress());
  const wantContract = lower(row.nft.contract);
  const wantTokenId = String(row.nft.tokenId);

  for (const lg of receipt.logs || []) {
    if (lower(lg.address) !== marketAddr) continue;

    try {
      const parsed = MARKET_IFACE.parseLog({
        topics: lg.topics as any,
        data: lg.data as any,
      });

      if (!parsed || parsed.name !== "ListingCreated") continue;

      const args: any = parsed.args;
      const listingIdRaw = args?.listingId;
      const tokenIdRaw = args?.tokenId;
      const token = String(args?.token ?? "");

      if (listingIdRaw == null || tokenIdRaw == null) continue;

      const listingId =
        typeof listingIdRaw === "bigint" ? listingIdRaw : BigInt(listingIdRaw.toString());
      const tokenId =
        typeof tokenIdRaw === "bigint" ? tokenIdRaw : BigInt(tokenIdRaw.toString());

      if (lower(token) !== wantContract) continue;
      if (tokenId.toString() !== wantTokenId) continue;

      setCachedListingId(txHash, listingId);
      return listingId;
    } catch {
      // ignore
    }
  }

  return null;
}

type ChainListingSnap = {
  listingId: bigint;
  listingIdStr: string;
  onchainActive: boolean | null;
  sellerAddress: string | null;
  quantity: number | null;
  currencyAddr: string | null;
  priceWei: bigint | null;
  startTimeISO: string | null;
  endTimeISO: string | null;
  isLive: boolean | null;
};

async function chainSnapshotForListing(row: DbRow): Promise<ChainListingSnap | null> {
  const market = getMarket();

  const listingId = await resolveChainListingIdFromTx(row);
  if (!listingId) return null;

  const base: ChainListingSnap = {
    listingId,
    listingIdStr: listingId.toString(),
    onchainActive: null,
    sellerAddress: row.sellerAddress ?? null,
    quantity: row.quantity ?? 1,
    currencyAddr: null,
    priceWei: null,
    startTimeISO: null,
    endTimeISO: null,
    isLive: null,
  };

  const L = await market.listings(listingId).catch(() => null);
  if (!L) return base;

  const seller = String(L[0] ?? "");
  const tokenAddr = String(L[1] ?? "");
  const tokenId = (L[2] as bigint) ?? BigInt(0);
  const qty = (L[3] as bigint) ?? BigInt(0);
  const currencyAddr = String(L[5] ?? "");
  const price = (L[6] as bigint) ?? BigInt(0);
  const start = Number(L[7] as bigint);
  const end = Number(L[8] as bigint);
  const active = Boolean(L[9]);

  if (lower(tokenAddr) !== lower(row.nft.contract)) {
    return { ...base, onchainActive: false, sellerAddress: null };
  }
  if (tokenId.toString() !== String(row.nft.tokenId)) {
    return { ...base, onchainActive: false, sellerAddress: null };
  }

  const now = Math.floor(Date.now() / 1000);
  const isLive = active && now >= start && (end === 0 || now <= end);

  return {
    listingId,
    listingIdStr: listingId.toString(),
    onchainActive: active,
    sellerAddress:
      seller && ethers.isAddress(seller)
        ? ethers.getAddress(seller)
        : (row.sellerAddress ?? null),
    quantity: qty > BigInt(0) ? Number(qty) : Number(row.quantity ?? 1),
    currencyAddr:
      currencyAddr && ethers.isAddress(currencyAddr) ? ethers.getAddress(currencyAddr) : null,
    priceWei: price,
    startTimeISO: start > 0 ? new Date(start * 1000).toISOString() : row.startTime.toISOString(),
    endTimeISO: end === 0 ? null : new Date(end * 1000).toISOString(),
    isLive,
  };
}

export async function GET(req: NextRequest) {
  await prismaReady;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 24), 60);
  const cursor = searchParams.get("cursor");

  const strictOwner = searchParams.get("strictOwner") === "1";
  const contractParam = searchParams.get("contract") || undefined;
  const tokenIdParam = searchParams.get("tokenId") || undefined;
  const countOnly = searchParams.get("count") === "1";

  const preferChain = searchParams.get("chain") === "1" || (!!contractParam && !!tokenIdParam);
  const requireChain = searchParams.get("requireChain") === "1";

  try {
    const whereBase: any = {
      status: ListingStatus.ACTIVE,
      OR: [{ endTime: null }, { endTime: { gt: new Date() } }],
    };

    if (contractParam || tokenIdParam) {
      whereBase.nft = {};
      if (contractParam) {
        whereBase.nft.contract = { equals: contractParam, mode: "insensitive" as const };
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
        txHashCreated: true,
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

    const snaps = preferChain
      ? await Promise.all(
          page.map(async (row) => {
            try {
              return { row, snap: await chainSnapshotForListing(row) };
            } catch {
              return { row, snap: null as any };
            }
          })
        )
      : page.map((row) => ({ row, snap: null as any }));

    const filtered = snaps
      .filter(({ row, snap }) => {
        if (requireChain) {
          return Boolean(snap?.onchainActive === true);
        }

        if (!strictOwner) return true;

        const std = (row.nft.standard ?? "ERC721").toUpperCase();
        if (std === "ERC1155") return true;

        const ownerWallet = row.nft.owner?.walletAddress ?? null;
        if (!ownerWallet) return true;

        const seller = snap?.sellerAddress ?? row.sellerAddress;
        return lower(seller) === lower(ownerWallet);
      })
      .map(({ row, snap }) => {
        const dbCur = row.currency;

        const chainCurrencyAddr = snap?.currencyAddr ?? null;
        const chainIsNative = !chainCurrencyAddr || chainCurrencyAddr === ethers.ZeroAddress;
        const dbIsNative = (dbCur?.kind ?? CurrencyKind.NATIVE) === CurrencyKind.NATIVE;

        const isNative = snap?.currencyAddr != null ? chainIsNative : dbIsNative;

        const decimals = isNative ? 18 : dbCur?.decimals ?? 18;
        const symbol = isNative ? "ETN" : dbCur?.symbol ?? "ERC20";
        const tokenAddress = isNative ? null : dbCur?.tokenAddress ?? chainCurrencyAddr;

        const qty = Number(snap?.quantity ?? Number(row.quantity ?? 1)) || 1;

        const totalWei =
          snap?.priceWei != null
            ? snap.priceWei
            : toBigIntSafe(isNative ? row.priceEtnWei : row.priceTokenAmount);

        // IMPORTANT:
        // Contract stores listing.price as TOTAL listing price, not price-per-unit.
        const totalFormatted = totalWei != null ? formatUnitsSafe(totalWei, decimals) : null;

        const perItemWei =
          totalWei != null && qty > 0 ? totalWei / BigInt(qty) : null;

        const perItemFormatted =
          totalWei != null && qty > 1 ? formatUnitsSafe(perItemWei as bigint, decimals) : null;

        const startISO = snap?.startTimeISO ?? row.startTime.toISOString();
        const endISO = snap?.endTimeISO ?? (row.endTime ? row.endTime.toISOString() : null);

        const now = Date.now();
        const isLive =
          snap?.isLive != null
            ? Boolean(snap.isLive)
            : (() => {
                const startMs = row.startTime.getTime();
                const endMs = row.endTime ? row.endTime.getTime() : null;
                return now >= startMs && (!endMs || now <= endMs);
              })();

        const sellerAddr = snap?.sellerAddress ?? row.sellerAddress;
        const chainIdStr = snap?.listingIdStr ?? null;

        return {
          id: chainIdStr ?? row.id,
          dbId: row.id,
          chainId: chainIdStr,

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
          onchainActive: snap?.onchainActive ?? null,

          currency: {
            id: dbCur?.id ?? null,
            kind: isNative ? "NATIVE" : "ERC20",
            symbol,
            decimals,
            tokenAddress: tokenAddress ?? null,
          },

          price: {
            // keep backward compatibility:
            // unit/unitWei now mirror the ACTUAL listing price because that is what buy() uses.
            unitWei: totalWei != null ? totalWei.toString() : null,
            unit: totalFormatted,
            totalWei: totalWei != null ? totalWei.toString() : null,
            total: totalFormatted,

            // extra helper fields for better UI if needed
            perItemWei: perItemWei != null && qty > 1 ? perItemWei.toString() : null,
            perItem: perItemFormatted,
          },

          sellerAddress: sellerAddr,
          seller: {
            address: sellerAddr,
            username: null as string | null,
          },

          quantity: qty,
        };
      });

    const sellers = Array.from(
      new Set(
        filtered
          .map((x) => x.seller?.address ?? x.sellerAddress)
          .filter((a): a is string => typeof a === "string" && a.length > 0)
          .map((a) => a.toLowerCase())
      )
    );

    const users =
      sellers.length > 0
        ? await prisma.user.findMany({
            where: { walletAddress: { in: sellers } },
            select: { walletAddress: true, username: true },
          })
        : [];

    const userByWalletLC = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u.username || null]));

    const items = filtered.map((x) => {
      const addr = (x.seller?.address ?? x.sellerAddress) as string | null;
      const username = addr ? userByWalletLC.get(addr.toLowerCase()) ?? null : null;
      return {
        ...x,
        seller: {
          address: addr,
          username,
        },
      };
    });

    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;
    return NextResponse.json({ items, nextCursor });
  } catch (e) {
    console.error("[api listing active] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}