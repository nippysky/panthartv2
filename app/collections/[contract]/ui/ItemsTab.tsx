/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import NftGrid from "./NftGrid";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
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

  const [sort, setSort] = useState<"newest" | "oldest" | "rarity_asc" | "rarity_desc">(
    "oldest"
  );

  const safeSort = useMemo(() => {
    if (!rarityEnabled && (sort === "rarity_asc" || sort === "rarity_desc")) {
      return "oldest" as const;
    }
    return sort;
  }, [rarityEnabled, sort]);

  const trimmed = search.trim();

  const gridKey = useMemo(() => {
    // Remount grid when any query changes → fixes “search doesn’t work / random ordering”
    return [
      contract,
      safeSort,
      listed ? "listed" : "nolisted",
      auctioned ? "auctioned" : "noauctioned",
      trimmed.toLowerCase(),
    ].join("|");
  }, [contract, safeSort, listed, auctioned, trimmed]);

  const anyFilter = Boolean(trimmed || listed || auctioned || safeSort !== "oldest");

  function clear() {
    setSearch("");
    setListed(false);
    setAuctioned(false);
    setSort("oldest");
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or token ID…"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          />
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
            className="h-10 rounded-2xl border border-border bg-card px-3 text-sm"
          >
            <option value="oldest">Token ID (low → high)</option>
            <option value="newest">Token ID (high → low)</option>
            {rarityEnabled ? <option value="rarity_asc">Rarity (best)</option> : null}
            {rarityEnabled ? <option value="rarity_desc">Rarity (worst)</option> : null}
          </select>

          {anyFilter ? (
            <button
              type="button"
              onClick={clear}
              className="h-10 rounded-2xl border border-border bg-card px-3 text-sm font-medium hover:bg-background/60"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <NftGrid
        key={gridKey}
        contract={contract}
        query={{ search: trimmed, listed, auctioned, sort: safeSort }}
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
      className={cx(
        "h-10 rounded-full px-3 text-sm font-medium transition",
        active ? "bg-foreground text-background" : "border border-border bg-card hover:bg-background/60"
      )}
    >
      {children}
    </button>
  );
}
