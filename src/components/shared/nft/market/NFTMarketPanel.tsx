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

  const listingStartMs = useMemo(() => {
    if (chainListing) return chainListing.startSec * 1000;
    return parseIsoToMs(listing?.startTime ?? null);
  }, [chainListing, listing?.startTime]);

  const listingEndMs = useMemo(() => {
    if (chainListing) return chainListing.endSec * 1000;
    return parseIsoToMs(listing?.endTime ?? null);
  }, [chainListing, listing?.endTime]);

  const listingNotStarted = !!listing && !!listingStartMs && nowMs < listingStartMs;
  const listingEndedUi = !!listing && !!listingEndMs && listingEndMs > 0 && nowMs > listingEndMs;

  const auctionStartMs = useMemo(() => {
    if (chainAuction) return chainAuction.startSec * 1000;
    return parseIsoToMs(auction?.startTime ?? null);
  }, [chainAuction, auction?.startTime]);

  const auctionEndMs = useMemo(() => {
    if (chainAuction) return chainAuction.endSec * 1000;
    return parseIsoToMs(auction?.endTime ?? null);
  }, [chainAuction, auction?.endTime]);

  const auctionNotStarted = !!auction && !!auctionStartMs && nowMs < auctionStartMs;
  const auctionEndedUi = !!auction && !!auctionEndMs && nowMs > auctionEndMs;

  const listingSeller = listing?.seller?.address ?? listing?.sellerAddress ?? null;
  const auctionSeller = (auction as any)?.seller?.address ?? (auction as any)?.sellerAddress ?? null;

  const isSellerForListing = !!account && !!listingSeller && safeEq(account, listingSeller);
  const isSellerForAuction = !!account && !!auctionSeller && safeEq(account, auctionSeller);

  const listingPriceLabel = useMemo(() => {
    if (!listing) return null;
    const unit = listing.price?.unit ?? null;
    const sym = listing.currency?.symbol ?? "ETN";
    return unit ? `${unit} ${sym}` : null;
  }, [listing]);

  const auctionPriceLabel = useMemo(() => {
    if (!auction) return null;
    const cur = auction.price?.current ?? null;
    const sym = auction.currency?.symbol ?? "ETN";
    return cur ? `${cur} ${sym}` : null;
  }, [auction]);

  const listingSubline = useMemo(() => {
    if (!listing) return null;
    if (listingNotStarted && listingStartMs)
      return `Scheduled (Starts in ${formatCountdown(listingStartMs, nowMs)})`;
    if (listingEndedUi) return "Expired";
    return "Active";
  }, [listing, listingNotStarted, listingStartMs, listingEndedUi, nowMs]);

  const auctionSubline = useMemo(() => {
    if (!auction) return null;
    if (auctionNotStarted && auctionStartMs)
      return `Scheduled (Starts in ${formatCountdown(auctionStartMs, nowMs)})`;
    if (auctionEndedUi) return "Ended";
    return "Active";
  }, [auction, auctionNotStarted, auctionStartMs, auctionEndedUi, nowMs]);

  const buyDisabled = loading || !listing || listingNotStarted || listingEndedUi;

  // Auction cancel rule: seller can cancel ONLY if no bids have been made.
  const bidsCount = Number((auction as any)?.bidsCount ?? chainAuction?.bidsCount ?? 0);
  const canCancelAuctionByRule = !!auction && isSellerForAuction && bidsCount === 0 && !auctionEndedUi;

  const canCancelListing = !!listing && isSellerForListing;

  const listingSellerUsername = pickUsername(listing as any);
  const auctionSellerUsername = pickUsername(auction as any);

  const displayListingSeller = listingSellerUsername ?? safeChecksum(listingSeller);
  const displayAuctionSeller = auctionSellerUsername ?? safeChecksum(auctionSeller);

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
    router,
    onAfterAction,
    setErr,
    contract,
    tokenId,
  ]);

  const cancelListing = useCallback(async () => {
    const listingIdStr = listing?.id;
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

      if (dbId && txHashCancelled) {
        await fetch("/api/market/listing/cancel/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dbId,
            txHashCancelled,
            contract,
            tokenId: String(tokenId),
            chainId: listing?.id ?? null,
          }),
        }).catch(() => null);
      }

      await refresh();
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
    listing,
    account,
    requireWalletToast,
    refresh,
    router,
    onAfterAction,
    setErr,
    contract,
    tokenId,
  ]);

  const cancelAuction = useCallback(async () => {
    const auctionIdStr = auction?.id;
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

      if (dbId) {
        await fetch("/api/market/auction/cancel/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dbId,
            txHashCancelled: txHashCancelled ?? null,
          }),
        }).catch(() => null);
      }

      toast.success("Auction canceled.", { id: tId });

      await refresh();
      router.refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Cancel auction failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [auction, account, requireWalletToast, refresh, router, onAfterAction, setErr]);

  const finalizeAuction = useCallback(async () => {
    const auctionIdStr = auction?.id;
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

      if (dbId && txHashFinalized) {
        await fetch("/api/market/auction/settle/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dbId,
            txHashFinalized,
            contract,
            tokenId: String(tokenId),
            chainId: auction?.id ?? null,
          }),
        }).catch(() => null);
      }

      await syncOwnerNow();
      await refresh();
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
    auction,
    account,
    requireWalletToast,
    syncOwnerNow,
    refresh,
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
        hasAuction={!!auction}
        standard={standard}
        contract={contract}
        tokenId={tokenId}
        headline={auction ? auctionPriceLabel ?? "Auction" : "No active auction"}
        subline={auction ? auctionSubline : null}
        sellerLabel={displayAuctionSeller}
        loading={loading}
        isSeller={!!auction && isSellerForAuction}
        canCancel={canCancelAuctionByRule}
        canFinalize={!!auction && auctionEndedUi}
        endedUi={auctionEndedUi}
        auctionDbId={auctionDbId}
        onCancel={() => void cancelAuction()}
        onFinalize={() => void finalizeAuction()}
        bidsCount={auction?.bidsCount ?? 0}
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
        onRefresh={refresh}
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

function safeEq(a: string, b: string) {
  try {
    return ethers.getAddress(a) === ethers.getAddress(b);
  } catch {
    return a === b;
  }
}