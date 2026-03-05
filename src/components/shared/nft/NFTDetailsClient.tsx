/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/ui/Button";
import { shortenAddress } from "@/src/lib/utils";

import NFTMarketPanel from "@/src/components/shared/nft/market/NFTMarketPanel";
import type { Standard } from "@/src/lib/services/marketplace";
import ActivityTab from "@/app/(pages)/collections/[contract]/ui/ActivityTab";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { useActiveAccount } from "thirdweb/react";
import { Copy, ExternalLink, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type TabKey = "market" | "activity";

function lc(s?: string | null) {
  return (s || "").toLowerCase();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function extractItemsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray((data as any).items))
    return (data as any).items as unknown[];
  return [];
}

function useMounted(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      queueMicrotask(onStoreChange);
      return () => {};
    },
    () => true,
    () => false
  );
}

type OwnerRow = {
  address: string;
  balance: number;
  username: string | null;
  profileAvatar?: string | null;
};

function copyToClipboard(text: string) {
  try {
    void navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function IconButton({
  title,
  "aria-label": ariaLabel,
  onClick,
  children,
}: {
  title: string;
  "aria-label": string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={[
        "inline-flex h-9 w-9 items-center justify-center",
        "rounded-full border border-border bg-background/60",
        "hover:bg-background transition",
        "focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function OwnersDrawer({
  open,
  onClose,
  owners,
  title,
  subtitle,
  onRefresh,
  refreshing,
}: {
  open: boolean;
  onClose: () => void;
  owners: OwnerRow[];
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const mounted = useMounted();

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      {/* Premium scrollbar styling for this drawer list */}
      <style jsx global>{`
        .panth-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.25) transparent;
        }
        .dark .panth-scroll {
          scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
        }
        .panth-scroll::-webkit-scrollbar {
          width: 10px;
        }
        .panth-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .panth-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.22);
          border-radius: 999px;
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        .dark .panth-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18);
          border: 3px solid transparent;
          background-clip: padding-box;
        }
      `}</style>

      <div className="fixed inset-0 z-1000">
        {/* Backdrop */}
        <button
          type="button"
          aria-label="Close owners"
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Drawer */}
        <div className="absolute inset-y-0 right-0 flex w-full justify-end">
          <div
            role="dialog"
            aria-modal="true"
            className={[
              "h-dvh w-full",
              "max-w-115 sm:max-w-130",
              "bg-card text-foreground shadow-2xl",
              "border-l border-border",
              "rounded-l-3xl",
              "overflow-hidden",
              "flex flex-col",
              "animate-in slide-in-from-right duration-200",
            ].join(" ")}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 sm:px-5 py-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{title}</div>
                  {subtitle ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {subtitle}
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {onRefresh ? (
                    <button
                      type="button"
                      onClick={onRefresh}
                      className={[
                        "inline-flex items-center gap-2",
                        "rounded-full border border-border bg-background px-3 py-1.5",
                        "text-xs hover:bg-card transition",
                        refreshing ? "opacity-70" : "",
                      ].join(" ")}
                      disabled={refreshing}
                      title="Refresh"
                    >
                      <RefreshCw
                        className={[
                          "h-4 w-4",
                          refreshing ? "animate-spin" : "",
                        ].join(" ")}
                      />
                      Refresh
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background hover:bg-card transition"
                    aria-label="Close"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body (scrolls) */}
            <div className="min-h-0 flex-1 overflow-auto panth-scroll px-4 sm:px-5 py-4">
              {owners.length ? (
                <div className="space-y-2">
                  {owners.map((o) => {
                    const addr = o.address;
                    const label =
                      (o.username && o.username.trim()) ||
                      shortenAddress(addr, 6, 4);

                    return (
                      <div
                        key={addr}
                        className={[
                          "rounded-2xl border border-border bg-background/40",
                          "px-3 sm:px-4 py-3",
                          "grid grid-cols-[minmax(0,1fr)_auto] gap-3",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {label}
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                            {addr}
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground">
                            Qty:{" "}
                            <span className="font-medium text-foreground">
                              {o.balance}
                            </span>
                          </div>
                        </div>

                        {/* Actions: never cut off; wrap if space is tight */}
                        <div className="shrink-0 flex items-center justify-end gap-2 flex-wrap">
                          <IconButton
                            title="Copy address"
                            aria-label="Copy address"
                            onClick={() => {
                              const ok = copyToClipboard(addr);
                              if (ok) toast.success("Wallet address copied");
                              else toast.error("Copy failed");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </IconButton>

                          <a
                            href={`/profile/${encodeURIComponent(addr)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View profile"
                            aria-label="View profile"
                            className={[
                              "inline-flex h-9 w-9 items-center justify-center",
                              "rounded-full border border-border bg-background/60",
                              "hover:bg-background transition",
                              "focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20",
                            ].join(" ")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No owners found.
                </div>
              )}

              {/* subtle bottom gradient hint that it scrolls */}
              <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-8 bg-linear-to-t from-card to-transparent" />
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t border-border flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Showing {owners.length} holder{owners.length === 1 ? "" : "s"}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-xs rounded-full border border-border bg-background px-3 py-1 hover:bg-card transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
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

  const dw = useDecentWalletAccount();
  const third = useActiveAccount();

  const account = useMemo(() => {
    if (!mounted) return null;
    if (dw.isDecentWallet) return dw.address ?? null;
    return third?.address ?? null;
  }, [mounted, dw.isDecentWallet, dw.address, third?.address]);

  const [hasListing, setHasListing] = useState(false);
  const [hasAuction, setHasAuction] = useState(false);

  const std: Standard = standard === "ERC1155" ? "ERC1155" : "ERC721";

  // -------------------------
  // Owner display (ERC721)
  // -------------------------
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!owner) {
        setOwnerUsername(null);
        return;
      }

      const res = await fetch("/api/users/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ addresses: [owner] }),
      }).then((r) => r.json().catch(() => null));

      const map =
        res && typeof res === "object" && res != null ? (res as any).map : null;

      const username =
        map && typeof map === "object" && map != null
          ? (map[String(owner).toLowerCase()] as string | undefined) ?? null
          : null;

      if (!cancelled)
        setOwnerUsername(typeof username === "string" ? username : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [owner]);

  const ownerLabel = useMemo(() => {
    if (!owner) return "—";
    if (ownerUsername) return ownerUsername;
    if (account && lc(owner) === lc(account)) return "You";
    return shortenAddress(String(owner), 6, 4);
  }, [owner, ownerUsername, account]);

  // -------------------------
  // Owners list (ERC1155) from /holders
  // -------------------------
  const [owners, setOwners] = useState<OwnerRow[] | null>(null);
  const [ownersOpen, setOwnersOpen] = useState(false);
  const [ownersLoading, setOwnersLoading] = useState(false);

  const refreshOwners = useCallback(async () => {
    if (std !== "ERC1155") return;

    setOwnersLoading(true);

    const res = await fetch(
      `/api/nft/${encodeURIComponent(contract)}/${encodeURIComponent(
        tokenId
      )}/holders`,
      { cache: "no-store" }
    )
      .then((r) => r.json().catch(() => null))
      .catch(() => null);

    const raw = res && typeof res === "object" ? (res as any).holders : null;

    if (!Array.isArray(raw)) {
      setOwners([]);
      setOwnersLoading(false);
      return;
    }

    const rows: OwnerRow[] = raw
      .map((x: any) => {
        const addr = String(x?.ownerAddress ?? x?.address ?? "");
        const balNum =
          typeof x?.balance === "number" ? x.balance : Number(x?.balance ?? 0);

        const profile = x?.profile ?? null;

        return {
          address: addr,
          balance: Number.isFinite(balNum) ? balNum : 0,
          username:
            typeof profile?.username === "string"
              ? profile.username
              : typeof x?.username === "string"
              ? x.username
              : null,
          profileAvatar:
            typeof profile?.profileAvatar === "string"
              ? profile.profileAvatar
              : null,
        };
      })
      .filter((x) => x.address && x.balance > 0);

    setOwners(rows);
    setOwnersLoading(false);
  }, [std, contract, tokenId]);

  useEffect(() => {
    if (std !== "ERC1155") return;
    const t = window.setTimeout(() => void refreshOwners(), 0);
    return () => window.clearTimeout(t);
  }, [std, refreshOwners]);

  const ownersCount = owners?.length ?? 0;

  // -------------------------
  // Market flags (listing/auction exists)
  // -------------------------
  const refreshMarketFlags = useCallback(async () => {
    try {
      const [lRes, aRes] = await Promise.all([
        fetch(
          `/api/listing/active?contract=${encodeURIComponent(
            contract
          )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&chain=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch((): unknown => null)),
        fetch(
          `/api/auction/active?contract=${encodeURIComponent(
            contract
          )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&chain=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch((): unknown => null)),
      ]);

      const lItems = extractItemsArray(lRes);
      const aItems = extractItemsArray(aRes);

      setHasListing((lItems[0] ?? null) != null);
      setHasAuction((aItems[0] ?? null) != null);
    } catch {
      setHasListing(false);
      setHasAuction(false);
    }
  }, [contract, tokenId]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshMarketFlags(), 0);
    return () => window.clearTimeout(t);
  }, [refreshMarketFlags]);

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
            <div className="text-xs text-muted-foreground">
              {std === "ERC1155" ? "Owners" : "Owner"}
            </div>

            {std === "ERC1155" ? (
              <button
                type="button"
                onClick={() => setOwnersOpen(true)}
                className={[
                  "mt-1 inline-flex max-w-full items-center gap-2",
                  "text-sm font-semibold truncate",
                  "rounded-full border border-black/10 dark:border-white/10",
                  "px-3 py-1.5 bg-white/40 dark:bg-white/5",
                  "hover:bg-black/5 dark:hover:bg-white/10 transition",
                ].join(" ")}
                title="View all owners"
              >
                <span className="truncate">Owners ({ownersCount || "—"})</span>
              </button>
            ) : (
              <div className="mt-1 text-sm font-semibold font-mono truncate">
                {ownerLabel}
              </div>
            )}
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
            Live listing/auction state + seller actions.
          </p>

          <div className="mt-4">
            <NFTMarketPanel
              contract={contract}
              tokenId={tokenId}
              standard={std}
              owner={owner}
              onAfterAction={() => {
                void refreshMarketFlags();
                if (std === "ERC1155") void refreshOwners();
              }}
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

      {/* Owners Drawer (ERC1155) */}
      <OwnersDrawer
        open={ownersOpen && std === "ERC1155"}
        onClose={() => setOwnersOpen(false)}
        owners={owners ?? []}
        title={`Owners (${ownersCount || 0})`}
        subtitle="ERC-1155 holders for this token"
        onRefresh={() => void refreshOwners()}
        refreshing={ownersLoading}
      />
    </aside>
  );
}