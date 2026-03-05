/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/services/marketplace.ts
"use client";

/**
 * High-level Marketplace service used by UI components.
 *
 * Wraps `lib/evm/marketplace-actions.ts` and adds:
 * - "Just in time" checks (time window, settled state)
 * - Currency helpers for bid minimum display
 */

import { ethers } from "ethers";
import type { Standard, Currency } from "@/src/lib/evm/marketplace-actions";
import { ZERO_ADDRESS } from "@/src/lib/evm/getSigner";
import {
  createListingOnChain,
  createAuctionOnChain,
  cancelListingOnChain,
  cancelAuctionOnChain,
  readActiveListing,
  readActiveAuction,
  readListingById,
  readAuctionById,
  getErc20Meta,
} from "@/src/lib/evm/marketplace-actions";

export type { Standard };

export const ZERO_ADDR = ZERO_ADDRESS as `0x${string}`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function nowSec(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

function requireWindowActive(args: { start: bigint; end: bigint }) {
  const n = nowSec();
  const start = args.start ?? BigInt(0);
  const end = args.end ?? BigInt(0);

  if (start > BigInt(0) && n < start) throw new Error("Not started yet.");
  if (end > BigInt(0) && n > end) throw new Error("Expired.");
}

function safeAddr(a: string): `0x${string}` {
  if (!ethers.isAddress(a)) throw new Error("Invalid address.");
  return ethers.getAddress(a) as `0x${string}`;
}

function parseUnitsSafe(amountHuman: string, decimals: number): bigint {
  const s = (amountHuman || "").trim();
  if (!s) return BigInt(0);
  return ethers.parseUnits(s, decimals);
}

function formatUnitsSafe(amountWei: bigint, decimals: number): string {
  try {
    return ethers.formatUnits(amountWei, decimals);
  } catch {
    return "0";
  }
}

/* ------------------------------------------------------------------ */
/* Currency helpers                                                     */
/* ------------------------------------------------------------------ */
async function resolveCurrencyMeta(currency: `0x${string}`): Promise<{
  symbol: string;
  decimals: number;
}> {
  if (!currency || currency === ZERO_ADDR) return { symbol: "ETN", decimals: 18 };
  const meta = await getErc20Meta(currency);
  return { symbol: meta.symbol || "TOKEN", decimals: meta.decimals || 18 };
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */
export const marketplace = {
  ZERO_ADDRESS: ZERO_ADDR,

  readActiveListing,
  readActiveAuction,
  readListingById,
  readAuctionById,

  async createListingJustInTime(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    quantity: bigint;
    standard: Standard;
    priceHuman: string;
    currency: `0x${string}`;
    startTimeSec: number;
    endTimeSec: number;
  }): Promise<string> {
    const currencyAddr = safeAddr(args.currency);
    const meta = await resolveCurrencyMeta(currencyAddr);

    const cur: Currency =
      currencyAddr === ZERO_ADDR
        ? { kind: "NATIVE", tokenAddress: null, symbol: "ETN", decimals: 18 }
        : {
            kind: "ERC20",
            tokenAddress: currencyAddr,
            symbol: meta.symbol,
            decimals: meta.decimals,
          };

    const startISO = new Date(args.startTimeSec * 1000).toISOString();
    const endISO = new Date(args.endTimeSec * 1000).toISOString();

    const rc = await createListingOnChain({
      collection: args.collection,
      tokenId: args.tokenId,
      quantity: args.quantity,
      standard: args.standard,
      currency: cur,
      price: args.priceHuman,
      startTimeISO: startISO,
      endTimeISO: endISO,
    });

    return rc.txHash;
  },

  async createAuctionJustInTime(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    quantity: bigint;
    standard: Standard;
    startPriceHuman: string;
    minIncrementHuman: string;
    currency: `0x${string}`;
    startTimeSec: number;
    endTimeSec: number;
  }): Promise<string> {
    const currencyAddr = safeAddr(args.currency);
    const meta = await resolveCurrencyMeta(currencyAddr);

    const cur: Currency =
      currencyAddr === ZERO_ADDR
        ? { kind: "NATIVE", tokenAddress: null, symbol: "ETN", decimals: 18 }
        : {
            kind: "ERC20",
            tokenAddress: currencyAddr,
            symbol: meta.symbol,
            decimals: meta.decimals,
          };

    const startISO = new Date(args.startTimeSec * 1000).toISOString();
    const endISO = new Date(args.endTimeSec * 1000).toISOString();

    const rc = await createAuctionOnChain({
      collection: args.collection,
      tokenId: args.tokenId,
      quantity: args.quantity,
      standard: args.standard,
      currency: cur,
      startPrice: args.startPriceHuman,
      minIncrement: args.minIncrementHuman,
      startTimeISO: startISO,
      endTimeISO: endISO,
    });

    return rc.txHash;
  },

  async cancelListing(listingId: bigint): Promise<string> {
    const rc = await cancelListingOnChain(listingId);
    return rc.txHash;
  },

  async cancelAuction(auctionId: bigint): Promise<string> {
    const rc = await cancelAuctionOnChain(auctionId);
    return rc.txHash;
  },

async finalizeAuction(auctionId: bigint): Promise<string> {
  const { signer } = await import("@/src/lib/evm/getSigner").then((m) => m.getBrowserSigner());
  const { MARKETPLACE_CORE_ABI } = await import("@/src/lib/abis/marketplace-core/marketPlaceCoreABI");

  const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
  const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

  const on = await readAuctionById(auctionId);
  if (!on) throw new Error("Auction not found on-chain.");
  if (on.row.settled) throw new Error("Auction is already settled.");

  const n = Number(nowSec());
  const end = Number(on.row.end);
  if (end > 0 && n <= end) throw new Error("Auction has not ended yet.");

  const tx = await mkt.finalize(auctionId);
  await tx.wait();
  return String(tx.hash);
},

async buyListingByIdJustInTime(listingId: bigint): Promise<string> {
  const { signer } = await import("@/src/lib/evm/getSigner").then((m) => m.getBrowserSigner());
  const { MARKETPLACE_CORE_ABI } = await import("@/src/lib/abis/marketplace-core/marketPlaceCoreABI");

  const on = await readListingById(listingId);
  if (!on) throw new Error("Listing not found on-chain.");

  requireWindowActive({ start: on.row.start, end: on.row.end });

  const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
  if (!mktAddr || !ethers.isAddress(mktAddr)) throw new Error("Missing marketplace address.");

  const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

  const isNative = on.row.currency === ZERO_ADDR;

  // ✅ If ERC20, ensure allowance >= price (approve if needed)
  if (!isNative) {
    const ERC20_ABI = [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
    ] as const;

    const token = new ethers.Contract(on.row.currency, ERC20_ABI, signer);
    const owner = (await signer.getAddress()) as `0x${string}`;

    const allowance: bigint = await token.allowance(owner, mktAddr);
    if (allowance < on.row.price) {
      const txA = await token.approve(mktAddr, on.row.price);
      await txA.wait();
    }
  }

  const overrides: any = {};
  if (isNative) overrides.value = on.row.price;

  const tx = await mkt.buy(listingId, overrides);
  await tx.wait();
  return String(tx.hash);
},


async buyActiveListingForSellerJustInTime(args: {
  collection: `0x${string}`;
  tokenId: bigint;
  standard: Standard;
  seller: `0x${string}`;
}): Promise<string> {
  const { signer } = await import("@/src/lib/evm/getSigner").then((m) => m.getBrowserSigner());
  const { MARKETPLACE_CORE_ABI } = await import("@/src/lib/abis/marketplace-core/marketPlaceCoreABI");

  const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
  if (!mktAddr || !ethers.isAddress(mktAddr)) throw new Error("Missing marketplace address.");

  const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

  // ✅ Resolve listingId on-chain (no DB field needed)
  let listingId: bigint;

  if (args.standard === "ERC1155") {
    listingId = await mkt.activeListing1155BySeller(args.collection, args.tokenId, args.seller);
  } else {
    listingId = await mkt.activeListingForToken(args.collection, args.tokenId);
  }

  if (!listingId || listingId === BigInt(0)) {
    throw new Error("This listing is no longer active on-chain.");
  }

  // ✅ Reuse the existing safe purchase flow (window checks + ERC20 approve)
  return await marketplace.buyListingByIdJustInTime(listingId);
},

  async getBidMinimum(auctionId: bigint): Promise<{
    minWei: bigint;
    minHuman: string;
    symbol: string;
    decimals: number;
  }> {
    const on = await readAuctionById(auctionId);
    if (!on) throw new Error("Auction not found on-chain.");

    const { symbol, decimals } = await resolveCurrencyMeta(on.row.currency);
    const base = on.row.highestBid > BigInt(0) ? on.row.highestBid : on.row.startPrice;
    const minWei = base + on.row.minIncrement;
    const minHuman = formatUnitsSafe(minWei, decimals);

    return { minWei, minHuman, symbol, decimals };
  },

  async placeBidByAuctionIdJustInTime(args: {
    auctionId: bigint;
    amountHuman: string;
  }): Promise<void> {
    const on = await readAuctionById(args.auctionId);
    if (!on) throw new Error("Auction not found on-chain.");

    if (on.row.settled) throw new Error("Auction is already settled.");
    requireWindowActive({ start: on.row.start, end: on.row.end });

    const { symbol, decimals } = await resolveCurrencyMeta(on.row.currency);

    const amountWei = parseUnitsSafe(args.amountHuman, decimals);
    if (amountWei <= BigInt(0)) throw new Error("Invalid bid amount.");

    const base = on.row.highestBid > BigInt(0) ? on.row.highestBid : on.row.startPrice;
    const minWei = base + on.row.minIncrement;
    if (amountWei < minWei) {
      const minHuman = formatUnitsSafe(minWei, decimals);
      throw new Error(`Bid too low. Minimum is ${minHuman} ${symbol}.`);
    }

    const { signer } = await import("@/src/lib/evm/getSigner").then((m) => m.getBrowserSigner());
    const { MARKETPLACE_CORE_ABI } = await import(
      "@/src/lib/abis/marketplace-core/marketPlaceCoreABI"
    );

    const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
    const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

    const isNative = on.row.currency === ZERO_ADDR;

    const overrides: any = {};
    if (isNative) overrides.value = amountWei;

    const tx = await mkt.bid(args.auctionId, amountWei, overrides);
    await tx.wait();
  },

  async transferNft(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: Standard;
    to: `0x${string}`;
    amount: bigint;
  }): Promise<void> {
    const { signer } = await import("@/src/lib/evm/getSigner").then((m) => m.getBrowserSigner());

    if (args.standard === "ERC721") {
      const ERC721_ABI = [
        "function safeTransferFrom(address from, address to, uint256 tokenId)",
      ] as const;

      const nft = new ethers.Contract(args.collection, ERC721_ABI, signer);
      const from = (await signer.getAddress()) as `0x${string}`;
      const tx = await nft.safeTransferFrom(from, args.to, args.tokenId);
      await tx.wait();
      return;
    }

    const ERC1155_ABI = [
      "function safeTransferFrom(address from,address to,uint256 id,uint256 amount,bytes data)",
    ] as const;

    const nft = new ethers.Contract(args.collection, ERC1155_ABI, signer);
    const from = (await signer.getAddress()) as `0x${string}`;
    const tx = await nft.safeTransferFrom(from, args.to, args.tokenId, args.amount, "0x");
    await tx.wait();
  },
};
