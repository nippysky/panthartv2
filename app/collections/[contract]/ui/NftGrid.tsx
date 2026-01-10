/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NftCard from "./NftCard";
import NftModal from "./NftModal";

type Item = {
  id: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  hasVideo: boolean;
  isListed: boolean;
  isAuctioned: boolean;
  createdAt: string;
};

function toNumTokenId(t: string) {
  const n = Number(String(t).trim());
  return Number.isFinite(n) ? n : 0;
}

export default function NftGrid({
  contract,
  query,
  onBusyChange,
}: {
  contract: string;
  query: { search: string; listed: boolean; auctioned: boolean; sort: string };
  onBusyChange?: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState<Item | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "24");
    if (query.search.trim()) p.set("search", query.search.trim());
    if (query.listed) p.set("listed", "true");
    if (query.auctioned) p.set("auctioned", "true");
    if (query.sort) p.set("sort", query.sort);
    return p.toString();
  }, [query]);

  const sortMode = query.sort;

  const fetchPage = useCallback(
    async (cursorParam: string | null, replace: boolean) => {
      setLoading(true);
      onBusyChange?.(true);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const url = new URL(
          `/api/collections/${contract}/items?${qs}`,
          window.location.origin
        );
        if (cursorParam) url.searchParams.set("cursor", cursorParam);

        const res = await fetch(url.toString(), {
          cache: "no-store",
          signal: ac.signal,
        });
        const data = await res.json().catch(() => null);

        const next = (data?.items ?? []) as Item[];
        const nextCursor = (data?.nextCursor ?? null) as string | null;

        setItems((prev) => {
          const base = replace ? [] : prev;
          const seen = new Set(base.map((x) => x.id));
          const merged = [...base];
          for (const it of next) if (!seen.has(it.id)) merged.push(it);

          // client polish for sequential feel (still keep backend as source of truth)
          if (sortMode === "oldest") {
            merged.sort((a, b) => toNumTokenId(a.tokenId) - toNumTokenId(b.tokenId));
          } else if (sortMode === "newest") {
            merged.sort((a, b) => toNumTokenId(b.tokenId) - toNumTokenId(a.tokenId));
          }

          return merged;
        });

        setCursor(nextCursor);
        setDone(!nextCursor || next.length === 0);
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error(e);
      } finally {
        setLoading(false);
        onBusyChange?.(false);
      }
    },
    [contract, qs, onBusyChange, sortMode]
  );

  // ✅ Reset results when filters/search/sort changes (THIS is why your search felt “static”)
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setDone(false);
    fetchPage(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, qs]);

  const loadMore = useCallback(() => {
    if (loading || done) return;
    fetchPage(cursor, false);
  }, [cursor, done, fetchPage, loading]);

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

  const showInitialSkeleton = loading && items.length === 0;

  return (
    <div className="mt-6">
      {loading && items.length > 0 ? (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/15 border-t-foreground" />
          Updating results…
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {showInitialSkeleton
          ? Array.from({ length: 10 }).map((_, i) => <NftCardSkeleton key={i} />)
          : items.map((it, idx) => (
              <NftCard
                key={it.id}
                item={it as any}
                onOpen={() => setOpen(it)}
                priority={idx < 8}
              />
            ))}

        {loading && items.length > 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <NftCardSkeleton key={`more-${i}`} />
            ))
          : null}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {done && items.length === 0 && !loading ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          No items found.
        </div>
      ) : null}

      <NftModal
        open={!!open}
        item={open}
        contract={contract}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

function NftCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-square bg-muted">
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02),rgba(255,255,255,0.06))] bg-size-[200%_100%]" />
      </div>
      <div className="p-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
