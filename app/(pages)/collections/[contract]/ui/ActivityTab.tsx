"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Row = {
  id: string;
  type: string;
  tokenId: string;
  nftName?: string | null;
  imageUrl?: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  price: number | null;
  currencySymbol?: string | null;
  timestamp: string;
  txHash: string;
  marketplace?: string | null;
};

export default function ActivityTab({ contract }: { contract: string }) {
  const [type, setType] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "30");
    if (type) p.set("type", type);
    return p.toString();
  }, [type]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setDone(false);
  }, [qs]);

  async function loadMore() {
    if (loading || done) return;
    setLoading(true);

    const url = new URL(`/api/collections/${contract}/activities?${qs}`, window.location.origin);
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json().catch(() => null);

    const next = (data?.items ?? []) as Row[];
    const nextCursor = (data?.nextCursor ?? null) as string | null;

    setItems((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      const merged = [...prev];
      for (const it of next) if (!seen.has(it.id)) merged.push(it);
      return merged;
    });

    setCursor(nextCursor);
    if (!nextCursor || next.length === 0) setDone(true);
    setLoading(false);
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "800px" }
    );

    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentinelRef.current, cursor, loading, done, qs]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Activity</div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-2xl border bg-background px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="SALE">Sale</option>
          <option value="LISTING">Listing</option>
          <option value="UNLISTING">Unlisting</option>
          <option value="TRANSFER">Transfer</option>
          <option value="BID">Bid</option>
          <option value="MINT">Mint</option>
          <option value="AUCTION_CREATE">Auction Create</option>
          <option value="AUCTION_FINALIZE">Auction Finalize</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border">
        {items.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 border-b p-4 last:border-b-0">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {r.type} <span className="text-muted-foreground">#{r.tokenId}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(r.timestamp).toLocaleString()}
              </div>
            </div>

            <div className="text-right">
              {r.price != null ? (
                <div className="text-sm font-semibold">
                  {r.price} {r.currencySymbol ?? ""}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
              {r.txHash ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.txHash.slice(0, 10)}…
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {loading ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">Loading…</div>
      ) : null}
    </div>
  );
}
