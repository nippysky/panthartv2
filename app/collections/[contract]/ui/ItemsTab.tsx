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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or token ID…"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
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
            className="rounded-2xl border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            {rarityEnabled ? <option value="rarity_asc">Rarity (best)</option> : null}
            {rarityEnabled ? <option value="rarity_desc">Rarity (worst)</option> : null}
          </select>
        </div>
      </div>

      <NftGrid contract={contract} query={{ search, listed, auctioned, sort: safeSort }} />
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
        active ? "bg-foreground text-background" : "border border-border bg-card hover:bg-background/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
