// app/(pages)/profile/ui/tabs/UserActivityTab.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  type: string;
  contract: string;
  tokenId: string;
  nftName?: string | null;
  imageUrl?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  price?: number | null;
  timestamp: string;
  txHash: string;
};

function isRealTxHash(h: string | null | undefined) {
  return /^0x[0-9a-fA-F]{64}$/.test(String(h ?? ""));
}

const ETN_TX_BASE = "https://blockexplorer.electroneum.com/tx/";
function txUrl(hash: string) {
  return `${ETN_TX_BASE}${hash}`;
}
function formatHashShort(hash: string) {
  return `${hash.slice(0, 10)}…`;
}

function fmt2(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
}

function ExternalIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v7H3V3h7" />
    </svg>
  );
}

export default function UserActivityTab({ address }: { address: string }) {
  const [type, setType] = useState("");

  const key = useMemo(() => `${address}:${type || "ALL"}`, [address, type]);

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

      <UserActivityList key={key} address={address} type={type} />
    </div>
  );
}

function UserActivityList({ address, type }: { address: string; type: string }) {
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

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);

    const base = `/api/profile/${encodeURIComponent(address)}/activities`;
    const url = new URL(`${base}?${qs}`, window.location.origin);
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || !Array.isArray(data.items)) {
      setDone(true);
      setLoading(false);
      return;
    }

    setItems((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      const merged = [...prev];
      for (const it of data.items as Row[]) if (!seen.has(it.id)) merged.push(it);
      return merged;
    });

    setCursor(data.nextCursor ?? null);
    if (!data.nextCursor || (data.items as Row[]).length === 0) setDone(true);

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
    <>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        {items.map((r) => {
          const hasTx = isRealTxHash(r.txHash);
          const href = hasTx ? txUrl(r.txHash) : null;

          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 border-b border-border p-4 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {r.type}{" "}
                  <Link
                    href={`/collections/${r.contract}/${r.tokenId}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    #{r.tokenId}
                  </Link>
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(r.timestamp).toLocaleString()}
                </div>
              </div>

              <div className="text-right">
                {r.price != null ? (
                  <div className="text-sm font-semibold">{fmt2(r.price)} ETN</div>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}

                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={r.txHash}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <span>View txn</span>
                    <span className="text-muted-foreground">{formatHashShort(r.txHash)}</span>
                    <ExternalIcon className="h-3.5 w-3.5 opacity-80" />
                  </a>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {loading ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">Loading…</div>
      ) : null}

      {!loading && done && items.length === 0 ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">No activity found.</div>
      ) : null}
    </>
  );
}
