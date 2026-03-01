// app/(pages)/profile/ui/widgets/ProfileNftGrid.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProfileNftCard, { type ProfileNftItem } from "./ProfileNftCard";

type Query = {
  search: string;
  listed: boolean;
  auctioned: boolean;
  sort: "newest" | "oldest";
};

type ApiResp = {
  items: ProfileNftItem[];
  nextCursor: string | null;
};

export default function ProfileNftGrid({
  address,
  query,
  onBusyChange,
}: {
  address: string;
  query: Query;
  onBusyChange?: (b: boolean) => void;
}) {
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "36");
    if (query.search) p.set("search", query.search);
    if (query.listed) p.set("listed", "1");
    if (query.auctioned) p.set("auctioned", "1");
    p.set("sort", query.sort);
    return p.toString();
  }, [query.search, query.listed, query.auctioned, query.sort]);

  // ✅ key remount resets state without setState effect
  const key = useMemo(() => `${address}:${qs}`, [address, qs]);

  return <ProfileNftGridInner key={key} address={address} qs={qs} onBusyChange={onBusyChange} />;
}

function ProfileNftGridInner({
  address,
  qs,
  onBusyChange,
}: {
  address: string;
  qs: string;
  onBusyChange?: (b: boolean) => void;
}) {
  const [items, setItems] = useState<ProfileNftItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onBusyChange?.(loading);
  }, [loading, onBusyChange]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);

    const base = `/api/profile/${encodeURIComponent(address)}/nfts`;
    const url = new URL(`${base}?${qs}`, window.location.origin);
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as ApiResp | null;

    if (!res.ok || !data || !Array.isArray(data.items)) {
      setDone(true);
      setLoading(false);
      return;
    }

    setItems((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      const merged = [...prev];
      for (const it of data.items) if (!seen.has(it.id)) merged.push(it);
      return merged;
    });

    setCursor(data.nextCursor ?? null);
    if (!data.nextCursor || data.items.length === 0) setDone(true);

    setLoading(false);
  }, [address, cursor, done, loading, qs]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "900px" }
    );

    io.observe(el);
    io.observe(el);

    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div className="mt-6">
      {items.length === 0 && !loading ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No items found.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((it) => (
          <ProfileNftCard key={it.id} item={it} />
        ))}

        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="aspect-square bg-muted" />
                <div className="p-3">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))
          : null}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {loading ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">Loading…</div>
      ) : null}
    </div>
  );
}
