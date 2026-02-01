"use client";

import React from "react";
import { Button } from "@/src/ui/Button";
import { ButtonLink } from "./ButtonLink";

export function AuctionCard(props: {
  hasAuction: boolean;
  standard: "ERC721" | "ERC1155";
  contract: string;
  tokenId: string;

  headline: string;
  subline?: string | null;
  sellerLabel?: string | null;

  loading: boolean;

  canCancel: boolean;
  canFinalize: boolean;

  bidDisabled: boolean;
  bidTitle?: string;
  endedUi: boolean;

  onOpenBid: () => void;
  onCancel: () => void;
  onFinalize: () => void;
}) {
  const {
    hasAuction,
    standard,
    contract,
    tokenId,
    headline,
    subline,
    sellerLabel,
    loading,
    canCancel,
    canFinalize,
    bidDisabled,
    bidTitle,
    endedUi,
    onOpenBid,
    onCancel,
    onFinalize,
  } = props;

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Auction</div>
          <div className="mt-1 text-sm font-semibold">{headline}</div>
          {subline ? <div className="mt-1 text-xs text-muted-foreground">{subline}</div> : null}
          {sellerLabel ? (
            <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
              Seller: {sellerLabel}
            </div>
          ) : null}
        </div>
      </div>

      {hasAuction ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {standard === "ERC1155" ? (
            <>
              <ButtonLink
                href={`/auctions/${contract}/${tokenId}`}
                disabled={loading}
                title="ERC1155 can have multiple sellers — view all auctions"
              >
                View auctions
              </ButtonLink>

              {canFinalize ? (
                <Button variant="outline" onClick={onFinalize} disabled={loading}>
                  Finalize auction
                </Button>
              ) : endedUi ? null : canCancel ? (
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  disabled={loading}
                  title="Seller can cancel before end"
                >
                  Cancel auction
                </Button>
              ) : null}
            </>
          ) : canFinalize ? (
            <Button variant="outline" onClick={onFinalize} disabled={loading}>
              Finalize auction
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onOpenBid} disabled={bidDisabled} title={bidTitle}>
                Place bid
              </Button>

              {canCancel ? (
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  disabled={loading}
                  title="Seller can cancel before end"
                >
                  Cancel auction
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
