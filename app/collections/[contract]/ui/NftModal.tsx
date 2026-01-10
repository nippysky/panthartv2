/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { detectMediaType, ipfsToHttp, isVideoType } from "@/src/lib/media";

const BLUR_1x1 =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

type ModalItem = {
  id: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  hasVideo: boolean;
  isListed: boolean;
  isAuctioned: boolean;
};

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

export default function NftModal({
  open,
  item,
  contract,
  onClose,
}: {
  open: boolean;
  item: ModalItem | null;
  contract: string;
  onClose: () => void;
}) {
  // ---- hooks must be unconditional ----
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const title = item?.name ?? (item ? `#${item.tokenId}` : "NFT");

  const mediaUrl = useMemo(() => {
    // prefer animationUrl for video, else imageUrl
    const a = ipfsToHttp(item?.animationUrl);
    const i = ipfsToHttp(item?.imageUrl);
    return a || i || null;
  }, [item?.animationUrl, item?.imageUrl]);

  const posterUrl = useMemo(() => {
    // poster should be an image if possible
    const i = ipfsToHttp(item?.imageUrl);
    if (i) return i;

    // sometimes animationUrl is actually an image
    const a = ipfsToHttp(item?.animationUrl);
    const t = detectMediaType(a);
    return t === "image" ? a : null;
  }, [item?.imageUrl, item?.animationUrl]);

  const mediaType = useMemo(() => detectMediaType(mediaUrl), [mediaUrl]);
  const isVideo = isVideoType(mediaType) || Boolean(item?.hasVideo);

  // lock scroll + ESC close (no setState inside effects)
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // reset “playing” when token changes / modal closes (NO effect setState needed)
  // we do it by keying the media box
  const mediaKey = `${open ? "1" : "0"}-${item?.id ?? "none"}`;

  // ---- render ----
  if (!open || !item) return null;

  const detailsHref = `/collections/${contract}/${encodeURIComponent(
    String(item.tokenId)
  )}`;

  return (
    <div className="fixed inset-0 z-[999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Centering wrapper: fixed to viewport (not scroll), mobile-safe top padding */}
      <div className="absolute inset-0 flex items-start justify-center p-3 pt-24 sm:items-center sm:p-6 sm:pt-6">
        {/* Panel */}
        <div
          className={cx(
            "w-full max-w-5xl overflow-hidden rounded-[22px] border border-border",
            "bg-background/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)]",
            "backdrop-blur-xl"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">
                Quick preview — full actions live on the details page
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={detailsHref}
                className="inline-flex h-9 items-center rounded-full border border-border bg-card px-3 text-sm font-medium hover:bg-background/60"
              >
                View details
              </Link>

              <button
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-full border border-border bg-card px-3 text-sm font-medium hover:bg-background/60"
              >
                Close
              </button>
            </div>
          </div>

          {/* Body (scroll inside modal if needed) */}
          <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-4 sm:max-h-[calc(100dvh-4rem)]">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Media */}
              <div
                key={mediaKey}
                className="relative overflow-hidden rounded-2xl border border-border bg-muted"
              >
                <div className="relative aspect-square">
                  {isVideo ? (
                    <>
                      {/* Always render video so click can call play() reliably */}
                      <video
                        ref={videoRef}
                        src={mediaUrl ?? undefined}
                        className="h-full w-full object-cover"
                        controls={playing}
                        playsInline
                        preload="metadata"
                        crossOrigin="anonymous"
                      />

                      {/* Overlay when not playing */}
                      {!playing ? (
                        <button
                          type="button"
                          className="absolute inset-0 grid place-items-center bg-black/25"
                          onClick={() => {
                            setPlaying(true);
                            // user gesture -> play should work
                            window.setTimeout(() => {
                              videoRef.current?.play().catch(() => {
                                // if it still fails, user can click controls after
                              });
                            }, 0);
                          }}
                        >
                          <div className="inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                            <PlayIcon />
                            Play video
                          </div>
                        </button>
                      ) : null}
                    </>
                  ) : posterUrl ? (
                    <Image
                      src={posterUrl}
                      alt={title}
                      fill
                      priority
                      placeholder="blur"
                      blurDataURL={BLUR_1x1}
                      className="object-cover"
                      sizes="(max-width: 768px) 92vw, 50vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_0%,rgba(77,238,84,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent)]" />
                  )}

                  {/* Small “Video” pill top-left */}
                  {isVideo ? (
                    <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                      Video
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Info */}
              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <div className="text-xs text-muted-foreground">Token</div>
                <div className="mt-1 text-sm font-semibold">#{item.tokenId}</div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Chip label="Listed" value={item.isListed ? "Yes" : "No"} />
                  <Chip label="Auction" value={item.isAuctioned ? "Yes" : "No"} />
                  <Chip label="Media" value={isVideo ? "Video" : "Image"} />
                  <Chip label="Name" value={item.name ?? `#${item.tokenId}`} />
                </div>

                {mediaUrl ? (
                  <a
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-background/60"
                    href={mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open media
                  </a>
                ) : null}

                <div className="mt-4 text-xs text-muted-foreground">
                  Tip: buying, selling, listing & auctions will live on the details page.
                  This modal stays lightweight on purpose.
                </div>

                {/* keep CTA visible in-modal */}
                <Link
                  href={detailsHref}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-95"
                >
                  View NFT details
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 18V6l12 6-12 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
