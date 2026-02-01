"use client";

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
    accountConnected,
    buyDisabled,
    buyTitle,
    onBuy,
    onCancel,
    onConnectWallet,
  } = props;

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Listing</div>
          <div className="mt-1 text-sm font-semibold">{headline}</div>
          {subline ? <div className="mt-1 text-xs text-muted-foreground">{subline}</div> : null}
          {sellerLabel ? (
            <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
              Seller: {sellerLabel}
            </div>
          ) : null}
        </div>
      </div>

      {hasListing ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {standard === "ERC1155" ? (
            <>
              <ButtonLink
                href={`/list/${contract}/${tokenId}`}
                disabled={loading}
                title="ERC1155 can have multiple sellers — view all listings"
              >
                View listings
              </ButtonLink>

              {canCancel ? (
                <Button variant="outline" onClick={onCancel} disabled={loading}>
                  Cancel listing
                </Button>
              ) : null}
            </>
          ) : canCancel ? (
            <Button variant="danger" onClick={onCancel} disabled={loading}>
              Cancel listing
            </Button>
          ) : accountConnected ? (
            <Button onClick={onBuy} disabled={buyDisabled} title={buyTitle}>
              Buy now
            </Button>
          ) : (
            <Button variant="outline" onClick={onConnectWallet} disabled={loading}>
              Connect wallet to buy
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
