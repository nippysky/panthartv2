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

import type { OwnerMode } from "./types";
import { errorMessage, formatCountdown, parseIsoToMs, safeChecksum } from "./utils";

import { ListingCard } from "./components/ListingCard";
import { AuctionCard } from "./components/AuctionCard";
import { OwnerActions } from "./components/OwnerActions";
import { BidModal } from "./components/BidModal";
import { useChainMirrors } from "./hooks/useChainMirrors";

function pickUsername(x: any): string | null {
  const u = x?.seller?.username;
  return typeof u === "string" && u.trim().length > 0 ? u.trim() : null;
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

  // unified account source (DW inside webview, thirdweb otherwise)
  const dw = useDecentWalletAccount();
  const third = useActiveAccount();

  // IMPORTANT: prevent hydration mismatch by not using wallet address until mounted
  const account = useMemo(() => {
    if (!mounted) return null;
    if (dw.isDecentWallet) return dw.address ?? null;
    return third?.address ?? null;
  }, [mounted, dw.isDecentWallet, dw.address, third?.address]);

  const [loading, setLoading] = useState(false);

  const [ownerMode, setOwnerMode] = useState<OwnerMode>("none");
  const [bidOpen, setBidOpen] = useState(false);

  const resetUiAfterRefresh = useCallback(() => {
    setOwnerMode("none");
    setBidOpen(false);
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

  // derive time window (prefer on-chain mirrors)
  const listingStartMs = useMemo(() => {
    if (chainListing) return chainListing.startSec * 1000;
    return parseIsoToMs(listing?.startTime ?? null);
  }, [chainListing, listing?.startTime]);

  const listingEndMs = useMemo(() => {
    if (chainListing) return chainListing.endSec * 1000;
    return parseIsoToMs(listing?.endTime ?? null);
  }, [chainListing, listing?.endTime]);

  const listingNotStarted = !!listing && !!listingStartMs && nowMs < listingStartMs;
  const listingEndedUi =
    !!listing && !!listingEndMs && listingEndMs > 0 && nowMs > listingEndMs;

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

  const listingSeller = listing?.sellerAddress ?? null;
  const auctionSeller = auction?.seller?.address ?? null;

  const canManageListing = !!account && !!listingSeller && safeEq(account, listingSeller);
  const canManageAuction = !!account && !!auctionSeller && safeEq(account, auctionSeller);

  const userOwns = useMemo(() => {
    if (!account || !owner) return false;
    return safeEq(account, owner);
  }, [account, owner]);

  // fallback seller-like logic if backend omitted sellerAddress (common for ERC721)
  const isSellerLikeForListing =
    canManageListing || (standard === "ERC721" && !!listing && userOwns && !listingSeller);
  const isSellerLikeForAuction =
    canManageAuction || (standard === "ERC721" && !!auction && userOwns && !auctionSeller);

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
  const bidDisabled = loading || !auction || auctionNotStarted || auctionEndedUi;

  // ✅ prefer username when backend returns it
  const listingSellerUsername = pickUsername(listing as any);
  const auctionSellerUsername = pickUsername(auction as any);

  const displayListingSeller =
    listingSellerUsername ?? safeChecksum(listingSeller);
  const displayAuctionSeller =
    auctionSellerUsername ?? safeChecksum(auctionSeller);

  const buyNow = useCallback(async () => {
    const listingIdStr = listing?.id;
    if (!listingIdStr) return;

    if (!account) return requireWalletToast();

    const tId = toast.loading("Buying…");
    setLoading(true);
    setErr(null);

    try {
      await marketplace.buyListingByIdJustInTime(BigInt(listingIdStr));
      toast.success("Purchase successful.", { id: tId });

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
  }, [listing?.id, account, requireWalletToast, syncOwnerNow, refresh, router, onAfterAction, setErr]);

  const cancelListing = useCallback(async () => {
    const listingIdStr = listing?.id;
    if (!listingIdStr) return;

    if (!account) return requireWalletToast();

    const tId = toast.loading("Canceling listing…");
    setLoading(true);
    setErr(null);

    try {
      await marketplace.cancelListing(BigInt(listingIdStr));
      toast.success("Listing canceled.", { id: tId });

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
  }, [listing?.id, account, requireWalletToast, refresh, router, onAfterAction, setErr]);

  const cancelAuction = useCallback(async () => {
    const auctionIdStr = auction?.id;
    if (!auctionIdStr) return;

    if (!account) return requireWalletToast();

    const tId = toast.loading("Canceling auction…");
    setLoading(true);
    setErr(null);

    try {
      await marketplace.cancelAuction(BigInt(auctionIdStr));
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
  }, [auction?.id, account, requireWalletToast, refresh, router, onAfterAction, setErr]);

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

      await marketplace.finalizeAuction(BigInt(auctionIdStr));
      toast.success("Auction finalized.", { id: tId });

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
  }, [auction?.id, account, requireWalletToast, syncOwnerNow, refresh, router, onAfterAction, setErr]);

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
        canCancel={!!listing && (canManageListing || isSellerLikeForListing)}
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
        canCancel={!!auction && (canManageAuction || isSellerLikeForAuction)}
        canFinalize={!!auction && auctionEndedUi}
        bidDisabled={bidDisabled}
        bidTitle={
          auctionNotStarted && auctionStartMs
            ? `Starts in ${formatCountdown(auctionStartMs, nowMs)}`
            : undefined
        }
        endedUi={auctionEndedUi}
        onOpenBid={() => {
          if (bidDisabled) return;
          setBidOpen(true);
        }}
        onCancel={() => void cancelAuction()}
        onFinalize={() => void finalizeAuction()}
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

      <BidModal
        open={bidOpen}
        onClose={() => setBidOpen(false)}
        auction={auction}
        account={account}
        loading={loading}
        setLoading={setLoading}
        setErr={setErr}
        onAfterBid={async () => {
          await refresh();
          router.refresh();
          onAfterAction?.();
        }}
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
