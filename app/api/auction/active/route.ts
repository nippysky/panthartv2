/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/auction/active/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import prisma, { prismaReady } from "@/src/lib/db";
import { AuctionStatus, CurrencyKind } from "@/src/lib/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

function lower(s?: string | null) {
  return (s ?? "").toLowerCase();
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
  endTime: Date;
  sellerAddress: string | null;
  quantity: number | null;

  startPriceEtnWei: any;
  highestBidEtnWei: any;
  startPriceTokenAmount: any;
  highestBidTokenAmount: any;

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

// --------------------
// ✅ Micro-opt cache: txHashCreated -> auctionId
// --------------------
const AUCTION_ID_BY_TX = new Map<string, { id: bigint; ts: number }>();
const AUCTION_ID_CACHE_MAX = 5000;
const AUCTION_ID_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheGetAuctionId(txHash: string): bigint | null {
  const key = txHash.toLowerCase();
  const hit = AUCTION_ID_BY_TX.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > AUCTION_ID_CACHE_TTL_MS) {
    AUCTION_ID_BY_TX.delete(key);
    return null;
  }
  return hit.id;
}

function cacheSetAuctionId(txHash: string, id: bigint) {
  const key = txHash.toLowerCase();
  AUCTION_ID_BY_TX.set(key, { id, ts: Date.now() });
  if (AUCTION_ID_BY_TX.size > AUCTION_ID_CACHE_MAX) {
    const entries = Array.from(AUCTION_ID_BY_TX.entries());
    entries.sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < Math.max(0, entries.length - AUCTION_ID_CACHE_MAX); i++) {
      AUCTION_ID_BY_TX.delete(entries[i][0]);
    }
  }
}

async function resolveChainAuctionIdFromTx(row: DbRow): Promise<bigint | null> {
  const txHash = (row.txHashCreated || "").trim();
  if (!txHash || !ethers.isHexString(txHash, 32)) return null;

  const cached = cacheGetAuctionId(txHash);
  // NOTE: bigint 0n is valid; don’t rely on truthiness
  if (cached !== null) return cached;

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

      if (!parsed || parsed.name !== "AuctionCreated") continue;

      const args: any = parsed.args;

      const auctionId = args?.auctionId as bigint | undefined;
      const token = String(args?.token ?? "");
      const tokenId = (args?.tokenId as bigint | undefined) ?? undefined;

      if (auctionId == null || tokenId == null) continue;

      if (lower(token) !== wantContract) continue;
      if (tokenId.toString() !== wantTokenId) continue;

      cacheSetAuctionId(txHash, auctionId);
      return auctionId;
    } catch {
      // ignore
    }
  }

  return null;
}

function toNumberLike(x: unknown, fallback = 0): number {
  try {
    if (typeof x === "number") return Number.isFinite(x) ? x : fallback;
    if (typeof x === "bigint") return Number(x);
    if (typeof x === "string" && x.trim()) return Number(x);
    return fallback;
  } catch {
    return fallback;
  }
}

async function chainTruthForAuction(row: DbRow, preResolvedAuctionId?: bigint | null) {
  const market = getMarket();

  const auctionId = preResolvedAuctionId ?? (await resolveChainAuctionIdFromTx(row));
  if (auctionId == null) return null;

  const A = await market.auctions(auctionId).catch(() => null);
  if (!A) return null;

  const seller = String(A[0] ?? "");
  const tokenAddr = String(A[1] ?? "");
  const tokenId = (A[2] as bigint) ?? BigInt(0);
  const qty = (A[3] as bigint) ?? BigInt(0);
  const currencyAddr = String(A[5] ?? "");
  const startPrice = (A[6] as bigint) ?? BigInt(0);
  const startTime = toNumberLike(A[8], 0);
  const endTime = toNumberLike(A[9], 0);
  const highestBidder = String(A[10] ?? "");
  const highestBid = (A[11] as bigint) ?? BigInt(0);
  const bidsCount = toNumberLike(A[12], 0);
  const settled = Boolean(A[13]);

  if (settled) return null;

  if (lower(tokenAddr) !== lower(row.nft.contract)) return null;
  if (tokenId.toString() !== String(row.nft.tokenId)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now >= endTime) return null; // ended

  const isLive = now >= startTime && now < endTime;
  const currentWei = bidsCount > 0 ? highestBid : startPrice;

  return {
    auctionIdStr: auctionId.toString(),
    sellerAddress: seller && ethers.isAddress(seller) ? seller : row.sellerAddress,
    quantity: qty > BigInt(0) ? Number(qty) : Number(row.quantity ?? 1),
    currencyAddr: currencyAddr && ethers.isAddress(currencyAddr) ? currencyAddr : null,

    startTimeISO: new Date(startTime * 1000).toISOString(),
    endTimeISO: new Date(endTime * 1000).toISOString(),
    isLive,

    currentWei,
    highestBidder: highestBidder && ethers.isAddress(highestBidder) ? highestBidder : null,
    bidsCount,
  };
}

// simple concurrency limiter (no deps)
async function mapLimit<T, R>(arr: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(arr.length);
  let i = 0;

  const workers = new Array(Math.min(limit, arr.length)).fill(0).map(async () => {
    while (i < arr.length) {
      const idx = i++;
      out[idx] = await fn(arr[idx], idx);
    }
  });

  await Promise.all(workers);
  return out;
}

