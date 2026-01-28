"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/src/ui/Button";
import { shortenAddress } from "@/src/lib/utils";

import NFTMarketPanel from "@/src/components/shared/nft/NFTMarketPanel";
import type { Standard } from "@/src/lib/services/marketplace";
import ActivityTab from "@/app/(pages)/collections/[contract]/ui/ActivityTab";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { useActiveAccount } from "thirdweb/react";

type TabKey = "market" | "activity";

function lc(s?: string | null) {
  return (s || "").toLowerCase();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function extractItemsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.items)) return data.items as unknown[];
  return [];
}

function readBool(item: unknown, key: string): boolean | null {
  if (!isRecord(item)) return null;
  const v = item[key];
  return typeof v === "boolean" ? v : null;
}

function readListingSeller(item: unknown): string | null {
  if (!isRecord(item)) return null;

  const sellerAddress = item.sellerAddress;
  if (typeof sellerAddress === "string") return sellerAddress;
  if (sellerAddress === null) return null;

  const seller = item.seller;
  if (isRecord(seller)) {
    const addr = seller.address;
    if (typeof addr === "string") return addr;
    if (addr === null) return null;
  }

  return null;
}

function readAuctionSeller(item: unknown): string | null {
  if (!isRecord(item)) return null;

  const seller = item.seller;
  if (isRecord(seller)) {
    const addr = seller.address;
    if (typeof addr === "string") return addr;
    if (addr === null) return null;
  }

  return null;
}

export default function NFTDetailsClient({
  contract,
  tokenId,
  owner,
  standard = "ERC721",
}: {
  contract: string;
  tokenId: string;
  owner: string | null;
  standard?: Standard | string;
}) {
  const [tab, setTab] = useState<TabKey>("market");

  // unified account source (DW inside webview, thirdweb otherwise)
  const dw = useDecentWalletAccount();
  const third = useActiveAccount();

  const account = useMemo(() => {
    if (dw.isDecentWallet) return dw.address ?? null;
    return third?.address ?? null;
  }, [dw.isDecentWallet, dw.address, third?.address]);

  // ✅ truth-checked market flags for pills (no stale “Listed”)
  const [hasListing, setHasListing] = useState(false);
  const [hasAuction, setHasAuction] = useState(false);

  const std: Standard = standard === "ERC1155" ? "ERC1155" : "ERC721";

  const ownerLabel = useMemo(() => {
    if (!owner) return "—";
    if (account && lc(owner) === lc(account)) return "You";
    return shortenAddress(String(owner), 6, 4);
  }, [owner, account]);

  const refreshMarketFlags = useCallback(async () => {
    try {
      const [lRes, aRes] = await Promise.all([
        fetch(
          `/api/listing/active?contract=${encodeURIComponent(
            contract
          )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&strictOwner=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch((): unknown => null)),
        fetch(
          `/api/auction/active?contract=${encodeURIComponent(
            contract
          )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&strictOwner=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch((): unknown => null)),
      ]);

      const lItems = extractItemsArray(lRes);
      const aItems = extractItemsArray(aRes);

      const l0: unknown = lItems[0] ?? null;
      const a0: unknown = aItems[0] ?? null;

      // ✅ Only consider listing “real” if it isLive (prevents “future/scheduled” from showing as listed)
      const listingIsLive = readBool(l0, "isLive");
      let listingOk = l0 != null && (listingIsLive ?? true);

      const auctionOk = a0 != null;

      // ✅ For ERC721: listing must match current owner to be considered valid
      if (std !== "ERC1155" && owner) {
        const o = lc(owner);

        const listingSeller = readListingSeller(l0);
        if (listingSeller && lc(listingSeller) !== o) listingOk = false;

        // optional (only if you're 100% sure auctions are not escrowed):
        // const auctionSeller = readAuctionSeller(a0);
        // if (auctionSeller && lc(auctionSeller) !== o) auctionOk = false;
        void readAuctionSeller;
      }

      setHasListing(listingOk);
      setHasAuction(auctionOk);
    } catch {
      setHasListing(false);
      setHasAuction(false);
    }
  }, [contract, tokenId, owner, std]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void refreshMarketFlags();
    }, 0);
    return () => window.clearTimeout(t);
  }, [refreshMarketFlags]);

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
            {hasListing && (
              <span className="text-[11px] rounded-full border border-black/10 dark:border-white/10 px-2 py-1 bg-white/40 dark:bg-white/5">
                Listed
              </span>
            )}
            {hasAuction && (
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
        </div>
      </div>

      {tab === "market" ? (
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
          <h3 className="font-semibold">Marketplace</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Live listing/auction state + owner actions.
          </p>

          <div className="mt-4">
            <NFTMarketPanel
              contract={contract}
              tokenId={tokenId}
              standard={std}
              owner={owner}
              onAfterAction={() => void refreshMarketFlags()}
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
