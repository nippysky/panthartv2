/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/src/lib/utils";
import { ipfsToHttp, detectMediaType } from "@/src/lib/media";

type Item = {
  tokenId: string;
  name?: string | null;

  // media
  imageUrl?: string | null;
  animationUrl?: string | null;
  hasVideo?: boolean;

  // optional fields (ignored here but kept for compatibility)
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

function getBool(o: Record<string, unknown>, k: string): boolean | null {
  const v = o[k];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  if (typeof v === "number") return v === 1 ? true : v === 0 ? false : null;
  return null;
}

function normalizeItem(it: unknown): Item | null {
  if (!isObject(it)) return null;

  const tokenId = getStr(it, "tokenId") ?? "";
  if (!tokenId) return null;

  const imageUrl = getStr(it, "imageUrl") ?? getStr(it, "image") ?? null;

  const animationUrl =
    getStr(it, "animationUrl") ??
    getStr(it, "animation_url") ??
    getStr(it, "animation") ??
    null;

  const hasVideo =
    getBool(it, "hasVideo") ??
    getBool(it, "has_video") ??
    (animationUrl ? true : null) ??
    null;

  return {
    tokenId,
    name: getStr(it, "name"),
    imageUrl,
    animationUrl,
    hasVideo: hasVideo ?? false,

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
 * ✅ Surgeon detection:
 * 1) trust backend hasVideo when present
 * 2) if animationUrl exists, treat as video
 * 3) else fallback to detectMediaType (works when extension exists)
 */
function resolveIsVideo(it: Item): boolean {
  if (it.hasVideo) return true;
  if (it.animationUrl && it.animationUrl.trim().length > 0) return true;

  // fallback: sometimes imageUrl is actually a video link
  const raw = (it.animationUrl || it.imageUrl || "").trim();
  if (!raw) return false;

  return detectMediaType(raw) === "video";
}

function toHttp(u?: string | null): string {
  const raw = (u || "").trim();
  if (!raw) return "";
  return ipfsToHttp(raw) ?? raw;
}

export default function NFTItemsTab({
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
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const prefetchedRef = useRef<Set<string>>(new Set());
  const excluded = excludeTokenId != null ? String(excludeTokenId) : null;

  const loadMore = useCallback(async () => {
    if (loading || done) return;

    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const base = `/api/collections/${contract}/items`;
    const url = new URL(base, window.location.origin);
    url.searchParams.set("limit", "24");
    if (cursor) url.searchParams.set("cursor", cursor);

    try {
      const res = await fetch(url.toString(), { cache: "no-store", signal: ac.signal });
      if (!res.ok) {
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

      // ✅ don't mark done just because current token is excluded.
      if (!nextCursor || raw.length === 0) setDone(true);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [contract, cursor, done, excluded, loading]);

  // ✅ load first page immediately (no waiting for intersection)
  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => {
          const href = `/collections/${contract}/${it.tokenId}`;

          const isVideo = resolveIsVideo(it);

          // For video: use imageUrl as poster if present; otherwise just blurred fallback.
          // For image: use imageUrl; if missing, fallback to animationUrl if it's actually an image/gif.
          const posterUrl = toHttp(it.imageUrl);
          const altMediaUrl = toHttp(it.animationUrl);

          const imgForCard = !isVideo
            ? posterUrl || altMediaUrl
            : posterUrl || altMediaUrl; // still try to get *something* to blur behind play icon

          const prefetchIntent = () => {
            if (prefetchedRef.current.has(href)) return;
            prefetchedRef.current.add(href);
            router.prefetch(href);
          };

          return (
            <Link
              key={it.tokenId}
              href={href}
              prefetch={false}
              onMouseEnter={prefetchIntent}
              onFocus={prefetchIntent}
              className={cn(
                "group overflow-hidden rounded-2xl border border-border bg-card transition",
                "hover:bg-background/60"
              )}
            >
              <MediaThumb
                isVideo={isVideo}
                src={imgForCard}
                alt={it.name ?? `#${it.tokenId}`}
              />

              <div className="p-3">
                <div className="truncate text-sm font-semibold">
                  {it.name ?? `#${it.tokenId}`}
                </div>
              </div>
            </Link>
          );
        })}

        {/* skeletons for first paint */}
        {items.length === 0 && loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={`sk-${i}`} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-3">
                  <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))
          : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">
          <div className="text-red-500">{error}</div>
          <div className="mt-3">
            <button
              className="text-xs rounded-full border border-border bg-background/40 px-3 py-1.5 hover:bg-background/60"
              onClick={() => void loadMore()}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-10" />

      {loading && items.length > 0 ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">Loading…</div>
      ) : null}

      {!loading && done && items.length === 0 && !error ? (
        <div className="mt-4 text-center text-sm text-muted-foreground">No items found.</div>
      ) : null}
    </section>
  );
}

function MediaThumb({
  isVideo,
  src,
  alt,
}: {
  isVideo: boolean;
  src: string;
  alt: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = !!src && !broken;

  return (
    <div className="relative aspect-square w-full overflow-hidden bg-muted">
      {/* Background (image if possible) */}
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            isVideo ? "scale-110 blur-md opacity-60" : ""
          )}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02),rgba(255,255,255,0.06))] bg-size-[200%_100%]" />
      )}

      {/* Video overlay */}
      {isVideo ? (
        <>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-border bg-background/70 p-3 shadow-sm backdrop-blur">
              <PlayIcon className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute left-2 top-2 rounded-full border border-border bg-background/70 px-2 py-1 text-[11px] font-medium">
            Video
          </div>
        </>
      ) : null}

      {/* If no usable media */}
      {!isVideo && !showImg ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          No media
        </div>
      ) : null}
    </div>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("text-foreground", className)}
      fill="currentColor"
    >
      <path d="M8.5 6.8v10.4c0 .9 1 1.4 1.8.9l8.1-5.2c.7-.4.7-1.4 0-1.8l-8.1-5.2c-.8-.5-1.8 0-1.8.9z" />
    </svg>
  );
}
