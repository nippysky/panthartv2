/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getStr(o: Record<string, unknown>, k: string): string | null {
  const v = o[k];
  return typeof v === "string" ? v : v == null ? null : String(v);
}

function getNum(o: Record<string, unknown>, k: string): number | null {
  const v = o[k];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeToRow(it: unknown, fallbackTokenId?: string): Row | null {
  if (!isObject(it)) return null;

  const id = getStr(it, "id") ?? "";
  const type = (getStr(it, "type") ?? "").toUpperCase();
  const tokenId = getStr(it, "tokenId") ?? fallbackTokenId ?? "";

  const timestamp = getStr(it, "timestamp") ?? "";
  const txHash = getStr(it, "txHash") ?? "";

  if (!id || !timestamp) return null;

  return {
    id,
    type,
    tokenId,
    nftName: getStr(it, "nftName"),
    imageUrl: getStr(it, "imageUrl"),
    fromAddress: getStr(it, "fromAddress"),
    toAddress: getStr(it, "toAddress"),
    price: getNum(it, "price"),
    currencySymbol: getStr(it, "currencySymbol"),
    timestamp,
    txHash,
    marketplace: getStr(it, "marketplace"),
  };
}

// ✅ Only treat full EVM tx hashes as “real”
function isRealTxHash(h: string | null | undefined) {
  return /^0x[0-9a-fA-F]{64}$/.test(String(h ?? ""));
}

// ✅ Explorer base (change here if your ETN explorer uses a different URL)
const ETN_TX_BASE = "https://blockexplorer.electroneum.com/tx/";

function txUrl(hash: string) {
  return `${ETN_TX_BASE}${hash}`;
}

function formatHashShort(hash: string) {
  return `${hash.slice(0, 10)}…`;
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

/**
 * Wrapper: key-based remount to avoid calling setState inside useEffect
 * (fixes react-hooks/set-state-in-effect lint error).
 */
export default function ActivityTab({
  contract,
  tokenId,
}: {
  contract: string;
  tokenId?: string | number;
}) {
  const tokenIdStr = tokenId != null ? String(tokenId) : "";
  const [type, setType] = useState("");

  const key = useMemo(() => {
    // When contract/tokenId/type changes, remount inner component (auto-reset state)
    return `${contract}:${tokenIdStr || "collection"}:${type || "ALL"}`;
  }, [contract, tokenIdStr, type]);

  return (
    <ActivityTabInner
      key={key}
      contract={contract}
      tokenId={tokenId}
      type={type}
      setType={setType}
    />
  );
}

function ActivityTabInner({
  contract,
  tokenId,
  type,
  setType,
}: {
  contract: string;
  tokenId?: string | number;
  type: string;
  setType: (v: string) => void;
}) {
  const [items, setItems] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const mode = tokenId != null ? "token" : "collection";
  const tokenIdStr = tokenId != null ? String(tokenId) : undefined;

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "30");
    if (type) p.set("type", type);
    return p.toString();
  }, [type]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);

    const base =
      mode === "token"
        ? `/api/nft/${contract}/${encodeURIComponent(tokenIdStr ?? "")}/activities`
        : `/api/collections/${contract}/activities`;

    const url = new URL(`${base}?${qs}`, window.location.origin);
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json().catch(() => null);

    let rawItems: unknown[] = [];
    let nextCursor: string | null = null;

    // ✅ support BOTH shapes: []  OR  { items: [] }
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (isObject(data)) {
      if (Array.isArray((data as any).items)) rawItems = (data as any).items;
      if (typeof (data as any).nextCursor === "string")
        nextCursor = (data as any).nextCursor;
    }

    if (!res.ok) {
      setDone(true);
      setLoading(false);
      return;
    }

    const normalized: Row[] = [];
    for (const it of rawItems) {
      const row = normalizeToRow(it, tokenIdStr);
      if (row) normalized.push(row);
    }

    setItems((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      const merged = [...prev];
      for (const it of normalized) if (!seen.has(it.id)) merged.push(it);
      return merged;
    });

    setCursor(nextCursor);
    if (!nextCursor || normalized.length === 0) setDone(true);

    setLoading(false);
  }, [contract, cursor, done, loading, mode, qs, tokenIdStr]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "800px" }
    );

    io.observe(el);
    // Trigger initial load by forcing intersection check
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">
          Activity{" "}
          {mode === "token" ? (
            <span className="text-muted-foreground">• Token</span>
          ) : null}
        </div>

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
        {items.map((r) => {
          const hasTx = isRealTxHash(r.txHash);
          const href = hasTx ? txUrl(r.txHash) : null;

          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 border-b p-4 last:border-b-0"
            >
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

                {/* ✅ Replace dash/short hash area with a proper explorer link */}
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={r.txHash}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10"
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
        <div className="mt-4 text-center text-sm text-muted-foreground">
          No activity found.
        </div>
      ) : null}
    </div>
  );
}
