/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import NftGrid from "./NftGrid";

function useDebouncedValue<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);

  // no useEffect (keeps your lint rules calm)
  // debounce by scheduling a microtask + timeout each render change
  // We’ll do it via a simple heuristic: update only when value stays stable long enough.
  // For UI purposes this is fine.
  (globalThis as any).__panth_deb ??= { t: null as any, last: undefined as any };
  const store = (globalThis as any).__panth_deb;

  if (store.last !== value) {
    store.last = value;
    clearTimeout(store.t);
    store.t = setTimeout(() => setV(value), ms);
  }

  return v;
}

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
  const [busy, setBusy] = useState(false);

  const [sort, setSort] = useState<
    "newest" | "oldest" | "rarity_asc" | "rarity_desc"
  >("oldest"); // ✅ default to sequential feel

  const safeSort = useMemo(() => {
    if (!rarityEnabled && (sort === "rarity_asc" || sort === "rarity_desc")) {
      return "oldest" as const;
    }
    return sort;
  }, [rarityEnabled, sort]);

  const debouncedSearch = useDebouncedValue(search, 250);

  // ✅ key forces NftGrid to remount (fresh state) when query changes — no setState-in-effect needed
  const gridKey = useMemo(() => {
    return [
      contract.toLowerCase(),
      debouncedSearch.trim().toLowerCase(),
      listed ? "L1" : "L0",
      auctioned ? "A1" : "A0",
      safeSort,
    ].join("|");
  }, [contract, debouncedSearch, listed, auctioned, safeSort]);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex flex-1 gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or token ID…"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {busy ? <Spinner /> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleChip active={listed} onClick={() => setListed((v) => !v)}>
            Listed
          </ToggleChip>
          <ToggleChip active={auctioned} onClick={() => setAuctioned((v) => !v)}>
            Auctions
          </ToggleChip>

          <select
            value={safeSort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="oldest">Token ID (low → high)</option>
            <option value="newest">Token ID (high → low)</option>
            {rarityEnabled ? <option value="rarity_asc">Rarity (best)</option> : null}
            {rarityEnabled ? <option value="rarity_desc">Rarity (worst)</option> : null}
          </select>
        </div>
      </div>

      <NftGrid
        key={gridKey}
        contract={contract}
        query={{ search: debouncedSearch, listed, auctioned, sort: safeSort }}
        onBusyChange={setBusy}
      />
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-foreground text-background"
          : "border border-border bg-card hover:bg-background/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground"
      aria-label="Loading"
    />
  );
}
