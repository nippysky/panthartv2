// app/(pages)/profile/ui/widgets/ProfileCollectionGrid.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProfileCollectionCard, { ProfileCollectionItem } from "./ProfileCollectionCard";


type Query = { search: string };

type ApiResp = {
  items: ProfileCollectionItem[];
  nextCursor: string | null;
};

export default function ProfileCollectionGrid({
  address,
  query,
}: {
  address: string;
  query: Query;
}) {
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "24");
    if (query.search) p.set("search", query.search);
    return p.toString();
  }, [query.search]);

  // ✅ Key-based remount = reset state without setState in useEffect
  const key = useMemo(() => `${address}:${qs}`, [address, qs]);

  return <ProfileCollectionGridInner key={key} address={address} qs={qs} />;
}

function ProfileCollectionGridInner({ address, qs }: { address: string; qs: string }) {
  const [items, setItems] = useState<ProfileCollectionItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);

    const base = `/api/profile/${encodeURIComponent(address)}/collections`;
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
          No collections found.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <ProfileCollectionCard key={it.id} item={it} />
        ))}

        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="h-28 bg-muted" />
                <div className="p-3">
                  <div className="h-4 w-2/3 rounded bg-muted" />
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
