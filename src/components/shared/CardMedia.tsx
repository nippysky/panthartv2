/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import { ipfsToHttp } from "@/src/lib/media";

type MediaKind = "image" | "video" | "unknown";
type Fit = "cover" | "contain";
type AudioMode = "none" | "toggle";

const VIDEO_RE = /\.(mp4|webm|ogg|ogv|m4v|mov)(\?|#|$)/i;
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|#|$)/i;

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function cleanUrl(u: string) {
  return (ipfsToHttp(u) ?? u).trim();
}

function extGuess(u: string): MediaKind {
  const s = u.toLowerCase();
  if (VIDEO_RE.test(s)) return "video";
  if (IMAGE_RE.test(s)) return "image";
  return "unknown";
}

function queryFilenameGuess(u: string): MediaKind {
  try {
    const url = new URL(u);
    const fname = (url.searchParams.get("filename") || "").toLowerCase();
    if (VIDEO_RE.test(fname)) return "video";
    if (IMAGE_RE.test(fname)) return "image";
  } catch {}
  return "unknown";
}

function pathnameGuess(u: string): MediaKind {
  try {
    const url = new URL(u);
    const p = url.pathname.toLowerCase();
    if (VIDEO_RE.test(p)) return "video";
    if (IMAGE_RE.test(p)) return "image";
  } catch {}
  return "unknown";
}

async function probeKind(u: string): Promise<MediaKind> {
  try {
    const h = await fetch(u, { method: "HEAD" });
    const ct = h.headers.get("content-type") || "";
    if (ct.startsWith("video/")) return "video";
    if (ct.startsWith("image/")) return "image";
  } catch {}

  try {
    const r = await fetch(u, { method: "GET", headers: { Range: "bytes=0-0" } });
    const ct = r.headers.get("content-type") || "";
    if (ct.startsWith("video/")) return "video";
    if (ct.startsWith("image/")) return "image";
  } catch {}

  return "unknown";
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M11 5 6.5 9H3v6h3.5L11 19V5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="M16 9l5 6M21 9l-5 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path
            d="M16 9a5 5 0 0 1 0 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M18.5 6.5a9 9 0 0 1 0 11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
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
  audio = "none",
  audioMinSize = 140,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fit?: Fit;
  muted?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  audio?: AudioMode;
  audioMinSize?: number;
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
    const p = pathnameGuess(safeSrc);
    if (p !== "unknown") return p;
    const e = extGuess(safeSrc);
    return e === "unknown" ? "image" : e;
  });

  React.useEffect(() => {
    if (!safeSrc) return;

    let cancelled = false;

    async function detect() {
      const q = queryFilenameGuess(safeSrc);
      if (q !== "unknown") {
        if (!cancelled) setKind(q);
        return;
      }

      const p = pathnameGuess(safeSrc);
      if (p !== "unknown") {
        if (!cancelled) setKind(p);
        return;
      }

      const e = extGuess(safeSrc);
      if (e !== "unknown") {
        if (!cancelled) setKind(e);
        return;
      }

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

  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const [showAudioUI, setShowAudioUI] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState<boolean>(muted);
  const [canPlayVideo, setCanPlayVideo] = React.useState(false);

  React.useEffect(() => setIsMuted(muted), [muted]);

  React.useEffect(() => {
    if (audio !== "toggle") {
      setShowAudioUI(false);
      return;
    }

    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      const ok = Math.min(r.width, r.height) >= audioMinSize;
      setShowAudioUI(ok);
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    return () => ro.disconnect();
  }, [audio, audioMinSize]);

  React.useEffect(() => {
    if (kind !== "video") return;
    const v = videoRef.current;
    if (!v) return;

    v.muted = isMuted;
    v.defaultMuted = isMuted;
    v.volume = isMuted ? 0 : 1;

    if (autoPlay) {
      void v.play().catch(() => {});
    }
  }, [kind, safeSrc, autoPlay, isMuted]);

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;

    const next = !isMuted;
    v.muted = next;
    v.defaultMuted = next;
    v.volume = next ? 0 : 1;
    setIsMuted(next);

    void v.play().catch(() => {});
  }

  if (!safeSrc) {
    return (
      <div
        aria-label={alt}
        className={cx("grid h-full w-full place-items-center bg-muted", className)}
      >
        <div className="h-10 w-10 rounded-2xl bg-black/5 dark:bg-white/10" />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div ref={wrapRef} className={cx("relative h-full w-full", className)}>
        <video
          key={`video:${safeSrc}`}
          ref={videoRef}
          muted={isMuted}
          autoPlay={autoPlay}
          loop={loop}
          playsInline={playsInline}
          preload="metadata"
          crossOrigin="anonymous"
          controls={false}
          className={base}
          onLoadedMetadata={() => setCanPlayVideo(true)}
          onCanPlay={() => setCanPlayVideo(true)}
          onError={onVideoError}
        >
          <source src={safeSrc} />
        </video>

        {!canPlayVideo ? (
          <div className="pointer-events-none absolute inset-0" />
        ) : null}

        {audio === "toggle" && showAudioUI ? (
          <button
            type="button"
            onClick={toggleMute}
            className={cx(
              "absolute bottom-3 left-3",
              "inline-flex h-9 w-9 items-center justify-center",
              "rounded-full border border-white/15 bg-black/55 text-white",
              "backdrop-blur-md shadow-sm",
              "transition hover:bg-black/65"
            )}
            aria-label={isMuted ? "Unmute video" : "Mute video"}
            title={isMuted ? "Unmute" : "Mute"}
          >
            <SpeakerIcon muted={isMuted} />
          </button>
        ) : null}
      </div>
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