/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ethers } from "ethers";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { useActiveAccount } from "thirdweb/react";
import { marketplace, type Standard } from "@/src/lib/services/marketplace";

import { useNowTicker } from "./hooks/useNowTicker";
import { useCurrencies } from "./hooks/useCurrencies";
import { useMarketState } from "./hooks/useMarketState";
import { useChainMirrors } from "./hooks/useChainMirrors";

import type { OwnerMode } from "./types";
import { errorMessage, formatCountdown, parseIsoToMs, safeChecksum } from "./utils";

import { ListingCard } from "./components/ListingCard";
import { AuctionCard } from "./components/AuctionCard";
import { OwnerActions } from "./components/OwnerActions";

function pickUsername(x: any): string | null {
  const u = x?.seller?.username;
  return typeof u === "string" && u.trim().length > 0 ? u.trim() : null;
}

function extractTxHash(maybe: unknown): string | null {
  if (typeof maybe === "string" && maybe.startsWith("0x")) return maybe;
  const anyTx = maybe as any;
  const h = anyTx?.hash;
  if (typeof h === "string" && h.startsWith("0x")) return h;
  return null;
}

function safeEq(a: string, b: string) {
  try {
    return ethers.getAddress(a) === ethers.getAddress(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

export default function NFTMarketPanel({
  contract,
  tokenId,
  standard,
  owner,
  onAfterAction,
}: {
  contract: string;
  tokenId: string;
  standard: Standard;
  owner?: string | null;
  onAfterAction?: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dw = useDecentWalletAccount();
  const third = useActiveAccount();

  const account = useMemo(() => {
    if (!mounted) return null;
    if (dw.isDecentWallet) return dw.address ?? null;
    return third?.address ?? null;
  }, [mounted, dw.isDecentWallet, dw.address, third?.address]);

  const [loading, setLoading] = useState(false);
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("none");

  const [ownChainListing, setOwnChainListing] = useState<{
    id: bigint;
    row: {
      seller: `0x${string}`;
      currency: `0x${string}`;
      price: bigint;
      quantity: bigint;
      start: bigint;
      end: bigint;
      standard: bigint;
    };
  } | null>(null);

  const [ownChainAuction, setOwnChainAuction] = useState<{
    id: bigint;
    row: {
      seller: `0x${string}`;
      currency: `0x${string}`;
      startPrice: bigint;
      minIncrement: bigint;
      start: bigint;
      end: bigint;
      highestBidder: `0x${string}`;
      highestBid: bigint;
      bidsCount: number;
      standard: bigint;
      settled: boolean;
    };
  } | null>(null);

  const resetUiAfterRefresh = useCallback(() => {
    setOwnerMode("none");
  }, []);

  const { listing, auction, err, setErr, refresh } = useMarketState({
    contract,
    tokenId,
    onAfterRefreshReset: resetUiAfterRefresh,
  });

  const { currencies, currLoading } = useCurrencies();

  const { chainListing, chainAuction } = useChainMirrors({
    listingId: listing?.id ?? null,
    auctionId: auction?.id ?? null,
  });

  const nowMs = useNowTicker();

  const requireWalletToast = useCallback(() => {
    toast.error("Wallet not connected.");
    setErr("Connect your wallet to continue.");
  }, [setErr]);

  const syncOwnerNow = useCallback(async () => {
    await fetch("/api/nft/sync-owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract, tokenId }),
    }).catch(() => null);

    router.refresh();
  }, [contract, tokenId, router]);

  const refreshOwnSellerScopedState = useCallback(async () => {
    if (standard !== "ERC1155" || !account || !ethers.isAddress(contract)) {
      setOwnChainListing(null);
      setOwnChainAuction(null);
      return;
    }

    try {
      const [l, a] = await Promise.all([
        marketplace.readActiveListing({
          collection: ethers.getAddress(contract) as `0x${string}`,
          tokenId: BigInt(tokenId),
          standard: "ERC1155",
          seller: ethers.getAddress(account) as `0x${string}`,
        }),
        marketplace.readActiveAuction({
          collection: ethers.getAddress(contract) as `0x${string}`,
          tokenId: BigInt(tokenId),
          standard: "ERC1155",
          seller: ethers.getAddress(account) as `0x${string}`,
        }),
      ]);

      setOwnChainListing(l ?? null);
      setOwnChainAuction(a ?? null);
    } catch {
      setOwnChainListing(null);
      setOwnChainAuction(null);
    }
  }, [standard, account, contract, tokenId]);

  useEffect(() => {
    void refreshOwnSellerScopedState();
  }, [refreshOwnSellerScopedState, listing?.id, auction?.id]);

  const listingStartMs = useMemo(() => {
    if (standard === "ERC1155" && ownChainListing) return Number(ownChainListing.row.start) * 1000;
    if (chainListing) return chainListing.startSec * 1000;
    return parseIsoToMs(listing?.startTime ?? null);
  }, [standard, ownChainListing, chainListing, listing?.startTime]);

  const listingEndMs = useMemo(() => {
    if (standard === "ERC1155" && ownChainListing) return Number(ownChainListing.row.end) * 1000;
    if (chainListing) return chainListing.endSec * 1000;
    return parseIsoToMs(listing?.endTime ?? null);
  }, [standard, ownChainListing, chainListing, listing?.endTime]);

  const listingNotStarted =
    standard === "ERC1155"
      ? !!ownChainListing && !!listingStartMs && nowMs < listingStartMs
      : !!listing && !!listingStartMs && nowMs < listingStartMs;

  const listingEndedUi =
    standard === "ERC1155"
      ? !!ownChainListing && !!listingEndMs && listingEndMs > 0 && nowMs > listingEndMs
      : !!listing && !!listingEndMs && listingEndMs > 0 && nowMs > listingEndMs;

  const auctionStartMs = useMemo(() => {
    if (standard === "ERC1155" && ownChainAuction) return Number(ownChainAuction.row.start) * 1000;
    if (chainAuction) return chainAuction.startSec * 1000;
    return parseIsoToMs(auction?.startTime ?? null);
  }, [standard, ownChainAuction, chainAuction, auction?.startTime]);

  const auctionEndMs = useMemo(() => {
    if (standard === "ERC1155" && ownChainAuction) return Number(ownChainAuction.row.end) * 1000;
    if (chainAuction) return chainAuction.endSec * 1000;
    return parseIsoToMs(auction?.endTime ?? null);
  }, [standard, ownChainAuction, chainAuction, auction?.endTime]);

  const auctionNotStarted =
    standard === "ERC1155"
      ? !!ownChainAuction && !!auctionStartMs && nowMs < auctionStartMs
      : !!auction && !!auctionStartMs && nowMs < auctionStartMs;

  const auctionEndedUi =
    standard === "ERC1155"
      ? !!ownChainAuction && !!auctionEndMs && nowMs > auctionEndMs
      : !!auction && !!auctionEndMs && nowMs > auctionEndMs;

  const listingSeller =
    standard === "ERC1155"
      ? (ownChainListing?.row.seller ?? listing?.seller?.address ?? listing?.sellerAddress ?? null)
      : (listing?.seller?.address ?? listing?.sellerAddress ?? null);

  const auctionSeller =
    standard === "ERC1155"
      ? (ownChainAuction?.row.seller ?? (auction as any)?.seller?.address ?? (auction as any)?.sellerAddress ?? null)
      : ((auction as any)?.seller?.address ?? (auction as any)?.sellerAddress ?? null);

  const isSellerForListing = !!account && !!listingSeller && safeEq(account, listingSeller);
  const isSellerForAuction = !!account && !!auctionSeller && safeEq(account, auctionSeller);

  const listingPriceLabel = useMemo(() => {
    if (!listing) return null;
    const unit = listing.price?.unit ?? null;
    const sym = listing.currency?.symbol ?? "ETN";
    return unit ? `${unit} ${sym}` : null;
  }, [listing]);

  const auctionPriceLabel = useMemo(() => {
    if (standard === "ERC1155" && ownChainAuction && auction?.currency?.symbol) {
      const current = ownChainAuction.row.highestBid > BigInt(0)
        ? ownChainAuction.row.highestBid
        : ownChainAuction.row.startPrice;

      try {
        const sym = auction.currency.symbol ?? "ETN";
        const dec = Number(auction.currency.decimals ?? 18) || 18;
        return `${ethers.formatUnits(current, dec)} ${sym}`;
      } catch {
        return "Auction";
      }
    }

    if (!auction) return null;
    const cur = auction.price?.current ?? null;
    const sym = auction.currency?.symbol ?? "ETN";
    return cur ? `${cur} ${sym}` : null;
  }, [standard, ownChainAuction, auction]);

  const listingSubline = useMemo(() => {
    if (standard === "ERC1155" && ownChainListing) {
      if (listingNotStarted && listingStartMs) {
        return `Scheduled (Starts in ${formatCountdown(listingStartMs, nowMs)})`;
      }
      if (listingEndedUi) return "Expired";
      return "Active";
    }

    if (!listing) return null;
    if (listingNotStarted && listingStartMs)
      return `Scheduled (Starts in ${formatCountdown(listingStartMs, nowMs)})`;
    if (listingEndedUi) return "Expired";
    return "Active";
  }, [standard, ownChainListing, listing, listingNotStarted, listingStartMs, listingEndedUi, nowMs]);

  const auctionSubline = useMemo(() => {
    if (standard === "ERC1155" && ownChainAuction) {
      if (auctionNotStarted && auctionStartMs) {
        return `Scheduled (Starts in ${formatCountdown(auctionStartMs, nowMs)})`;
      }
      if (auctionEndedUi) return "Ended";
      return "Active";
    }

    if (!auction) return null;
    if (auctionNotStarted && auctionStartMs)
      return `Scheduled (Starts in ${formatCountdown(auctionStartMs, nowMs)})`;
    if (auctionEndedUi) return "Ended";
    return "Active";
  }, [standard, ownChainAuction, auction, auctionNotStarted, auctionStartMs, auctionEndedUi, nowMs]);

  const buyDisabled = loading || !listing || listingNotStarted || listingEndedUi;

  const effectiveAuctionBidsCount =
    standard === "ERC1155"
      ? Number(ownChainAuction?.row.bidsCount ?? (auction as any)?.bidsCount ?? chainAuction?.bidsCount ?? 0)
      : Number((auction as any)?.bidsCount ?? chainAuction?.bidsCount ?? 0);

  const canCancelAuctionByRule =
    standard === "ERC1155"
      ? !!ownChainAuction && isSellerForAuction && effectiveAuctionBidsCount === 0 && !auctionEndedUi
      : !!auction && isSellerForAuction && effectiveAuctionBidsCount === 0 && !auctionEndedUi;

  const canCancelListing =
    standard === "ERC1155"
      ? !!ownChainListing && isSellerForListing
      : !!listing && isSellerForListing;

  const listingSellerUsername = pickUsername(listing as any);
  const auctionSellerUsername = pickUsername(auction as any);

  const displayListingSeller = listingSellerUsername ?? safeChecksum(listingSeller);
  const displayAuctionSeller = auctionSellerUsername ?? safeChecksum(auctionSeller);

  const activeListingChainId =
    standard === "ERC1155"
      ? (ownChainListing ? ownChainListing.id.toString() : null)
      : (listing?.id ?? null);

  const activeAuctionChainId =
    standard === "ERC1155"
      ? (ownChainAuction ? ownChainAuction.id.toString() : null)
      : (auction?.id ?? null);

  const buyNow = useCallback(async () => {
    const listingIdStr = listing?.id;
    if (!listingIdStr) return;

    if (!account) return requireWalletToast();

    const tId = toast.loading("Buying…");
    setLoading(true);
    setErr(null);

    try {
      const maybeTx = (await (marketplace as any).buyListingByIdJustInTime(
        BigInt(listingIdStr)
      )) as unknown;

      toast.success("Purchase successful.", { id: tId });

      const txHashFilled = extractTxHash(maybeTx);
      const dbId = (listing as any)?.dbId ?? null;

      if (dbId && txHashFilled) {
        await fetch("/api/market/listing/fill/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dbId,
            txHashFilled,
            contract,
            tokenId: String(tokenId),
            chainId: listing?.id ?? null,
          }),
        }).catch(() => null);
      }

      await syncOwnerNow();
      await refresh();
      await refreshOwnSellerScopedState();
      router.refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Buy failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    listing,
    account,
    requireWalletToast,
    syncOwnerNow,
    refresh,
    refreshOwnSellerScopedState,
    router,
    onAfterAction,
    setErr,
    contract,
    tokenId,
  ]);

  const cancelListing = useCallback(async () => {
    const listingIdStr = activeListingChainId;
    if (!listingIdStr) return;

    if (!account) return requireWalletToast();

    const tId = toast.loading("Canceling listing…");
    setLoading(true);
    setErr(null);

    try {
      const maybeTx = (await (marketplace as any).cancelListing(BigInt(listingIdStr))) as unknown;

      toast.success("Listing canceled.", { id: tId });

      const txHashCancelled = extractTxHash(maybeTx);
      const dbId = (listing as any)?.dbId ?? null;

      if (txHashCancelled) {
        await fetch("/api/market/listing/cancel/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dbId,
            txHashCancelled,
            contract,
            tokenId: String(tokenId),
            chainId: listingIdStr,
            sellerAddress: account,
          }),
        }).catch(() => null);
      }

      await refresh();
      await refreshOwnSellerScopedState();
      router.refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Cancel listing failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    activeListingChainId,
    listing,
    account,
    requireWalletToast,
    refresh,
    refreshOwnSellerScopedState,
    router,
    onAfterAction,
    setErr,
    contract,
    tokenId,
  ]);

  const cancelAuction = useCallback(async () => {
    const auctionIdStr = activeAuctionChainId;
    if (!auctionIdStr) return;

    if (!account) return requireWalletToast();

    const tId = toast.loading("Canceling auction…");
    setLoading(true);
    setErr(null);

    try {
      const tx: any = await marketplace.cancelAuction(BigInt(auctionIdStr));

      const dbId = (auction as any)?.dbId ?? null;
      const txHashCancelled =
        typeof tx === "string" && tx.startsWith("0x") ? tx : (tx?.hash as string | undefined);

      if (txHashCancelled) {
        await fetch("/api/market/auction/cancel/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dbId,
            txHashCancelled,
            contract,
            tokenId: String(tokenId),
            chainId: auctionIdStr,
            sellerAddress: account,
          }),
        }).catch(() => null);
      }

      toast.success("Auction canceled.", { id: tId });

      await refresh();
      await refreshOwnSellerScopedState();
      router.refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Cancel auction failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    activeAuctionChainId,
    auction,
    account,
    requireWalletToast,
    refresh,
    refreshOwnSellerScopedState,
    router,
    onAfterAction,
    setErr,
    contract,
    tokenId,
  ]);

  const finalizeAuction = useCallback(async () => {
    const auctionIdStr = activeAuctionChainId;
    if (!auctionIdStr) return;

    if (!account) return requireWalletToast();

    const tId = toast.loading("Finalizing auction…");
    setLoading(true);
    setErr(null);

    try {
      const on = await marketplace.readAuctionById(BigInt(auctionIdStr));
      if (!on) throw new Error("Auction not found on-chain.");

      const endTime = Number(on.row.end);
      const settled = Boolean(on.row.settled);

      if (settled) throw new Error("Auction is already settled.");

      const now = Math.floor(Date.now() / 1000);
      if (now <= endTime) throw new Error("Auction has not ended yet.");

      const maybeTx = (await (marketplace as any).finalizeAuction(BigInt(auctionIdStr))) as unknown;

      toast.success("Auction finalized.", { id: tId });

      const txHashFinalized = extractTxHash(maybeTx);
      const dbId = (auction as any)?.dbId ?? null;

      if (txHashFinalized) {
        await fetch("/api/market/auction/settle/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dbId,
            txHashFinalized,
            contract,
            tokenId: String(tokenId),
            chainId: auctionIdStr,
            sellerAddress: account,
          }),
        }).catch(() => null);
      }

      await syncOwnerNow();
      await refresh();
      await refreshOwnSellerScopedState();
      router.refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Finalize failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    activeAuctionChainId,
    auction,
    account,
    requireWalletToast,
    syncOwnerNow,
    refresh,
    refreshOwnSellerScopedState,
    router,
    onAfterAction,
    setErr,
    contract,
    tokenId,
  ]);

  const auctionDbId = (auction as any)?.dbId ?? null;

  return (
    <div className="space-y-4">
      <ListingCard
        hasListing={!!listing}
        standard={standard}
        contract={contract}
        tokenId={tokenId}
        headline={listing ? listingPriceLabel ?? "Listing" : "No active listing"}
        subline={listing ? listingSubline : null}
        sellerLabel={displayListingSeller}
        loading={loading}
        canCancel={canCancelListing}
        isSeller={!!listing && isSellerForListing}
        accountConnected={!!account}
        buyDisabled={buyDisabled}
        buyTitle={
          listingNotStarted && listingStartMs
            ? `Starts in ${formatCountdown(listingStartMs, nowMs)}`
            : listingEndedUi
            ? "Listing expired"
            : undefined
        }
        onBuy={() => void buyNow()}
        onCancel={() => void cancelListing()}
        onConnectWallet={requireWalletToast}
      />

      <AuctionCard
        hasAuction={standard === "ERC1155" ? !!ownChainAuction || !!auction : !!auction}
        standard={standard}
        contract={contract}
        tokenId={tokenId}
        headline={
          standard === "ERC1155"
            ? ownChainAuction
              ? auctionPriceLabel ?? "Auction"
              : auction
              ? auctionPriceLabel ?? "Auction"
              : "No active auction"
            : auction
            ? auctionPriceLabel ?? "Auction"
            : "No active auction"
        }
        subline={
          standard === "ERC1155"
            ? ownChainAuction
              ? auctionSubline
              : auction
              ? auctionSubline
              : null
            : auction
            ? auctionSubline
            : null
        }
        sellerLabel={displayAuctionSeller}
        loading={loading}
        isSeller={
          standard === "ERC1155"
            ? !!ownChainAuction && isSellerForAuction
            : !!auction && isSellerForAuction
        }
        canCancel={canCancelAuctionByRule}
        canFinalize={standard === "ERC1155" ? !!ownChainAuction && auctionEndedUi : !!auction && auctionEndedUi}
        endedUi={auctionEndedUi}
        auctionDbId={auctionDbId}
        onCancel={() => void cancelAuction()}
        onFinalize={() => void finalizeAuction()}
        bidsCount={effectiveAuctionBidsCount}
      />

      <OwnerActions
        contract={contract}
        tokenId={tokenId}
        standard={standard}
        account={account}
        owner={owner}
        listing={listing}
        auction={auction}
        currencies={currencies}
        currLoading={currLoading}
        loading={loading}
        setLoading={setLoading}
        setErr={setErr}
        ownerMode={ownerMode}
        setOwnerMode={setOwnerMode}
        onRefresh={async () => {
          await refresh();
          await refreshOwnSellerScopedState();
        }}
        onSyncOwnerNow={syncOwnerNow}
        onAfterAction={onAfterAction}
      />

      {err ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {err}
        </div>
      ) : null}
    </div>
  );
}