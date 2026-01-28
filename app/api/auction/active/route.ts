/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/auction/active/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { AuctionStatus, CurrencyKind } from "@/src/lib/generated/prisma/client";
import { ethers } from "ethers";

function lower(s?: string | null) {
  return (s ?? "").toLowerCase();
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
  "function auctions(uint256 auctionId) view returns (address seller,address token,uint256 tokenId,uint256 quantity,uint8 standard,address currency,uint256 startPrice,uint256 minIncrement,uint64 startTime,uint64 endTime,address highestBidder,uint256 highestBid,uint32 bidsCount,bool settled)",
] as const;

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
  endTime: Date;
  sellerAddress: string | null;
  quantity: number | null;
  startPriceEtnWei: any;
  highestBidEtnWei: any;
  startPriceTokenAmount: any;
  highestBidTokenAmount: any;
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

async function chainTruthForAuction(row: DbRow) {
  const market = getMarket();

  let auctionId: bigint;
  try {
    auctionId = BigInt(String(row.id));
  } catch {
    return null;
  }

  const A = await market.auctions(auctionId).catch(() => null);
  if (!A) return null;

  const seller = String(A[0] ?? "");
  const tokenAddr = String(A[1] ?? "");
  const tokenId = (A[2] as bigint) ?? BigInt(0);
  const qty = (A[3] as bigint) ?? BigInt(0);
  const currencyAddr = String(A[5] ?? "");
  const startPrice = (A[6] as bigint) ?? BigInt(0);
  const endTime = Number(A[9] as bigint);
  const highestBid = (A[11] as bigint) ?? BigInt(0);
  const bidsCount = Number(A[12] as number);
  const settled = Boolean(A[13]);

  if (settled) return null;

  // must match token
  if (lower(tokenAddr) !== lower(row.nft.contract)) return null;
  if (tokenId.toString() !== String(row.nft.tokenId)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now >= endTime) return null;

  const currentWei = bidsCount > 0 ? highestBid : startPrice;

  return {
    auctionIdStr: auctionId.toString(),
    sellerAddress: seller && ethers.isAddress(seller) ? seller : row.sellerAddress,
    quantity: qty > BigInt(0) ? Number(qty) : Number(row.quantity ?? 1),
    currencyAddr: currencyAddr && ethers.isAddress(currencyAddr) ? currencyAddr : null,
    currentWei,
    endTimeISO: new Date(endTime * 1000).toISOString(),
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

  // chain-truth auto for token page (strictOwner + token filter)
  const chainTruth =
    searchParams.get("chain") === "1" || (strictOwner && !!contractParam && !!tokenIdParam);

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

    const truthResults = chainTruth
      ? await Promise.all(
          page.map(async (a) => {
            try {
              const truth = await chainTruthForAuction(a);
              return { row: a, truth };
            } catch {
              return { row: a, truth: null as any };
            }
          })
        )
      : page.map((a) => ({ row: a, truth: null as any }));

    const filteredTruth = truthResults
      .filter(({ row, truth }) => {
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
        const dbCur = row.currency;

        const chainCurrencyAddr = truth?.currencyAddr ?? null;
        const chainIsNative = !chainCurrencyAddr || chainCurrencyAddr === ethers.ZeroAddress;

        const isNative = chainTruth
          ? chainIsNative
          : (dbCur?.kind ?? CurrencyKind.NATIVE) === CurrencyKind.NATIVE;

        const decimals = isNative ? 18 : dbCur?.decimals ?? 18;
        const symbol = isNative ? "ETN" : dbCur?.symbol ?? "ERC20";
        const tokenAddress = isNative ? null : (dbCur?.tokenAddress ?? chainCurrencyAddr);

        // price resolution (chain wins)
        let currentWei: bigint | null = null;

        if (chainTruth && truth?.currentWei != null) {
          currentWei = truth.currentWei as bigint;
        } else {
          const highest = isNative ? row.highestBidEtnWei : row.highestBidTokenAmount;
          const start = isNative ? row.startPriceEtnWei : row.startPriceTokenAmount;

          // best-effort bigint conversion
          const highestStr = highest?.toString?.() ?? highest ?? null;
          const startStr = start?.toString?.() ?? start ?? null;

          try {
            currentWei = highestStr != null ? BigInt(String(highestStr)) : null;
          } catch {
            currentWei = null;
          }
          if (currentWei == null) {
            try {
              currentWei = startStr != null ? BigInt(String(startStr)) : null;
            } catch {
              currentWei = null;
            }
          }
        }

        const sellerAddress = chainTruth
          ? (truth!.sellerAddress ?? row.sellerAddress)
          : row.sellerAddress;

        const endISO = chainTruth ? truth!.endTimeISO : row.endTime.toISOString();

        return {
          id: row.id,
          startTime: row.startTime.toISOString(),
          endTime: endISO,
          quantity: truth?.quantity ?? row.quantity ?? 1,
          seller: {
            address: sellerAddress,
            username: null as string | null, // filled after username lookup
          },
          nft: {
            contract: row.nft.contract,
            tokenId: row.nft.tokenId,
            name:
              row.nft.name ??
              `${row.nft.contract.slice(0, 6)}…${row.nft.contract.slice(-4)} #${row.nft.tokenId}`,
            image: row.nft.imageUrl,
            standard: row.nft.standard ?? "ERC721",
          },
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
        };
      });

    // username lookup only for the final items (fast)
    const sellers = Array.from(
      new Set(
        filteredTruth
          .map((x) => x.seller.address)
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

    const userByWalletLC = new Map(
      users.map((u) => [u.walletAddress.toLowerCase(), u.username || null])
    );

    const items = filteredTruth.map((x) => ({
      ...x,
      seller: {
        ...x.seller,
        username: x.seller.address
          ? userByWalletLC.get(x.seller.address.toLowerCase()) ?? null
          : null,
      },
    }));

    const nextCursor = hasMore ? rows[rows.length - 1].id : null;
    return NextResponse.json({ items, nextCursor });
  } catch (e) {
    console.error("[api auction active] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
