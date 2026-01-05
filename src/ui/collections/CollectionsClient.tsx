// src/ui/collections/CollectionsClient.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useInfiniteQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ethers } from "ethers";

import { Button } from "@/src/ui/Button";
import CollectionsSkeleton from "./CollectionsSkeleton";


const PLACEHOLDER =
  "https://res.cloudinary.com/dx1bqxtys/image/upload/v1750638432/panthart/amy5m5u7nxmhlh8brv6d.png";


type CollectionItem = {
  id: string;
  name: string;
  symbol: string;
  contract: string;
  logoUrl: string | null;
  coverUrl: string | null;
  standard: string;
  indexStatus: string;
  floorPrice: number; // snapshot
  volume: number; // snapshot all-time
  itemsCount: number;
  ownersCount: number;
  change24h: number;
  createdAt: string;
  updatedAt: string;
  activeFloorWei: string | null; // computed per-page
};

type ApiResp = {
  items: CollectionItem[];
  nextCursor: string | null;
};

type Filters = {
  q: string;
  sort: string; // keep as string to be lenient
  standard: string;
  indexed: boolean;
};

function fmtCompact(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (n < 1000) return n.toFixed(2);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtEtnFromWeiString(wei: string | null) {
  if (!wei) return "—";
  try {
    const s = ethers.formatUnits(wei, 18);
    const n = Number(s);
    if (!Number.isFinite(n)) return "—";
    return `${fmtCompact(n)} ETN`;
  } catch {
    return "—";
  }
}

function buildQuery(filters: Filters, cursor?: string | null) {
  const sp = new URLSearchParams();
  if (filters.q.trim()) sp.set("q", filters.q.trim());
  if (filters.sort && filters.sort !== "volume_desc") sp.set("sort", filters.sort);
  if (filters.standard) sp.set("standard", filters.standard);
  if (filters.indexed) sp.set("indexed", "1");
  sp.set("limit", "24");
  if (cursor) sp.set("cursor", cursor);
  return sp.toString();
}

async function fetchCollections(filters: Filters, cursor?: string | null) {
  const qs = buildQuery(filters, cursor);
  const res = await fetch(`/api/collections?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load collections");
  return (await res.json()) as ApiResp;
}

function useBottomSentinel(cb: () => void, enabled: boolean) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (e?.isIntersecting) cb();
      },
      { rootMargin: "900px 0px" }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [cb, enabled]);

  return ref;
}

export default function CollectionsClient({
  initialFilters,
}: {
  initialFilters: Filters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Source of truth = URL, but we keep local state for “typing”
  const [qDraft, setQDraft] = React.useState(initialFilters.q);

  const filters: Filters = React.useMemo(() => {
    const q = (searchParams.get("q") || initialFilters.q || "").trim();
    const sort = (searchParams.get("sort") || initialFilters.sort || "volume_desc").trim();
    const standard = (searchParams.get("standard") || initialFilters.standard || "").trim();
    const indexed = (searchParams.get("indexed") || (initialFilters.indexed ? "1" : "0")) === "1";
    return { q, sort, standard, indexed };
  }, [searchParams, initialFilters]);

  // Keep draft in sync when URL changes (e.g. back/forward)
  React.useEffect(() => {
    setQDraft(filters.q);
  }, [filters.q]);

  const query = useInfiniteQuery({
    queryKey: ["collections", filters],
    queryFn: ({ pageParam }) => fetchCollections(filters, (pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 10_000,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const canLoadMore = !!query.hasNextPage && !query.isFetchingNextPage;

  const sentinelRef = useBottomSentinel(
    () => {
      if (canLoadMore) query.fetchNextPage();
    },
    canLoadMore
  );

  function setUrl(next: Partial<Filters>) {
    const merged: Filters = { ...filters, ...next };

    const sp = new URLSearchParams();
    if (merged.q.trim()) sp.set("q", merged.q.trim());
    if (merged.sort && merged.sort !== "volume_desc") sp.set("sort", merged.sort);
    if (merged.standard) sp.set("standard", merged.standard);
    if (merged.indexed) sp.set("indexed", "1");

    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault();
    setUrl({ q: qDraft });
  }

  return (
    <div className="space-y-5">
      {/* Filters bar */}
      <div className="sticky top-16 z-40 rounded-3xl border border-border bg-background/60 backdrop-blur-md">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={onSubmitSearch} className="flex-1">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
              <span className="text-xs text-muted">Search</span>
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="Collections, symbols, contracts…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
              <Button type="submit" variant="secondary" size="sm">
                Go
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filters.sort}
              onChange={(e) => setUrl({ sort: e.target.value })}
              className="h-10 rounded-2xl border border-border bg-card px-3 text-sm outline-none"
            >
              <option value="volume_desc">Sort: Volume</option>
              <option value="floor_asc">Sort: Floor</option>
              <option value="newest">Sort: Newest</option>
            </select>

            <select
              value={filters.standard}
              onChange={(e) => setUrl({ standard: e.target.value })}
              className="h-10 rounded-2xl border border-border bg-card px-3 text-sm outline-none"
            >
              <option value="">All standards</option>
              <option value="ERC721">ERC-721</option>
              <option value="ERC1155">ERC-1155</option>
            </select>

            <button
              type="button"
              onClick={() => setUrl({ indexed: !filters.indexed })}
              className={[
                "h-10 rounded-2xl border px-3 text-sm font-semibold transition",
                filters.indexed
                  ? "border-border bg-card"
                  : "border-border bg-background/40 hover:bg-card",
              ].join(" ")}
            >
              Indexed
            </button>

            {(filters.q || filters.standard || filters.indexed || filters.sort !== "volume_desc") ? (
              <Button
                href="/collections"
                variant="ghost"
                size="sm"
              >
                Reset
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Results */}
      {query.isLoading ? (
        <CollectionsSkeleton />
      ) : query.isError ? (
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="text-sm font-semibold">Couldn’t load collections</div>
          <div className="mt-1 text-sm text-muted">
            Try again — or adjust your filters.
          </div>
          <div className="mt-4">
            <button
              onClick={() => query.refetch()}
              className="rounded-2xl border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-card transition"
            >
              Retry
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="text-sm font-semibold">No collections found</div>
          <div className="mt-1 text-sm text-muted">
            Try a different search term or clear filters.
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {items.map((c) => {
            const change = c.change24h ?? 0;
            const up = change >= 0;

            return (
              <Link
                key={c.id}
                href={`/collections/${c.contract}`}
                className={[
                  "group flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-4",
                  "transition hover:bg-background/60",
                ].join(" ")}
              >
                <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-border bg-background">
                  <Image
                    src={c.logoUrl ?? PLACEHOLDER}
                    alt={c.name}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold">
                      {c.name}
                    </div>
                    <div className="text-xs text-muted">{c.symbol}</div>

                    <span
                      className={[
                        "ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                        up
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-red-500/30 bg-red-500/10 text-red-400",
                      ].join(" ")}
                      title="24h change (snapshot)"
                    >
                      {up ? "+" : ""}
                      {Number.isFinite(change) ? change.toFixed(1) : "0.0"}%
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="whitespace-nowrap">
                      Floor (active){" "}
                      <span className="font-semibold text-foreground/90">
                        {fmtEtnFromWeiString(c.activeFloorWei)}
                      </span>
                    </span>

                    <span className="whitespace-nowrap">
                      All-time volume{" "}
                      <span className="font-semibold text-foreground/90">
                        {fmtCompact(c.volume ?? 0)} ETN
                      </span>
                    </span>

                    <span className="whitespace-nowrap">
                      Items{" "}
                      <span className="font-semibold text-foreground/90">
                        {c.itemsCount ?? 0}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end gap-1">
                  <div className="text-xs text-muted">{c.standard}</div>
                  <div className="text-xs text-muted">{c.indexStatus}</div>
                </div>
              </Link>
            );
          })}

          {/* Fetching next page skeleton */}
          {query.isFetchingNextPage ? <CollectionsSkeleton compact /> : null}

          {/* Sentinel */}
          <div ref={sentinelRef} />

          {/* Manual load more fallback */}
          {query.hasNextPage ? (
            <div className="pt-2">
              <button
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-background/60 transition disabled:opacity-60"
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : (
            <div className="pt-2 text-center text-xs text-muted">
              You’ve reached the end.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
