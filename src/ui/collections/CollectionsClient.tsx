// src/ui/collections/CollectionsClient.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";

import { Button } from "@/src/ui/Button";
import { Container } from "@/src/ui/Container";
import { Skeleton } from "@/src/ui/Skeleton";
import { formatCompactAmount } from "@/src/lib/format";

type SortKey = "volume" | "floor" | "newest";

export type CollectionListItem = {
  id: string;
  name: string;
  symbol: string;
  contract: string;
  logoUrl: string | null;
  coverUrl: string | null;
  floorActive: number | null;
  volumeAllTime: number;
  itemsCount: number;
  ownersCount: number;
  indexStatus: "PENDING" | "QUEUED" | "INDEXING" | "COMPLETED" | "ERROR";
};

type ApiResp = {
  items: CollectionListItem[];
  nextCursor: string | null;
};

type CurrencyOption = {
  id: string;
  symbol: string;
  decimals: number;
  kind: "NATIVE" | "ERC20";
  tokenAddress?: string | null;
};

function clampSort(v: unknown): SortKey {
  return v === "floor" || v === "newest" || v === "volume" ? v : "volume";
}

function buildQueryString(params: Record<string, string | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim().length) usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function fetchCollectionsPage(args: {
  sort: SortKey;
  currency: string;
  cursor: string | null;
  signal?: AbortSignal;
}): Promise<ApiResp> {
  const qs = buildQueryString({
    sort: args.sort,
    currency: args.currency,
    cursor: args.cursor ?? undefined,
    limit: "24",
    bust: String(Date.now()), // ✅ force truth refresh
  });

  const res = await fetch(`/api/collections${qs}`, {
    method: "GET",
    signal: args.signal,
    cache: "no-store",
    headers: { Accept: "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
  });

  if (!res.ok) throw new Error(`Failed to load collections (${res.status})`);
  return (await res.json()) as ApiResp;
}

function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-44 rounded-lg" />
          <Skeleton className="mt-2 h-3 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-3">
          <Skeleton className="h-3 w-20 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-24 rounded-lg" />
        </div>
        <div className="rounded-2xl border border-border bg-background p-3">
          <Skeleton className="h-3 w-24 rounded-lg" />
          <Skeleton className="mt-2 h-4 w-28 rounded-lg" />
        </div>
      </div>

      <Skeleton className="mt-4 h-3 w-44 rounded-lg" />
    </div>
  );
}

