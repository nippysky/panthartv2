"use client";

// src/components/shared/nft/market/components/ListingCard.tsx

import React from "react";
import { Button } from "@/src/ui/Button";
import { ButtonLink } from "./ButtonLink";

export function ListingCard(props: {
  hasListing: boolean;
  standard: "ERC721" | "ERC1155";
  contract: string;
  tokenId: string;

  headline: string;
  subline?: string | null;
  sellerLabel?: string | null;

  loading: boolean;
  canCancel: boolean;
  isSeller: boolean;

  accountConnected: boolean;
  buyDisabled: boolean;
  buyTitle?: string;

  onBuy: () => void;
  onCancel: () => void;
  onConnectWallet: () => void;
}) {
  const {
    hasListing,
    standard,
    contract,
    tokenId,
    headline,
    subline,
    sellerLabel,
    loading,
    canCancel,
    isSeller,
    accountConnected,
    buyDisabled,
    buyTitle,
    onBuy,
    onCancel,
    onConnectWallet,
  } = props;

  const is1155 = standard === "ERC1155";

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            {is1155 ? "Listings" : "Listing"}
          </div>

          {is1155 ? (
            <div className="mt-1 text-sm font-semibold">
              {hasListing ? "Active listings available" : "No active listings"}
            </div>
          ) : (
            <>
              <div className="mt-1 text-sm font-semibold">{headline}</div>
              {subline ? (
                <div className="mt-1 text-xs text-muted-foreground">{subline}</div>
              ) : null}
              {sellerLabel ? (
                <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                  Seller: {sellerLabel}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {hasListing ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {is1155 ? (
            <>
              <ButtonLink
                href={`/collections/${contract}/${tokenId}/listings`}
                disabled={loading}
                title="ERC1155 can have multiple sellers — view all listings"
              >
                View all listings
              </ButtonLink>

              {canCancel ? (
                <Button variant="outline" onClick={onCancel} disabled={loading}>
                  Cancel listing
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {canCancel ? (
                <Button variant="danger" onClick={onCancel} disabled={loading}>
                  Cancel listing
                </Button>
              ) : accountConnected ? (
                <Button
                  variant="primary"
                  onClick={onBuy}
                  disabled={loading || buyDisabled || isSeller}
                  title={isSeller ? "You are the seller" : buyTitle}
                >
                  Buy now
                </Button>
              ) : (
                <Button variant="primary" onClick={onConnectWallet} disabled={loading}>
                  Connect wallet
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground">
          No active listing right now.
        </div>
      )}
    </div>
  );
}