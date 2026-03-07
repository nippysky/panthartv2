"use client";

import { Button } from "@/src/ui/Button";
import { ButtonLink } from "./ButtonLink";

function isAmountHeadline(s: string) {
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

  bidsCount?: number | null;

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
    isSeller,
    canCancel,
    canFinalize,
    endedUi,
    auctionDbId,
    bidsCount,
    onCancel,
    onFinalize,
  } = props;

  const is1155 = standard === "ERC1155";
  const showBidLabel = !is1155 && hasAuction && isAmountHeadline(headline);
  const bidLabel = (bidsCount ?? 0) > 0 ? "Current bid" : "Start price";

  const directoryHref = `/collections/${contract}/${tokenId}/auctions`;

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Auction</div>

          {hasAuction ? (
            <>
              {!is1155 && showBidLabel ? (
                <div className="mt-1 text-xs text-muted-foreground">{bidLabel}</div>
              ) : null}

              {!is1155 ? (
                <div className="mt-1 text-sm font-semibold">{headline}</div>
              ) : null}

              {subline ? (
                <div className="mt-1 text-xs text-muted-foreground">{subline}</div>
              ) : null}

              {!is1155 && sellerLabel ? (
                <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                  Seller: {sellerLabel}
                </div>
              ) : null}

              {is1155 ? (
                <div className="mt-2 text-sm font-semibold">
                  Active auction listings available
                </div>
              ) : null}

              {is1155 ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Multiple owners can create separate auctions for this token.
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="mt-1 text-sm font-semibold">No active auction</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {is1155
                  ? "No owners currently have this token listed for auction."
                  : "This NFT is not currently up for auction."}
              </div>
            </>
          )}
        </div>
      </div>

      {hasAuction ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canFinalize ? (
            <Button variant="outline" onClick={onFinalize} disabled={loading}>
              Finalize auction
            </Button>
          ) : endedUi ? null : is1155 ? (
            <>
              <ButtonLink
                href={directoryHref}
                disabled={loading}
                title="View all ERC1155 auctions from different owners"
              >
                View auction listings
              </ButtonLink>

              {canCancel ? (
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  disabled={loading}
                  title="Seller can cancel only if no bids have been made"
                >
                  Cancel auction
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {auctionDbId ? (
                <ButtonLink
                  href={`/auction-now/${auctionDbId}`}
                  disabled={loading}
                  title={isSeller ? "Open your auction page" : "Open auction to place bids"}
                >
                  Open auction
                </ButtonLink>
              ) : (
                <ButtonLink
                  href={directoryHref}
                  disabled={loading}
                  title="View auction details"
                >
                  View auction
                </ButtonLink>
              )}

              {canCancel ? (
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  disabled={loading}
                  title="Seller can cancel only if no bids have been made"
                >
                  Cancel auction
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/3 px-4 py-4">
          <div className="text-sm font-medium">Nothing live here yet</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {is1155
              ? "When owners create auctions for their quantities, they’ll appear here."
              : "When this NFT is placed on auction, it will appear here."}
          </div>
        </div>
      )}
    </div>
  );
}