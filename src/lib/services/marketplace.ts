/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/services/marketplace.ts
"use client";

/**
 * High-level Marketplace service used by UI components.
 *
 * Wraps `lib/evm/marketplace-actions.ts` and adds:
 * - "Just in time" checks (time window, settled state)
 * - Currency helpers for bid minimum display
 * - Optional marketplace start delay before listing/auction starts
 * - Better revert/error surfacing for buy/bid/cancel/finalize flows
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

const DEFAULT_MARKET_START_DELAY_SEC = Math.max(
  0,
  Number(process.env.NEXT_PUBLIC_MARKET_START_DELAY_SEC ?? "0")
);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function nowSec(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

function nowSecNumber(): number {
  return Math.floor(Date.now() / 1000);
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

function normalizeMarketplaceStartTime(startTimeSec?: number): number {
  const minAllowed = nowSecNumber() + DEFAULT_MARKET_START_DELAY_SEC;
  if (!Number.isFinite(startTimeSec ?? NaN) || !startTimeSec || startTimeSec <= 0) {
    return minAllowed;
  }
  return Math.max(Math.floor(startTimeSec), minAllowed);
}

function formatUtcFromSec(sec: bigint | number): string {
  const n = typeof sec === "bigint" ? Number(sec) : sec;
  if (!Number.isFinite(n) || n <= 0) return "unknown time";
  return new Date(n * 1000).toISOString();
}

function extractErrParts(err: unknown): string[] {
  if (!err) return [];
  if (typeof err === "string") return [err];

  const e = err as any;

  const parts = [
    e?.shortMessage,
    e?.reason,
    e?.message,
    e?.error?.reason,
    e?.error?.message,
    e?.info?.error?.message,
    e?.info?.error?.reason,
    e?.data?.message,
    e?.data?.originalError?.message,
    e?.cause?.message,
  ].filter((x) => typeof x === "string" && x.trim().length > 0) as string[];

  return Array.from(new Set(parts));
}

function hasPattern(raw: string, patterns: RegExp[]) {
  return patterns.some((rx) => rx.test(raw));
}

function normalizeCommonWalletError(err: unknown): string | null {
  const parts = extractErrParts(err);
  const raw = parts.join(" | ");

  if (!raw) return null;

  if (
    hasPattern(raw, [
      /insufficient funds/i,
      /intrinsic gas too low/i,
      /intrinsic transaction cost/i,
      /gas required exceeds allowance/i,
      /gas \* price \+ value/i,
      /funds for gas/i,
      /not enough funds/i,
      /exceeds balance/i,
    ])
  ) {
    return "Not enough ETN in this wallet to cover the NFT price plus gas.";
  }

  if (
    hasPattern(raw, [
      /user rejected/i,
      /user denied/i,
      /rejected the request/i,
      /ACTION_REJECTED/i,
      /denied transaction/i,
      /cancelled by user/i,
    ])
  ) {
    return "Transaction was cancelled in the wallet.";
  }

  if (
    hasPattern(raw, [
      /wrong network/i,
      /unsupported chain/i,
      /chain mismatch/i,
      /switch to the supported chain/i,
    ])
  ) {
    return "Wrong network. Switch to the supported chain and try again.";
  }

  if (
    hasPattern(raw, [
      /wallet mismatch/i,
      /Connected wallet mismatch/i,
      /signer resolved/i,
    ])
  ) {
    return "Connected wallet mismatch. Reconnect the intended wallet and try again.";
  }

  return null;
}

function normalizeBuyError(err: unknown): string {
  const commonWallet = normalizeCommonWalletError(err);
  if (commonWallet) return commonWallet;

  const parts = extractErrParts(err);
  const raw = parts.join(" | ");

  if (!raw) {
    return "Transaction reverted on-chain while buying the listing.";
  }

  if (hasPattern(raw, [/TimeWindow/i, /Not started yet/i])) {
    return "This listing has not started yet.";
  }

  if (hasPattern(raw, [/Expired/i])) {
    return "This listing has expired.";
  }

  if (hasPattern(raw, [/Inactive/i, /no longer active/i])) {
    return "This listing is no longer active on-chain.";
  }

  if (hasPattern(raw, [/PriceMismatch/i, /payment amount does not match/i])) {
    return "The on-chain payment amount does not match the listing price.";
  }

  if (hasPattern(raw, [/TransferFailed/i])) {
    return "Payment transfer failed on-chain. Check wallet balance and try again.";
  }

  if (hasPattern(raw, [/StolenAsset/i])) {
    return "This asset is currently blocked from trading.";
  }

  if (hasPattern(raw, [/pause/i, /EnforcedPause/i])) {
    return "Marketplace actions are currently paused.";
  }

  if (hasPattern(raw, [/execution reverted/i, /call exception/i])) {
    return raw;
  }

  return raw;
}

function normalizeBidError(err: unknown): string {
  const commonWallet = normalizeCommonWalletError(err);
  if (commonWallet) return commonWallet;

  const parts = extractErrParts(err);
  const raw = parts.join(" | ");

  if (!raw) return "Bid failed.";

  if (hasPattern(raw, [/Auction is already settled/i, /AlreadySettled/i])) {
    return "This auction is already settled.";
  }

  if (hasPattern(raw, [/TimeWindow/i, /Not started yet/i])) {
    return "This auction is not currently open for bidding.";
  }

  if (hasPattern(raw, [/Bid too low/i, /PriceMismatch/i])) {
    return raw;
  }

  if (hasPattern(raw, [/TransferFailed/i])) {
    return "Payment transfer failed on-chain. Check wallet balance or token allowance and try again.";
  }

  if (hasPattern(raw, [/StolenAsset/i])) {
    return "This asset is currently blocked from trading.";
  }

  if (hasPattern(raw, [/pause/i, /EnforcedPause/i])) {
    return "Marketplace actions are currently paused.";
  }

  return raw;
}

function normalizeCancelError(err: unknown, kind: "listing" | "auction"): string {
  const commonWallet = normalizeCommonWalletError(err);
  if (commonWallet) return commonWallet;

  const parts = extractErrParts(err);
  const raw = parts.join(" | ");

  if (!raw) return `Cancel ${kind} failed.`;

  if (hasPattern(raw, [/NotSeller/i])) {
    return `Only the seller can cancel this ${kind}.`;
  }

  if (hasPattern(raw, [/Inactive/i])) {
    return `This ${kind} is no longer active.`;
  }

  if (hasPattern(raw, [/AlreadySettled/i])) {
    return "This auction is already settled.";
  }

  if (hasPattern(raw, [/pause/i, /EnforcedPause/i])) {
    return "Marketplace actions are currently paused.";
  }

  return raw;
}

function normalizeFinalizeError(err: unknown): string {
  const commonWallet = normalizeCommonWalletError(err);
  if (commonWallet) return commonWallet;

  const parts = extractErrParts(err);
  const raw = parts.join(" | ");

  if (!raw) return "Finalize failed.";

  if (hasPattern(raw, [/AlreadySettled/i])) {
    return "Auction is already settled.";
  }

  if (hasPattern(raw, [/Auction has not ended yet/i, /TimeWindow/i])) {
    return "Auction has not ended yet.";
  }

  if (hasPattern(raw, [/pause/i, /EnforcedPause/i])) {
    return "Marketplace actions are currently paused.";
  }

  return raw;
}

/* ------------------------------------------------------------------ */
/* Currency helpers                                                   */
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
/* Public API                                                         */
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

    const normalizedStart = normalizeMarketplaceStartTime(args.startTimeSec);
    if (args.endTimeSec > 0 && args.endTimeSec <= normalizedStart) {
      throw new Error("End time must be after the marketplace start time.");
    }

    const startISO = new Date(normalizedStart * 1000).toISOString();
    const endISO =
      args.endTimeSec > 0 ? new Date(args.endTimeSec * 1000).toISOString() : undefined;

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

    const normalizedStart = normalizeMarketplaceStartTime(args.startTimeSec);
    if (!args.endTimeSec || args.endTimeSec <= normalizedStart) {
      throw new Error("Auction end time must be after the marketplace start time.");
    }

    const startISO = new Date(normalizedStart * 1000).toISOString();
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
    try {
      const rc = await cancelListingOnChain(listingId);
      return rc.txHash;
    } catch (err: unknown) {
      throw new Error(normalizeCancelError(err, "listing"));
    }
  },

  async cancelAuction(auctionId: bigint): Promise<string> {
    try {
      const rc = await cancelAuctionOnChain(auctionId);
      return rc.txHash;
    } catch (err: unknown) {
      throw new Error(normalizeCancelError(err, "auction"));
    }
  },

  async finalizeAuction(auctionId: bigint): Promise<string> {
    try {
      const { signer } = await import("@/src/lib/evm/getSigner").then((m) =>
        m.getBrowserSigner()
      );
      const { MARKETPLACE_CORE_ABI } = await import(
        "@/src/lib/abis/marketplace-core/marketPlaceCoreABI"
      );

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
    } catch (err: unknown) {
      throw new Error(normalizeFinalizeError(err));
    }
  },

  async buyListingByIdJustInTime(listingId: bigint): Promise<string> {
    try {
      const { signer, provider } = await import("@/src/lib/evm/getSigner").then((m) =>
        m.getBrowserSigner()
      );
      const { MARKETPLACE_CORE_ABI } = await import(
        "@/src/lib/abis/marketplace-core/marketPlaceCoreABI"
      );

      const on = await readListingById(listingId);
      if (!on) throw new Error("Listing not found on-chain.");

      requireWindowActive({ start: on.row.start, end: on.row.end });

      const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
      if (!mktAddr || !ethers.isAddress(mktAddr)) {
        throw new Error("Missing marketplace address.");
      }

      const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

      const raw = await mkt.listings(listingId).catch(() => null);
      if (!raw) throw new Error("Listing not found on-chain.");

      const seller = String(raw[0] ?? "");
      const currency = (String(raw[5] ?? on.row.currency) || on.row.currency) as `0x${string}`;
      const price = (raw[6] as bigint | undefined) ?? on.row.price;
      const start = (raw[7] as bigint | undefined) ?? on.row.start;
      const end = (raw[8] as bigint | undefined) ?? on.row.end;
      const active = Boolean(raw[9]);

      if (!active) {
        throw new Error("This listing is no longer active on-chain.");
      }

      if (!seller || seller === ZERO_ADDR) {
        throw new Error("Listing seller is invalid on-chain.");
      }

      const n = nowSec();
      if (start > BigInt(0) && n < start) {
        throw new Error(`Not started yet. Starts at ${formatUtcFromSec(start)}.`);
      }
      if (end > BigInt(0) && n > end) {
        throw new Error(`Expired. Ended at ${formatUtcFromSec(end)}.`);
      }

      const isNative = currency === ZERO_ADDR;

      if (isNative) {
        const buyer = await signer.getAddress();
        const balance = await provider.getBalance(buyer);
        if (balance < price) {
          throw new Error("Insufficient funds for NFT price.");
        }
      }

      if (!isNative) {
        const ERC20_ABI = [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
        ] as const;

        const token = new ethers.Contract(currency, ERC20_ABI, signer);
        const owner = (await signer.getAddress()) as `0x${string}`;

        const allowance: bigint = await token.allowance(owner, mktAddr);
        if (allowance < price) {
          const txA = await token.approve(mktAddr, price);
          await txA.wait();
        }
      }

      const overrides: Record<string, bigint> = {};
      if (isNative) overrides.value = price;

      if (typeof (mkt.buy as any).staticCall === "function") {
        await (mkt.buy as any).staticCall(listingId, overrides);
      }

      const tx = await mkt.buy(listingId, overrides);
      await tx.wait();
      return String(tx.hash);
    } catch (err: unknown) {
      throw new Error(normalizeBuyError(err));
    }
  },

  async buyActiveListingForSellerJustInTime(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: Standard;
    seller: `0x${string}`;
  }): Promise<string> {
    try {
      const { signer } = await import("@/src/lib/evm/getSigner").then((m) =>
        m.getBrowserSigner()
      );
      const { MARKETPLACE_CORE_ABI } = await import(
        "@/src/lib/abis/marketplace-core/marketPlaceCoreABI"
      );

      const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
      if (!mktAddr || !ethers.isAddress(mktAddr)) {
        throw new Error("Missing marketplace address.");
      }

      const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

      let listingId: bigint;
      if (args.standard === "ERC1155") {
        listingId = await mkt.activeListing1155BySeller(
          args.collection,
          args.tokenId,
          args.seller
        );
      } else {
        listingId = await mkt.activeListingForToken(args.collection, args.tokenId);
      }

      if (!listingId || listingId === BigInt(0)) {
        throw new Error("This listing is no longer active on-chain.");
      }

      return await marketplace.buyListingByIdJustInTime(listingId);
    } catch (err: unknown) {
      throw new Error(normalizeBuyError(err));
    }
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
    try {
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

      const { signer, provider } = await import("@/src/lib/evm/getSigner").then((m) =>
        m.getBrowserSigner()
      );
      const { MARKETPLACE_CORE_ABI } = await import(
        "@/src/lib/abis/marketplace-core/marketPlaceCoreABI"
      );

      const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
      const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

      const isNative = on.row.currency === ZERO_ADDR;
      if (isNative) {
        const bidder = await signer.getAddress();
        const balance = await provider.getBalance(bidder);
        if (balance < amountWei) {
          throw new Error("Insufficient funds for bid amount.");
        }
      }

      const overrides: Record<string, bigint> = {};
      if (isNative) overrides.value = amountWei;

      const tx = await mkt.bid(args.auctionId, amountWei, overrides);
      await tx.wait();
    } catch (err: unknown) {
      throw new Error(normalizeBidError(err));
    }
  },

  async transferNft(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: Standard;
    to: `0x${string}`;
    amount: bigint;
  }): Promise<void> {
    const { signer } = await import("@/src/lib/evm/getSigner").then((m) =>
      m.getBrowserSigner()
    );

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