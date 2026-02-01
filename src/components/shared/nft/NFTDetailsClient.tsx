/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/src/ui/Button";
import { shortenAddress } from "@/src/lib/utils";

import NFTMarketPanel from "@/src/components/shared/nft/market/NFTMarketPanel";
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
  if (isRecord(data) && Array.isArray((data as any).items)) return (data as any).items as unknown[];
  return [];
}

/**
 * ✅ Hydration-safe "mounted" flag without setState-in-effect.
 * - Server snapshot: false
 * - First client snapshot: false
 * - After hydration/subscribe: true
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    // subscribe
    (onStoreChange) => {
      // Run after hydration; triggers one update.
      // Using queueMicrotask avoids any sync setState-in-effect patterns.
      queueMicrotask(onStoreChange);
      return () => {};
    },
    // getSnapshot (client)
    () => true,
    // getServerSnapshot (server)
    () => false
  );
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

  const mounted = useMounted();

  // unified account source (DW inside webview, thirdweb otherwise)
  const dw = useDecentWalletAccount();
  const third = useActiveAccount();

  // IMPORTANT: prevent hydration mismatch by not using wallet address until mounted
  const account = useMemo(() => {
    if (!mounted) return null;
    if (dw.isDecentWallet) return dw.address ?? null;
    return third?.address ?? null;
  }, [mounted, dw.isDecentWallet, dw.address, third?.address]);

  const [hasListing, setHasListing] = useState(false);
  const [hasAuction, setHasAuction] = useState(false);

  const std: Standard = standard === "ERC1155" ? "ERC1155" : "ERC721";

  // owner username resolution
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!owner) {
        setOwnerUsername(null);
        return;
      }

      const res = await fetch(`/api/user/resolve?address=${encodeURIComponent(owner)}`, {
        cache: "no-store",
      }).then((r) => r.json().catch(() => null));

      const username =
        res && isRecord(res) && typeof (res as any).username === "string"
          ? ((res as any).username as string)
          : null;

      if (!cancelled) setOwnerUsername(username);
    })();

    return () => {
      cancelled = true;
    };
  }, [owner]);

  const ownerLabel = useMemo(() => {
    if (!owner) return "—";

    // show username if present (stable)
    if (ownerUsername) return ownerUsername;

    // ONLY show "You" after mounted to prevent hydration mismatch
    if (account && lc(owner) === lc(account)) return "You";

    return shortenAddress(String(owner), 6, 4);
  }, [owner, ownerUsername, account]);

  const refreshMarketFlags = useCallback(async () => {
    try {
      const [lRes, aRes] = await Promise.all([
        fetch(
          `/api/listing/active?contract=${encodeURIComponent(
            contract
          )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&strictOwner=1&chain=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch((): unknown => null)),
        fetch(
          `/api/auction/active?contract=${encodeURIComponent(
            contract
          )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&strictOwner=1&chain=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch((): unknown => null)),
      ]);

      const lItems = extractItemsArray(lRes);
      const aItems = extractItemsArray(aRes);

      const l0: unknown = lItems[0] ?? null;
      const a0: unknown = aItems[0] ?? null;

      // Listing exists even if scheduled; only "live" affects BUY button, not presence
      const listingOk = l0 != null;

      // Auction exists even if scheduled
      const auctionOk = a0 != null;

      setHasListing(listingOk);
      setHasAuction(auctionOk);
    } catch {
      setHasListing(false);
      setHasAuction(false);
    }
  }, [contract, tokenId]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshMarketFlags(), 0);
    return () => window.clearTimeout(t);
  }, [refreshMarketFlags]);

  // refresh pills on focus/visibility too (better UX)
  useEffect(() => {
    const onFocus = () => void refreshMarketFlags();
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshMarketFlags();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshMarketFlags]);

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Owner</div>
            <div className="mt-1 text-sm font-semibold font-mono truncate">{ownerLabel}</div>
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
          <p className="mt-1 text-xs text-muted-foreground">Live listing/auction state + owner actions.</p>

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
