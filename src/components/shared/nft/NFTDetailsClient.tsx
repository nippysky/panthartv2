// src/components/shared/nft/NFTDetailsClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/src/ui/Button";
import { shortenAddress } from "@/src/lib/utils";
import { useMarketplaceLive } from "@/src/lib/hooks/useMarketplaceLive";

import NFTitemsTab from "@/src/components/shared/NFTitemsTab";
import NFTMarketPanel from "@/src/components/shared/nft/NFTMarketPanel";

import type { Standard } from "@/src/lib/services/marketplace";
import ActivityTab from "@/app/(pages)/collections/[contract]/ui/ActivityTab";

type TabKey = "market" | "activity";

export default function NFTDetailsClient({
  contract,
  tokenId,
  owner,
  account,
  standard = "ERC721",
}: {
  contract: string;
  tokenId: string;
  owner: string | null;
  account?: string | null;
  standard?: Standard | string;
}) {
  const [tab, setTab] = useState<TabKey>("market");

  const live = useMarketplaceLive({
    contract,
    tokenId,
    account: account ?? null,
  });

  const ownerLabel = useMemo(() => {
    if (!owner) return "—";
    if (account && owner.toLowerCase() === account.toLowerCase()) return "You";
    return shortenAddress(owner, 6, 4);
  }, [owner, account]);

  const std: Standard = standard === "ERC1155" ? "ERC1155" : "ERC721";

  return (
    <aside className="space-y-4">
      {/* status card */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Owner</div>
            <div className="mt-1 text-sm font-semibold font-mono truncate">
              {ownerLabel}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {live.hasAnyListings && (
              <span className="text-[11px] rounded-full border border-black/10 dark:border-white/10 px-2 py-1 bg-white/40 dark:bg-white/5">
                Listed
              </span>
            )}
            {live.hasAnyAuctions && (
              <span className="text-[11px] rounded-full border border-black/10 dark:border-white/10 px-2 py-1 bg-white/40 dark:bg-white/5">
                Auction
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={tab === "market" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTab("market")}
          >
            Market
          </Button>
          <Button
            variant={tab === "activity" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTab("activity")}
          >
            Activity
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void live.invalidateAll()}
            className="ml-auto"
          >
            Refresh
          </Button>
        </div>
      </div>

      {tab === "market" ? (
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
          <h3 className="font-semibold">Marketplace</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Live listing/auction state + actions.
          </p>

          <div className="mt-4">
            <NFTMarketPanel
              contract={contract}
              tokenId={tokenId}
              standard={std}
              onAfterAction={() => void live.invalidateAll()}
            />
          </div>

          <div className="mt-6">
            <NFTitemsTab
              contract={contract}
              excludeTokenId={tokenId}
              title="More from this collection"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
          <h3 className="font-semibold">Activity</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest sales, listings, bids, mints, transfers.
          </p>

          <div className="mt-4">
            <ActivityTab contract={contract} tokenId={tokenId} />
          </div>
        </div>
      )}
    </aside>
  );
}
