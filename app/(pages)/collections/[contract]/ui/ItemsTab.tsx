/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import NftGrid from "./NftGrid";

export default function ItemsTab({
  contract,
  rarityEnabled,
}: {
  contract: string;
  rarityEnabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [listed, setListed] = useState(false);
  const [auctioned, setAuctioned] = useState(false);

  const [sort, setSort] = useState<
    "newest" | "oldest" | "rarity_asc" | "rarity_desc"
  >("newest");

  // ✅ NEW: busy state driven by NftGrid fetching
  const [busy, setBusy] = useState(false);

  const safeSort = useMemo(() => {
    if (!rarityEnabled && (sort === "rarity_asc" || sort === "rarity_desc")) {
      return "newest" as const;
    }
    return sort;
  }, [rarityEnabled, sort]);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative w-full">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or token ID…"
              className="w-full rounded-2xl border border-border bg-card px-4 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              aria-busy={busy}
            />

            {/* ✅ NEW: inline spinner while busy */}
            {busy ? (
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-foreground/15 border-t-foreground" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ✅ NEW: subtle “updating” pill */}
          {busy ? (
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground sm:inline-flex">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/15 border-t-foreground" />
              Updating…
            </div>
          ) : null}

          <ToggleChip
            active={listed}
            onClick={() => setListed((v) => !v)}
            disabled={busy}
          >
            Listed
          </ToggleChip>

          <ToggleChip
            active={auctioned}
            onClick={() => setAuctioned((v) => !v)}
            disabled={busy}
          >
            Auctions
          </ToggleChip>

          <select
            value={safeSort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-sm"
            disabled={busy}
            aria-busy={busy}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            {rarityEnabled ? <option value="rarity_asc">Rarity (best)</option> : null}
            {rarityEnabled ? <option value="rarity_desc">Rarity (worst)</option> : null}
          </select>
        </div>
      </div>

      <NftGrid
        contract={contract}
        query={{ search, listed, auctioned, sort: safeSort }}
        onBusyChange={setBusy} // ✅ NEW: hook up interaction
      />
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-full px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-foreground text-background"
          : "border border-border bg-card hover:bg-background/60",
        disabled ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
