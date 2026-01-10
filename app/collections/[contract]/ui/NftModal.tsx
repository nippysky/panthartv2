/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";

function isVideoUrl(u?: string | null) {
  if (!u) return false;
  const s = u.toLowerCase().split("?")[0];
  return s.endsWith(".mp4") || s.endsWith(".webm") || s.endsWith(".mov") || s.endsWith(".m4v");
}

const BLUR_1x1 =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export default function NftModal({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: any | null;
  onClose: () => void;
}) {
  // hooks MUST be unconditional → keep them at the top
  const [playVideo, setPlayVideo] = useState(false);

  // When the displayed token changes (or modal opens), reset play state
  // ✅ No useEffect needed → derived key in render
  const itemKey = `${open ? "1" : "0"}-${item?.id ?? "none"}`;

  // Reset playVideo when itemKey changes, WITHOUT useEffect:
  // We do it by keying the media container
  const isVideo = Boolean(item?.animationUrl && isVideoUrl(item?.animationUrl));

  const posterUrl = useMemo(() => {
    if (!item) return null;
    if (item.imageUrl) return item.imageUrl as string;
    if (item.animationUrl && !isVideo) return item.animationUrl as string;
    return null;
  }, [item, isVideo]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="absolute left-1/2 top-1/2 w-[92vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="truncate text-sm font-semibold">
            {item.name ?? `#${item.tokenId}`}{" "}
            <span className="text-muted-foreground">#{item.tokenId}</span>
          </div>
          <button className="rounded-xl border px-3 py-1.5 text-sm hover:bg-muted" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          {/* Key this box so playVideo resets automatically when item changes */}
          <div key={itemKey} className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
            {isVideo ? (
              playVideo ? (
                <video
                  src={item.animationUrl}
                  className="h-full w-full object-cover"
                  controls
                  playsInline
                  autoPlay
                  preload="none"
                />
              ) : (
                <>
                  {posterUrl ? (
                    <Image
                      src={posterUrl}
                      alt={item.name ?? `#${item.tokenId}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 92vw, 40vw"
                      priority
                      placeholder="blur"
                      blurDataURL={BLUR_1x1}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_0%,rgba(77,238,84,0.10),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]" />
                  )}

                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      className="rounded-full bg-black/55 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/65"
                      onClick={() => setPlayVideo(true)}
                    >
                      Play video
                    </button>
                  </div>
                </>
              )
            ) : posterUrl ? (
              <Image
                src={posterUrl}
                alt={item.name ?? `#${item.tokenId}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 92vw, 40vw"
                priority
                placeholder="blur"
                blurDataURL={BLUR_1x1}
              />
            ) : null}
          </div>

          <div className="rounded-2xl border bg-background p-4">
            <div className="text-xs text-muted-foreground">Token</div>
            <div className="mt-1 text-sm font-semibold">#{item.tokenId}</div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Chip label="Listed" value={item.isListed ? "Yes" : "No"} />
              <Chip label="Auction" value={item.isAuctioned ? "Yes" : "No"} />
              <Chip label="Video" value={isVideo ? "Yes" : "No"} />
              <Chip label="ID" value={String(item.id).slice(0, 8) + "…"} />
            </div>

            {item.animationUrl ? (
              <a
                className="mt-5 inline-block rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-muted"
                href={item.animationUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open media
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