function CollectionCard({ c, currencySymbol }: { c: CollectionListItem; currencySymbol: string }) {
  return (
    <Link
      href={`/collections/${c.contract}`}
      className="group block rounded-3xl border border-border bg-card p-4 sm:p-5 transition hover:bg-card/80"
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl border border-border bg-background overflow-hidden shrink-0">
          {c.logoUrl ? (
            <Image src={c.logoUrl} alt={c.name} width={48} height={48} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="truncate text-sm font-semibold">{c.name}</div>
            <div className="truncate text-xs text-muted">{c.symbol}</div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>Owners <span className="text-foreground/90">{c.ownersCount}</span></span>
            <span>Items <span className="text-foreground/90">{c.itemsCount}</span></span>
          </div>
        </div>

        <div className="shrink-0">
          <div className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-foreground/80">
            {c.indexStatus}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-3">
          <div className="text-[11px] text-muted">Floor (active)</div>
          <div className="mt-1 text-sm font-semibold">
            {c.floorActive == null ? "—" : formatCompactAmount(c.floorActive, currencySymbol)}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-3">
          <div className="text-[11px] text-muted">All-time volume</div>
          <div className="mt-1 text-sm font-semibold">
            {formatCompactAmount(c.volumeAllTime, currencySymbol)}
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-muted">
        Contract{" "}
        <span className="font-mono text-foreground/70">
          {c.contract.slice(0, 6)}…{c.contract.slice(-4)}
        </span>
      </div>
    </Link>
  );
}

export default function CollectionsClient(props: {
  initialItems: CollectionListItem[];
  initialNextCursor: string | null;
  initialSort: SortKey;
  initialCurrency: string;
}) {
  const [sort, setSort] = React.useState<SortKey>(props.initialSort);
  const [currency, setCurrency] = React.useState<string>(props.initialCurrency);

  const currenciesQ = useQuery<{ currencies: CurrencyOption[] }, Error>({
    queryKey: ["currencies"],
    queryFn: async () => {
      const res = await fetch("/api/currencies", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load currencies (${res.status})`);
      return (await res.json()) as { currencies: CurrencyOption[] };
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const currencyOptions = React.useMemo(() => {
    const raw = currenciesQ.data?.currencies ?? [];
    const map = new Map<string, CurrencyOption>();
    for (const c of raw) map.set(c.id, c);
    if (!map.has("native")) map.set("native", { id: "native", symbol: "ETN", decimals: 18, kind: "NATIVE" });
    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.id === "native" ? -1 : b.id === "native" ? 1 : a.symbol.localeCompare(b.symbol)));
    return arr;
  }, [currenciesQ.data]);

  const currencySymbol =
    currencyOptions.find((c) => c.id === currency)?.symbol ??
    currencyOptions.find((c) => c.id === "native")?.symbol ??
    "ETN";

  const queryKey = React.useMemo(() => ["collections", sort, currency] as const, [sort, currency]);

  const shouldHydrate = sort === props.initialSort && currency === props.initialCurrency;

  const collectionsQ = useInfiniteQuery<
    ApiResp,
    Error,
    InfiniteData<ApiResp, string | null>,
    typeof queryKey,
    string | null
  >({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      fetchCollectionsPage({ sort, currency, cursor: pageParam ?? null, signal }),
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: null,
    ...(shouldHydrate
      ? {
          initialData: {
            pages: [{ items: props.initialItems, nextCursor: props.initialNextCursor }],
            pageParams: [null],
          },
        }
      : {}),
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });

  const items = collectionsQ.data?.pages.flatMap((p) => p.items) ?? [];

  const hasData = (collectionsQ.data?.pages?.length ?? 0) > 0;
  const showSkeleton = !hasData && collectionsQ.isFetching;
  const isRefreshing = hasData && collectionsQ.isFetching && !collectionsQ.isFetchingNextPage;

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first) return;
        if (first.isIntersecting && collectionsQ.hasNextPage && !collectionsQ.isFetchingNextPage) {
          void collectionsQ.fetchNextPage();
        }
      },
      { rootMargin: "800px 0px" }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [collectionsQ]);

  return (
    <div className="page-enter">
      <section className="pt-10 sm:pt-14">
        <Container>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Collections</h1>
              <p className="mt-2 text-sm text-muted max-w-[70ch]">
                Floor is based on active listings. Volume is all-time.
              </p>
              <div className="mt-3 text-xs text-muted">
                <span className="text-foreground/80">{items.length}</span> results
                {isRefreshing ? <span className="ml-2 animate-pulse">Refreshing…</span> : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-2xl border border-border bg-card px-3 py-2 text-sm outline-none"
              >
                {currencyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.symbol}
                  </option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(clampSort(e.target.value))}
                className="rounded-2xl border border-border bg-card px-3 py-2 text-sm outline-none"
              >
                <option value="volume">Sort: Volume</option>
                <option value="floor">Sort: Floor</option>
                <option value="newest">Sort: Newest</option>
              </select>
            </div>
          </div>

          {collectionsQ.isError ? (
            <div className="mt-6 rounded-3xl border border-border bg-card p-6">
              <div className="text-sm font-semibold">Failed to load collections</div>
              <p className="mt-2 text-sm text-muted">{collectionsQ.error.message}</p>
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={() => void collectionsQ.refetch()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {showSkeleton ? (
                  Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)
                ) : items.length === 0 ? (
                  <div className="col-span-full rounded-3xl border border-border bg-card p-6">
                    <div className="text-sm font-semibold">No results</div>
                    <p className="mt-2 text-sm text-muted">No collections match this view yet.</p>
                  </div>
                ) : (
                  items.map((c) => <CollectionCard key={c.contract} c={c} currencySymbol={currencySymbol} />)
                )}
              </div>

              {isRefreshing ? (
                <div className="mt-4 rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="h-2 w-full animate-pulse rounded-full bg-foreground/10" />
                </div>
              ) : null}

              <div ref={sentinelRef} className="h-10" />

              <div className="mt-6 flex justify-center">
                {collectionsQ.hasNextPage ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void collectionsQ.fetchNextPage()}
                    disabled={collectionsQ.isFetchingNextPage}
                  >
                    {collectionsQ.isFetchingNextPage ? "Loading…" : "Load more"}
                  </Button>
                ) : (
                  <div className="text-xs text-muted">End of list</div>
                )}
              </div>
            </div>
          )}
        </Container>
      </section>

      <div className="h-10 sm:h-14" />
    </div>
  );
}
