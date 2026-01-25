/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/shared/nft/NFTMarketPanel.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/src/ui/Button";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { useActiveAccount } from "thirdweb/react";
import { marketplace, Standard } from "@/src/lib/services/marketplace";
import { toast } from "sonner";

type ListingActiveItem = {
  id: string;
  sellerAddress: string | null;
  currency?: { symbol?: string | null } | null;
  price?: { unit?: string | null } | null;
  quantity?: number | null;
  startTime?: string | null;
  endTime?: string | null;
};

type AuctionActiveItem = {
  id: string;
  seller?: { address?: string | null } | null;
  currency?: { symbol?: string | null; decimals?: number | null } | null;
  price?: { current?: string | null } | null;
  endTime?: string | null;
};

function lc(s?: string | null) {
  return (s || "").toLowerCase();
}

function parseIsoToMs(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** simple "Button-like" link using our design tokens */
function ButtonLink({
  href,
  children,
  disabled,
  title,
}: {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  if (disabled) {
    return (
      <span
        title={title}
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-background px-4 text-sm opacity-60 cursor-not-allowed"
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      title={title}
      className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-background px-4 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition"
    >
      {children}
    </a>
  );
}

function errorMessage(e: any, fallback: string) {
  return e?.reason || e?.shortMessage || e?.message || fallback;
}

export default function NFTMarketPanel({
  contract,
  tokenId,
  standard,
  onAfterAction,
}: {
  contract: string;
  tokenId: string;
  standard: Standard;
  onAfterAction?: () => void;
}) {
  // unified account source (DW inside webview, thirdweb otherwise)
  const dw = useDecentWalletAccount();
  const third = useActiveAccount();

  const account = useMemo(() => {
    if (dw.isDecentWallet) return dw.address ?? null;
    return third?.address ?? null;
  }, [dw.isDecentWallet, dw.address, third?.address]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [listing, setListing] = useState<ListingActiveItem | null>(null);
  const [auction, setAuction] = useState<AuctionActiveItem | null>(null);

  const [bidOpen, setBidOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");

  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const [lRes, aRes] = await Promise.all([
        fetch(
          `/api/listing/active?contract=${encodeURIComponent(contract)}&tokenId=${encodeURIComponent(
            tokenId
          )}&limit=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch(() => null)),
        fetch(
          `/api/auction/active?contract=${encodeURIComponent(contract)}&tokenId=${encodeURIComponent(
            tokenId
          )}&limit=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch(() => null)),
      ]);

      const li =
        lRes && Array.isArray(lRes.items) ? (lRes.items[0] as ListingActiveItem) : null;
      const au =
        aRes && Array.isArray(aRes.items) ? (aRes.items[0] as AuctionActiveItem) : null;

      setListing(li ?? null);
      setAuction(au ?? null);
    } catch {
      setErr("Failed to load market state.");
      setListing(null);
      setAuction(null);
    }
  }, [contract, tokenId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const listingSeller = listing?.sellerAddress ?? null;
  const canManageListing = !!account && !!listingSeller && lc(account) === lc(listingSeller);

  const auctionSeller = auction?.seller?.address ?? null;

  const auctionEndMs = parseIsoToMs(auction?.endTime ?? null);
  const auctionEnded = !!auctionEndMs && Date.now() > auctionEndMs;
  const canFinalize = !!auction && auctionEnded;

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

  const buyNow = useCallback(async () => {
    if (!account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }

    const tId = toast.loading("Buying…");
    setLoading(true);
    setErr(null);

    try {
      await marketplace.buyListingJustInTime({
        collection: contract as `0x${string}`,
        tokenId: BigInt(tokenId),
        standard,
      });

      toast.success("Purchase successful.", { id: tId });
      await refresh();
      onAfterAction?.();
    } catch (e: any) {
      const msg = errorMessage(e, "Buy failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [account, contract, tokenId, standard, refresh, onAfterAction]);

  const cancelListing = useCallback(async () => {
    if (!listing?.id) return;

    if (!account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }

    const tId = toast.loading("Canceling listing…");
    setLoading(true);
    setErr(null);

    try {
      await marketplace.cancelListing(BigInt(listing.id));
      toast.success("Listing canceled.", { id: tId });

      await refresh();
      onAfterAction?.();
    } catch (e: any) {
      const msg = errorMessage(e, "Cancel listing failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [listing?.id, account, refresh, onAfterAction]);

  const placeBid = useCallback(async () => {
    if (!account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }

    if (auctionEnded) {
      toast.error("Auction has ended. Finalize to settle.");
      setErr("Auction has ended. Finalize to settle.");
      return;
    }

    const amt = (bidAmount || "").trim();
    if (!amt || Number(amt) <= 0) {
      toast.error("Enter a valid bid amount.");
      setErr("Enter a valid bid amount.");
      return;
    }

    const tId = toast.loading("Placing bid…");
    setLoading(true);
    setErr(null);

    try {
      await marketplace.placeBidJustInTime({
        collection: contract as `0x${string}`,
        tokenId: BigInt(tokenId),
        standard,
        amountHuman: amt,
      });

      toast.success("Bid placed.", { id: tId });
      setBidOpen(false);
      setBidAmount("");

      await refresh();
      onAfterAction?.();
    } catch (e: any) {
      const msg = errorMessage(e, "Bid failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [account, bidAmount, contract, tokenId, standard, refresh, onAfterAction, auctionEnded]);

  const finalizeAuction = useCallback(async () => {
    if (!auction?.id) return;

    if (!account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }

    if (!auctionEnded) {
      toast.error("Auction has not ended yet.");
      setErr("Auction has not ended yet.");
      return;
    }

    const tId = toast.loading("Finalizing auction…");
    setLoading(true);
    setErr(null);

    try {
      await marketplace.finalizeAuction(BigInt(auction.id));
      toast.success("Auction finalized.", { id: tId });

      await refresh();
      onAfterAction?.();
    } catch (e: any) {
      const msg = errorMessage(e, "Finalize failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [auction?.id, account, refresh, onAfterAction, auctionEnded]);

  return (
    <div className="space-y-4">
      {/* listing card */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Listing</div>
            <div className="mt-1 text-sm font-semibold">
              {listing ? (listingPriceLabel ?? "Active") : "No active listing"}
            </div>
            {listingSeller ? (
              <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                Seller: {listingSeller}
              </div>
            ) : null}
          </div>

          {/* ✅ removed per-card refresh */}
        </div>

        {listing ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {standard === "ERC1155" ? (
              <ButtonLink
                href={`/list/${contract}/${tokenId}`}
                disabled={loading}
                title="ERC1155 can have multiple sellers — view all listings"
              >
                View listings
              </ButtonLink>
            ) : !canManageListing ? (
              <Button onClick={() => void buyNow()} disabled={loading}>
                Buy now
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void cancelListing()} disabled={loading}>
                Cancel listing
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* auction card */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Auction</div>
            <div className="mt-1 text-sm font-semibold">
              {auction ? (auctionPriceLabel ?? "Active") : "No active auction"}
            </div>
            {auctionSeller ? (
              <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                Seller: {auctionSeller}
              </div>
            ) : null}
          </div>

          {/* ✅ removed per-card refresh */}
        </div>

        {auction ? (
          <div className="mt-4 space-y-2">
            {standard === "ERC1155" ? (
              <ButtonLink
                href={`/auctions/${contract}/${tokenId}`}
                disabled={loading}
                title="ERC1155 can have multiple sellers — view all auctions"
              >
                View auctions
              </ButtonLink>
            ) : canFinalize ? (
              <Button variant="outline" onClick={() => void finalizeAuction()} disabled={loading}>
                Finalize auction
              </Button>
            ) : !auctionEnded ? (
              <>
                {!bidOpen ? (
                  <Button variant="outline" onClick={() => setBidOpen(true)} disabled={loading}>
                    Place bid
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={`Amount (${auction.currency?.symbol ?? "ETN"})`}
                      className="h-10 w-44 rounded-2xl border bg-background px-3 text-sm"
                      inputMode="decimal"
                      disabled={loading}
                    />
                    <Button onClick={() => void placeBid()} disabled={loading}>
                      Confirm bid
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setBidOpen(false);
                        setBidAmount("");
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">
                Auction ended — waiting to be finalized.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {err}
        </div>
      ) : null}
    </div>
  );
}
