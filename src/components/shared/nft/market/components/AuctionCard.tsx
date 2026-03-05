"use client";

import { Button } from "@/src/ui/Button";
import { ButtonLink } from "./ButtonLink";

function isAmountHeadline(s: string) {
  // crude-but-safe: catches "40 ETN", "0.5 ETN", "100 TOKEN", etc.
  // avoids labeling headlines like "No active auction"
  return /^\s*\d+(\.\d+)?\s+\S+\s*$/.test(s);
}

export function AuctionCard(props: {
  hasAuction: boolean;
  standard: "ERC721" | "ERC1155";
  contract: string;
  tokenId: string;

  headline: string;
  subline?: string | null;
  sellerLabel?: string | null;

  loading: boolean;

  isSeller: boolean;
  canCancel: boolean;
  canFinalize: boolean;

  endedUi: boolean;

  auctionDbId: string | null;

  // ✅ add this (pass it from the caller)
  bidsCount?: number | null;

  onCancel: () => void;
  onFinalize: () => void;
}) {
  const {
    hasAuction,
    headline,
    subline,
    sellerLabel,
    loading,
    isSeller,
    canCancel,
    canFinalize,
    endedUi,
    auctionDbId,
    bidsCount,
    onCancel,
    onFinalize,
  } = props;

  const showBidLabel = hasAuction && isAmountHeadline(headline);
  const bidLabel =
    (bidsCount ?? 0) > 0 ? "Current bid" : "Start price";

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Auction</div>

          {/* ✅ make "Current bid" explicit */}
          {showBidLabel ? (
            <div className="mt-1 text-xs text-muted-foreground">{bidLabel}</div>
          ) : null}

          <div className={showBidLabel ? "mt-1 text-sm font-semibold" : "mt-1 text-sm font-semibold"}>
            {headline}
          </div>

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
          {canFinalize ? (
            <Button variant="outline" onClick={onFinalize} disabled={loading}>
              Finalize auction
            </Button>
          ) : endedUi ? null : canCancel ? (
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={loading}
              title="Seller can cancel only if no bids have been made"
            >
              Cancel auction
            </Button>
          ) : auctionDbId ? (
            <ButtonLink
              href={`/auction-now/${auctionDbId}`}
              disabled={loading}
              title={isSeller ? "Open your auction page" : "Open auction to place bids"}
            >
              Open auction
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}