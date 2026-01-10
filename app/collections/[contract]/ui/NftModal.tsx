/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const BLUR_1x1 =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

function isVideoUrl(u?: string | null) {
  if (!u) return false;
  const s = u.toLowerCase().split("?")[0];
  return s.endsWith(".mp4") || s.endsWith(".webm") || s.endsWith(".mov") || s.endsWith(".m4v");
}

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
  item: any | null;
  contract: string;
  onClose: () => void;
}) {
  // ✅ hooks always run, no early returns before them
  const [playVideo, setPlayVideo] = useState(false);

  const canUseDom = typeof document !== "undefined";
  const isOpen = Boolean(open && item && canUseDom);

  const isVideo = Boolean(item?.animationUrl && isVideoUrl(item?.animationUrl));

  const posterUrl = useMemo(() => {
    if (!item) return null;
    if (item.imageUrl) return item.imageUrl as string;
    if (item.animationUrl && !isVideo) return item.animationUrl as string;
    return null;
  }, [item, isVideo]);

  const title = item?.name ?? (item?.tokenId ? `#${item.tokenId}` : "NFT");
  const tokenId = item?.tokenId ? String(item.tokenId) : "";
  const detailsHref = tokenId ? `/collections/${contract}/${tokenId}` : `/collections/${contract}`;

  // ✅ reset playVideo WITHOUT useEffect:
  // remount the media section when item changes or modal opens/closes
  const mediaKey = `${isOpen ? "1" : "0"}-${item?.id ?? "none"}`;

  // Lock scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const modal = (
    <div className="fixed inset-0 z-80">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* centered dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className={cx(
            "w-[94vw] max-w-5xl overflow-hidden rounded-3xl border border-border bg-background",
            "shadow-[0_30px_120px_rgba(0,0,0,0.50)]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {title} {tokenId ? <span className="text-muted-foreground">#{tokenId}</span> : null}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Token preview</div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={detailsHref}
                className="hidden h-9 items-center rounded-full border border-border bg-card px-3 text-sm font-medium hover:bg-background/60 sm:inline-flex"
              >
                View details
              </Link>

              <button
                className="h-9 rounded-full border border-border bg-card px-3 text-sm font-medium hover:bg-background/60"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>

          {/* body */}
          <div className="max-h-[85vh] overflow-y-auto p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* media (keyed to reset play state without effects) */}
              <div
                key={mediaKey}
                className="relative overflow-hidden rounded-3xl border border-border bg-muted"
              >
                <div className="relative aspect-square">
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
                            alt={title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 94vw, 40vw"
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
                      alt={title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 94vw, 40vw"
                      priority
                      placeholder="blur"
                      blurDataURL={BLUR_1x1}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_0%,rgba(77,238,84,0.10),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]" />
                  )}
                </div>
              </div>

              {/* info */}
              <div className="rounded-3xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Token</div>
                <div className="mt-1 text-base font-semibold">{tokenId ? `#${tokenId}` : "—"}</div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Chip label="Listed" value={item.isListed ? "Yes" : "No"} />
                  <Chip label="Auction" value={item.isAuctioned ? "Yes" : "No"} />
                  <Chip label="Video" value={isVideo ? "Yes" : "No"} />
                  <Chip label="ID" value={String(item.id).slice(0, 8) + "…"} />
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href={detailsHref}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background hover:opacity-95"
                  >
                    View details
                  </Link>

                  {item.animationUrl ? (
                    <a
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
                      href={item.animationUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open media
                    </a>
                  ) : null}
                </div>

                <div className="mt-4 text-xs text-muted-foreground">
                  Details page will handle listing, buying, selling, auctions — this modal is a fast preview.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