export async function GET(req: NextRequest) {
  await prismaReady;

  const { searchParams } = new URL(req.url);

  const rawLimit = parseInt(searchParams.get("limit") || "24", 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 24, 60);

  const cursor = searchParams.get("cursor") || null;

  const strictOwner = searchParams.get("strictOwner") === "1";

  const contractParam = searchParams.get("contract") || undefined;
  const tokenIdParam = searchParams.get("tokenId") || undefined;

  const chainTruth = searchParams.get("chain") === "1" || (!!contractParam && !!tokenIdParam);

  try {
    const whereBase: any = {
      status: AuctionStatus.ACTIVE,
      endTime: { gt: new Date() },
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

    const rows = (await prisma.auction.findMany({
      where: whereBase,
      orderBy: { endTime: "asc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        startTime: true,
        endTime: true,
        sellerAddress: true,
        quantity: true,

        startPriceEtnWei: true,
        highestBidEtnWei: true,
        startPriceTokenAmount: true,
        highestBidTokenAmount: true,

        txHashCreated: true,

        currency: {
          select: { id: true, symbol: true, decimals: true, kind: true, tokenAddress: true },
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

    // ✅ ALWAYS try to resolve chain auctionId for returned rows,
    // so frontend can safely treat auction.id as CHAIN id.
    const withChainIds = await mapLimit(page, 6, async (row) => {
      const chainId = await resolveChainAuctionIdFromTx(row).catch(() => null);
      return { row, chainId };
    });

    const truthResults = chainTruth
      ? await mapLimit(withChainIds, 4, async ({ row, chainId }) => {
          try {
            const truth = await chainTruthForAuction(row, chainId);
            return { row, chainId, truth };
          } catch {
            return { row, chainId, truth: null as any };
          }
        })
      : withChainIds.map(({ row, chainId }) => ({ row, chainId, truth: null as any }));

    // ✅ IMPORTANT: do NOT drop auctions just because chain truth failed.
    const filtered = truthResults
      .filter(({ row, truth }) => {
        if (!strictOwner) return true;

        const std = (row.nft.standard ?? "ERC721").toUpperCase();
        if (std === "ERC1155") return true;

        const ownerWallet = row.nft.owner?.walletAddress ?? null;
        if (!ownerWallet) return true;

        const seller = truth?.sellerAddress ?? row.sellerAddress;
        return lower(seller) === lower(ownerWallet);
      })
      .map(({ row, chainId, truth }) => {
        const dbCur = row.currency;
        const dbIsNative = (dbCur?.kind ?? CurrencyKind.NATIVE) === CurrencyKind.NATIVE;

        const chainCurrencyAddr = truth?.currencyAddr ?? null;
        const chainIsNative = !chainCurrencyAddr || chainCurrencyAddr === ethers.ZeroAddress;

        const isNative = truth ? chainIsNative : dbIsNative;

        const decimals = isNative ? 18 : dbCur?.decimals ?? 18;
        const symbol = isNative ? "ETN" : dbCur?.symbol ?? "ERC20";
        const tokenAddress = isNative ? null : dbCur?.tokenAddress ?? chainCurrencyAddr;

        const startISO = truth?.startTimeISO ?? row.startTime.toISOString();
        const endISO = truth?.endTimeISO ?? row.endTime.toISOString();

        const now = Date.now();
        const isLive =
          truth?.isLive ??
          (() => {
            const s = row.startTime.getTime();
            const e = row.endTime.getTime();
            return now >= s && now < e;
          })();

        const sellerAddr = truth?.sellerAddress ?? row.sellerAddress;

        const currentWei =
          truth?.currentWei ??
          (() => {
            const highest = isNative ? row.highestBidEtnWei : row.highestBidTokenAmount;
            const start = isNative ? row.startPriceEtnWei : row.startPriceTokenAmount;

            const hStr = highest?.toString?.() ?? highest ?? null;
            const sStr = start?.toString?.() ?? start ?? null;

            let v: bigint | null = null;
            try {
              v = hStr != null ? BigInt(String(hStr)) : null;
            } catch {
              v = null;
            }
            if (v == null) {
              try {
                v = sStr != null ? BigInt(String(sStr)) : null;
              } catch {
                v = null;
              }
            }
            return v ?? BigInt(0);
          })();

        // ✅ ID FIX:
        // Prefer resolved chainId (even when chainTruth=0), else truth’s on-chain id, else DB id.
        const publicId = (chainId ? chainId.toString() : null) ?? truth?.auctionIdStr ?? row.id;

        return {
          id: publicId, // CHAIN auctionId (string) whenever possible
          dbId: row.id, // DB id (cuid)

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
            currentWei: currentWei != null ? currentWei.toString() : null,
            current: currentWei != null ? formatUnitsSafe(currentWei, decimals) : null,
          },

          sellerAddress: sellerAddr,

          seller: {
            address: sellerAddr,
            username: null as string | null,
          },

          quantity: truth?.quantity ?? row.quantity ?? 1,

          highestBidder: truth?.highestBidder ?? null,
          bidsCount: truth?.bidsCount ?? null,
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

    // ✅ CURSOR FIX: use the last item of the returned page, NOT the extra (limit+1) row
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

    return NextResponse.json({ items, nextCursor });
  } catch (e) {
    console.error("[api auction active] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
