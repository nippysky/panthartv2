// src/ui/app/header/SearchBox.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { IconButton } from "@/src/ui/IconButton";
import { LoadingSpinner } from "../LoadingSpinner";
import { AppInput } from "./AppForm";

import { ipfsToHttp, detectMediaType } from "@/src/lib/media";
import { cn } from "@/src/lib/utils";

type GroupKey = "users" | "collections" | "nfts";
type SearchItem = {
  id: string;
  label: string;
  image: string;
  href: string;
  type: GroupKey;
  subtitle?: string;
};
type SearchResponse = {
  users: SearchItem[];
  collections: SearchItem[];
  nfts: SearchItem[];
  recent: SearchItem[];
};

// tiny capped cache
const cache = new Map<string, SearchResponse>();
function cacheSet(key: string, val: SearchResponse) {
  if (cache.size > 60) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, val);
}

function toHttp(u?: string | null) {
  const raw = (u ?? "").trim();
  if (!raw) return "";
  return ipfsToHttp(raw) ?? raw;
}

/**
 * “Surgeon-ish” detection:
 * - Use shared detectMediaType first (handles common extensions)
 * - Add heuristics for extensionless URLs (query params / hints)
 * - Still fall back to runtime <img onError> -> treat as video fallback
 */
function isLikelyVideoUrl(url: string): boolean {
  const raw = (url || "").trim();
  if (!raw) return false;

  // 1) library detection
  const mt = detectMediaType(raw);
  if (mt === "video") return true;

  // 2) heuristics for extensionless links / gateways
  const u = raw.toLowerCase();
  if (u.includes("video")) return true;
  if (u.includes("animation")) return true;
  if (u.includes("mime=video") || u.includes("mimetype=video")) return true;
  if (u.includes("content-type=video") || u.includes("contenttype=video")) return true;
  if (u.includes("format=mp4") || u.includes("format=webm")) return true;
  if (u.includes("mp4") || u.includes("webm") || u.includes("mov")) return true;

  return false;
}

export function SearchBox() {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<SearchResponse | null>(null);

  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const hasQuery = q.trim().length > 0;

  // click-away + Escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);

    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!open) return;
      const a = anchorRef.current;
      const t = e.target as Node | null;
      if (!a || !t) return;
      if (!a.contains(t)) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // debounced fetch
  React.useEffect(() => {
    if (!open || !hasQuery) {
      setData(null);
      return;
    }

    const key = q.trim().toLowerCase();
    if (cache.has(key)) {
      setData(cache.get(key)!);
      return;
    }

    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        const json: SearchResponse = res.ok
          ? await res.json()
          : { users: [], collections: [], nfts: [], recent: [] };

        cacheSet(key, json);
        setData(json);
      } catch {
        // ignore
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);

    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [q, open, hasQuery]);

  const items = React.useMemo(() => {
    if (!data) return [];
    return [...(data.recent || []), ...data.users, ...data.collections, ...data.nfts];
  }, [data]);

  return (
    <div ref={anchorRef} className="relative w-full max-w-160">
      <AppInput
        value={q}
        placeholder="Search NFTs, collections, users…"
        onChange={(e) => {
          setQ(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => hasQuery && setOpen(true)}
        className="pr-11"
      />

      {hasQuery ? (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <IconButton
            aria-label="Clear search"
            onClick={() => {
              setQ("");
              setOpen(false);
              setData(null);
            }}
          >
            <X className="h-4 w-4 cursor-pointer" />
          </IconButton>
        </div>
      ) : null}

      {open && hasQuery ? (
        <div className="absolute left-0 top-full mt-2 w-full overflow-hidden rounded-3xl border border-border bg-card shadow-[0_22px_80px_rgba(0,0,0,0.20)]">
          <div className="max-h-105 overflow-auto p-2">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
                <LoadingSpinner />
                Searching…
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted">
                No results. Try a contract (0x…), token id (1234), or “0x… 1234”.
              </div>
            ) : (
              <div className="flex flex-col">
                {items.slice(0, 15).map((it) => (
                  <Link
                    key={`${it.type}:${it.id}:${it.href}`}
                    href={it.href}
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-background/60 transition"
                  >
                    <Thumb
                      src={toHttp(it.image)}
                      alt={it.label}
                      forceVideo={isLikelyVideoUrl(it.image)}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {it.label}
                      </div>
                      <div className="truncate text-xs text-muted">
                        {it.subtitle ?? it.type.slice(0, -1)}
                      </div>
                    </div>

                    <div className="text-xs text-muted opacity-0 group-hover:opacity-100 transition">
                      ↵
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Thumb({
  src,
  alt,
  forceVideo,
}: {
  src: string;
  alt: string;
  forceVideo?: boolean;
}) {
  const [broken, setBroken] = React.useState(false);

  const showImg = !!src && !broken;
  const videoMode = !!forceVideo || (!showImg && !!src) || (showImg && isLikelyVideoUrl(src));

  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-border bg-background">
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className={cn(
            "h-full w-full object-cover",
            videoMode ? "scale-110 blur-md opacity-60" : ""
          )}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02),rgba(255,255,255,0.06))] bg-size-[200%_100%]" />
      )}

      {videoMode ? (
        <>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-border bg-background/70 p-1.5 shadow-sm backdrop-blur">
              <PlayIcon className="h-4 w-4" />
            </div>
          </div>
        </>
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
