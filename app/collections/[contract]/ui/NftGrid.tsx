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
  mediaType?: "video" | "image" | "unknown";
  hasVideo: boolean;
  isListed: boolean;
  isAuctioned: boolean;
  createdAt: string;
};

export default function NftGrid({
  contract,
  query,
}: {
  contract: string;
  query: { search: string; listed: boolean; auctioned: boolean; sort: string };
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

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);

    // Cancel any in-flight request (typing / fast tabbing)
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const url = new URL(`/api/collections/${contract}/items?${qs}`, window.location.origin);
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), { cache: "no-store", signal: ac.signal });
      const data = await res.json().catch(() => null);

      const next = (data?.items ?? []) as Item[];
      const nextCursor = (data?.nextCursor ?? null) as string | null;

      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const it of next) if (!seen.has(it.id)) merged.push(it);
        return merged;
      });

      setCursor(nextCursor);
      if (!nextCursor || next.length === 0) setDone(true);
    } catch (e: any) {
      // Abort is expected during search changes
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      setLoading(false);
    }
  }, [contract, qs, cursor, loading, done]);

  // Intersection observer only cares about loadMore; no weird deps
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

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((it) => (
          <NftCard key={it.id} item={it} onOpen={() => setOpen(it)} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {loading ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">Loading…</div>
      ) : null}

      {done && items.length === 0 ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">No items found.</div>
      ) : null}

      <NftModal open={!!open} item={open} onClose={() => setOpen(null)} />
    </div>
  );
}
