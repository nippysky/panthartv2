"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/src/ui/Button";
import { cn, formatNumber } from "@/src/lib/utils";

type Item = {
  tokenId: string;
  name?: string | null;
  imageUrl?: string | null;
  floorPrice?: number | null;
  lastSalePrice?: number | null;
  currencySymbol?: string | null;
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

function normalizeItem(it: unknown): Item | null {
  if (!isObject(it)) return null;

  const tokenId = getStr(it, "tokenId") ?? "";
  if (!tokenId) return null;

  return {
    tokenId,
    name: getStr(it, "name"),
    imageUrl: getStr(it, "imageUrl") ?? getStr(it, "image") ?? null,
    floorPrice: getNum(it, "floorPrice"),
    lastSalePrice: getNum(it, "lastSalePrice"),
    currencySymbol: getStr(it, "currencySymbol"),
  };
}

type ApiResp = {
  items: unknown[];
  nextCursor?: unknown;
};

function getNextCursor(data: unknown): string | null {
  if (!isObject(data)) return null;
  const c = data["nextCursor"];
  return typeof c === "string" ? c : null;
}

/**
 * Wrapper: key-based remount avoids “reset effects”.
 * (Keeps this component lint-friendly.)
 */
export default function NFTitemsTab({
  contract,
  excludeTokenId,
  title = "More from this collection",
}: {
  contract: string;
  excludeTokenId?: string | number;
  title?: string;
}) {
  const key = useMemo(
    () => `${contract}:${excludeTokenId != null ? String(excludeTokenId) : "none"}`,
    [contract, excludeTokenId]
  );

  return (
    <NFTitemsTabInner
      key={key}
      contract={contract}
      excludeTokenId={excludeTokenId}
      title={title}
    />
  );
}

function NFTitemsTabInner({
  contract,
  excludeTokenId,
  title,
}: {
  contract: string;
  excludeTokenId?: string | number;
  title: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const excluded = excludeTokenId != null ? String(excludeTokenId) : null;

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);
    setError(null);

    const base = `/api/collections/${contract}/items`;
    const url = new URL(base, window.location.origin);
    url.searchParams.set("limit", "24");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      setLoading(false);
      setError("Failed to load items");
      return;
    }

    const data = (await res.json().catch(() => null)) as unknown;

    const raw: unknown[] =
      isObject(data) && Array.isArray((data as ApiResp).items)
        ? ((data as ApiResp).items as unknown[])
        : [];

    const nextCursor = getNextCursor(data);

    const normalized: Item[] = [];
    for (const it of raw) {
      const n = normalizeItem(it);
      if (!n) continue;
      if (excluded && n.tokenId === excluded) continue;
      normalized.push(n);
    }

    setItems((prev) => {
      const seen = new Set(prev.map((x) => x.tokenId));
      const merged = [...prev];
      for (const it of normalized) if (!seen.has(it.tokenId)) merged.push(it);
      return merged;
    });

    setCursor(nextCursor);
    if (!nextCursor || normalized.length === 0) setDone(true);

    setLoading(false);
  }, [contract, cursor, done, excluded, loading]);

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
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((it) => {
          const href = `/collections/${contract}/${it.tokenId}`;
          const currency = it.currencySymbol ?? "ETN";

          const imgSrc = (it.imageUrl || "").trim();

          return (
            <Link
              key={it.tokenId}
              href={href}
              className={cn(
                "group rounded-2xl border bg-white/50 dark:bg-white/5 overflow-hidden",
                "hover:bg-white/70 dark:hover:bg-white/7 transition"
              )}
            >
              <div className="relative aspect-square w-full bg-black/5 dark:bg-white/5 overflow-hidden">
                {imgSrc ? (
                  <Image
                    src={imgSrc}
                    alt={it.name ?? `#${it.tokenId}`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    No media
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="text-sm font-semibold truncate">
                  {it.name ?? `#${it.tokenId}`}
                </div>

                <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Floor</span>
                  <span className="text-foreground">
                    {it.floorPrice != null ? `${formatNumber(it.floorPrice)} ${currency}` : "—"}
                  </span>
                </div>

                <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Last</span>
                  <span className="text-foreground">
                    {it.lastSalePrice != null
                      ? `${formatNumber(it.lastSalePrice)} ${currency}`
                      : "—"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}

        {/* skeletons */}
        {items.length === 0 && loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="rounded-2xl border bg-white/50 dark:bg-white/5 overflow-hidden"
              >
                <div className="aspect-square bg-black/5 dark:bg-white/5 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-full bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-5/6 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
                </div>
              </div>
            ))
          : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border p-4 text-sm">
          <div className="text-red-500">{error}</div>
          <div className="mt-3">
            <Button variant="primary" onClick={() => void loadMore()}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-10" />

      {loading ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">Loading…</div>
      ) : null}

      {!loading && done && items.length === 0 && !error ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">No items found.</div>
      ) : null}
    </section>
  );
}
