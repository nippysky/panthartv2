/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";

type MediaKind = "image" | "video" | "unknown";
type Fit = "cover" | "contain";

const VIDEO_RE = /\.(mp4|webm|ogg|ogv|m4v|mov)(\?|#|$)/i;
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|#|$)/i;

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function cleanUrl(u: string) {
  return u.trim();
}

function extGuess(u: string): MediaKind {
  const s = u.toLowerCase();
  if (VIDEO_RE.test(s)) return "video";
  if (IMAGE_RE.test(s)) return "image";
  return "unknown";
}

/**
 * Some gateways include "filename=foo.mp4" etc.
 */
function queryFilenameGuess(u: string): MediaKind {
  try {
    const url = new URL(u);
    const fname = (url.searchParams.get("filename") || "").toLowerCase();
    if (VIDEO_RE.test(fname)) return "video";
    if (IMAGE_RE.test(fname)) return "image";
  } catch {
    // ignore
  }
  return "unknown";
}

async function probeKind(u: string): Promise<MediaKind> {
  // 1) Try HEAD (cheap) — some gateways block it
  try {
    const h = await fetch(u, { method: "HEAD" });
    const ct = h.headers.get("content-type") || "";
    if (ct.startsWith("video/")) return "video";
    if (ct.startsWith("image/")) return "image";
  } catch {
    // ignore
  }

  // 2) Tiny Range GET fallback (still cheap-ish, works when HEAD is blocked)
  try {
    const r = await fetch(u, { method: "GET", headers: { Range: "bytes=0-0" } });
    const ct = r.headers.get("content-type") || "";
    if (ct.startsWith("video/")) return "video";
    if (ct.startsWith("image/")) return "image";
  } catch {
    // ignore
  }

  return "unknown";
}

export default function CardMedia({
  src,
  alt,
  className,
  fit = "cover",
  muted = true,
  autoPlay = true,
  loop = true,
  playsInline = true,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fit?: Fit;
  muted?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  playsInline?: boolean;
}) {
  const safeSrc = cleanUrl(src ?? "");

  const base = cx(
    "block w-full h-full",
    fit === "cover" ? "object-cover" : "object-contain",
    "bg-black",
    className
  );

  const [kind, setKind] = React.useState<MediaKind>(() => {
    if (!safeSrc) return "image";
    const q = queryFilenameGuess(safeSrc);
    if (q !== "unknown") return q;
    const e = extGuess(safeSrc);
    return e === "unknown" ? "image" : e; // optimistic default to image for fast paint
  });

  React.useEffect(() => {
    if (!safeSrc) return;

    let cancelled = false;

    async function detect() {
      // Prefer quick guesses first
      const q = queryFilenameGuess(safeSrc);
      if (q !== "unknown") {
        if (!cancelled) setKind(q);
        return;
      }

      const e = extGuess(safeSrc);
      if (e !== "unknown") {
        if (!cancelled) setKind(e);
        return;
      }

      // Only probe if we couldn't guess from URL
      const probed = await probeKind(safeSrc);
      if (!cancelled && probed !== "unknown") setKind(probed);
    }

    detect();

    return () => {
      cancelled = true;
    };
  }, [safeSrc]);

  const onImageError = React.useCallback(() => setKind("video"), []);
  const onVideoError = React.useCallback(() => setKind("image"), []);

  if (!safeSrc) {
    return (
      <div
        aria-label={alt}
        className={cx(
          "w-full h-full grid place-items-center",
          fit === "cover" ? "bg-muted" : "bg-muted",
          className
        )}
      >
        <div className="h-10 w-10 rounded-2xl bg-black/5 dark:bg-white/10" />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <video
        key={`video:${safeSrc}`}
        src={safeSrc}
        muted={muted}
        autoPlay={autoPlay}
        loop={loop}
        playsInline={playsInline}
        preload="metadata"
        className={base}
        onError={onVideoError}
      />
    );
  }

  return (
    <img
      key={`img:${safeSrc}`}
      src={safeSrc}
      alt={alt}
      loading="lazy"
      className={cx(base, "bg-muted")}
      onError={onImageError}
    />
  );
}