"use client";

import * as React from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";

import AuctionNowCard from "./AuctionNowCard";
import AuctionCardSkeleton from "./AuctionCardSkeleton";

export type AuctionGridItem = {
  id: string; // public id (prefer chain id when possible)
  dbId: string; // db id (cuid)
  nft: {
    contract: string;
    tokenId: string;
    name: string;
    image: string | null;
    standard: "ERC721" | "ERC1155" | string;
  };
  startTime: string;
  endTime: string;
  currency: {
    id: string | null;
    kind: "NATIVE" | "ERC20";
    symbol: string;
    decimals: number;
    tokenAddress: string | null;
  };
  price: { currentWei?: string; current?: string };
};

type PageShape = { items: AuctionGridItem[]; nextCursor: string | null };

type AuctionGridProps = {
  initialPage?: PageShape;
  pageSize?: number;

  // purely for better client-side UX (doesn't change API shape)
  query?: string;
  sort?: "endingSoon" | "newest";
};

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

export default function AuctionGrid({
  initialPage = { items: [], nextCursor: null },
  pageSize = 24,
  query = "",
  sort = "endingSoon",
}: AuctionGridProps) {
  const initialInfinite = React.useMemo<InfiniteData<PageShape, string | undefined>>(
    () => ({ pages: [initialPage], pageParams: [undefined] }),
    [initialPage]
  );

  const maybeInitialData =
    initialPage.items.length > 0 || initialPage.nextCursor
      ? (initialInfinite as InfiniteData<PageShape, string | undefined>)
      : undefined;

  // ✅ Keep a stable "hasLoadedOnce" flag so empty-state doesn't flicker to skeleton on polling
  const hasLoadedOnceRef = React.useRef(false);

  const queryKey = React.useMemo(() => ["auctions", "active", pageSize] as const, [pageSize]);

  const qLower = query.trim().toLowerCase();

  const q = useInfiniteQuery<
    PageShape,
    Error,
    InfiniteData<PageShape, string | undefined>,
    readonly ["auctions", "active", number],
    string | undefined
  >({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      // ✅ IMPORTANT:
      // Use chain=1 so “Current bid” reflects on-chain state (DB can lag).
      const url = pageParam
        ? `/api/auction/active?limit=${pageSize}&cursor=${encodeURIComponent(pageParam)}&chain=1`
        : `/api/auction/active?limit=${pageSize}&chain=1`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load auctions");
      return (await res.json()) as PageShape;
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: maybeInitialData,

    // ✅ More human interval (no annoying flicker). Still "live".
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,

    staleTime: 25_000,
    gcTime: 5 * 60_000,
  });

  const { data, isPending, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage } = q;

  React.useEffect(() => {
    if (!isPending) hasLoadedOnceRef.current = true;
  }, [isPending]);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root: null, rootMargin: "600px", threshold: 0 }
    );

    io.observe(node);
    return () => io.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const rawItems = React.useMemo<AuctionGridItem[]>(
    () => (data?.pages ?? maybeInitialData?.pages ?? []).flatMap((p: PageShape) => p.items),
    [data, maybeInitialData]
  );

  // ✅ Client-side filter/sort for a consistent toolbar UX (still backed by API paging)
  const items = React.useMemo(() => {
    let out = rawItems;

    if (qLower) {
      out = out.filter((it) => {
        const name = (it.nft?.name ?? "").toLowerCase();
        const contract = (it.nft?.contract ?? "").toLowerCase();
        const tokenId = String(it.nft?.tokenId ?? "");
        return name.includes(qLower) || contract.includes(qLower) || tokenId.includes(qLower);
      });
    }

    out =
      sort === "newest"
        ? [...out].sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime))
        : [...out].sort((a, b) => +new Date(a.endTime) - +new Date(b.endTime));

    return out;
  }, [rawItems, qLower, sort]);

  // ✅ Skeleton ONLY on first load
  const showSkeleton = isPending && items.length === 0;

  // ✅ Empty state when loaded and there are no items
  const showEmpty = !isPending && items.length === 0;

  if (showSkeleton) {
    return (
      <section className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 mt-6 mb-16">
        {Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
          <AuctionCardSkeleton key={i} />
        ))}
      </section>
    );
  }

  if (showEmpty) {
    return (
      <div className="rounded-[22px] border border-border bg-card p-6 text-center mt-6 mb-16">
        <div className="text-sm font-semibold">No live auctions right now</div>
        <div className="mt-1 text-sm text-muted-foreground">
          New auctions appear here the moment they go live.
        </div>

        {/* ✅ If we're polling in the background, show subtle status instead of skeleton flicker */}
        {isFetching ? <div className="mt-3 text-xs text-muted-foreground">Checking for new auctions…</div> : null}
      </div>
    );
  }

  return (
    <section className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 mt-6 mb-16">
      {items.map((it: AuctionGridItem) => (
        <AuctionNowCard
          key={it.id}
          nftAddress={it.nft.contract}
          tokenId={it.nft.tokenId}
          name={it.nft.name}
          image={it.nft.image || "/opengraph-image.png"}
          endTime={it.endTime}
          href={`/auction-now/${it.dbId}`}
          subtitle={`${it.price.current ?? "—"} ${it.currency.symbol}`}
        />
      ))}

      <div ref={sentinelRef} className="col-span-full h-0" aria-hidden />

      {isFetchingNextPage &&
        Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => <AuctionCardSkeleton key={`more-${i}`} />)}

      {/* Optional: subtle “updating” hint when there ARE items */}
      {isFetching && !isFetchingNextPage ? (
        <div className={cx("col-span-full text-xs text-muted-foreground mt-1")}>Updating…</div>
      ) : null}
    </section>
  );
}