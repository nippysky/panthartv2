/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NftCard from "./NftCard";
import NftModal from "./NftModal";

export type GridItem = {
  id: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  mediaType?: "video" | "image" | "unknown";
  hasVideo: boolean;
  isListed: boolean;
  isAuctioned: boolean;
  createdAt: string;
};

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-square">
        <div className="absolute inset-0 animate-pulse bg-muted" />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.08),transparent)] bg-size-[200%_100%] animate-[shimmer_1.2s_infinite]" />
      </div>
      <div className="p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export default function NftGrid({
  contract,
  query,
}: {
  contract: string;
  query: { search: string; listed: boolean; auctioned: boolean; sort: string };
}) {
  const [items, setItems] = useState<GridItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState<GridItem | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "24");

    if (query.search) p.set("search", query.search);
    if (query.listed) p.set("listed", "true");
    if (query.auctioned) p.set("auctioned", "true");
    if (query.sort) p.set("sort", query.sort);

    return p.toString();
  }, [query]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const url = new URL(`/api/collections/${contract}/items?${qs}`, window.location.origin);
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), { cache: "no-store", signal: ac.signal });
      const data = await res.json().catch(() => null);

      const next = (data?.items ?? []) as GridItem[];
      const nextCursor = (data?.nextCursor ?? null) as string | null;

      setItems((prev) => {
        // keep stable and prevent duplicates
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const it of next) if (!seen.has(it.id)) merged.push(it);
        return merged;
      });

      setCursor(nextCursor);
      if (!nextCursor || next.length === 0) setDone(true);
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      setLoading(false);
    }
  }, [contract, qs, cursor, loading, done]);

  // Initial fetch
  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "900px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const initialLoading = loading && items.length === 0;
  const loadingMore = loading && items.length > 0;

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {initialLoading
          ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((it, idx) => (
              <NftCard
                key={it.id}
                item={it}
                contract={contract}
                priority={idx < 10}
                onOpen={() => setOpen(it)}
              />
            ))}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {loadingMore ? (
        <div className="mt-6 flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : null}

      {done && !loading && items.length === 0 ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">No items found.</div>
      ) : null}

 <NftModal open={!!open} item={open} contract={contract} onClose={() => setOpen(null)} />

    </div>
  );
}
