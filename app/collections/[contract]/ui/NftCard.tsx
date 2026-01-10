"use client";

import Image from "next/image";
import type { GridItem } from "./NftGrid";

const BLUR_1x1 =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

function isLikelyImageUrl(u?: string | null) {
  if (!u) return false;
  const s = u.split("?")[0].toLowerCase();
  return (
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".webp") ||
    s.endsWith(".avif") ||
    s.endsWith(".gif")
  );
}

function isLikelyVideoUrl(u?: string | null) {
  if (!u) return false;
  const s = u.split("?")[0].toLowerCase();
  return s.endsWith(".mp4") || s.endsWith(".webm") || s.endsWith(".mov") || s.endsWith(".m4v");
}

/**
 * Choose a safe thumbnail:
 * - Prefer imageUrl if it’s a real image.
 * - Otherwise, if animationUrl is an image (some collections use that), use it.
 * - Otherwise, return null (we’ll show a nice placeholder + "Video" pill).
 */
function pickThumb(item: GridItem) {
  if (isLikelyImageUrl(item.imageUrl)) return item.imageUrl!;
  if (isLikelyImageUrl(item.animationUrl)) return item.animationUrl!;
  return null;
}

export default function NftCard({
  item,
  onOpen,
  priority = false,
}: {
  item: GridItem;
  onOpen: () => void;
  priority?: boolean;
}) {
  const title = item.name ?? `#${item.tokenId}`;

  // If the API flags hasVideo, trust it; otherwise infer from animationUrl
  const hasVideo = Boolean(item.hasVideo || isLikelyVideoUrl(item.animationUrl));

  const thumb = pickThumb(item);

  return (
    <button
      onClick={onOpen}
      className={[
        "group overflow-hidden rounded-2xl border bg-background text-left",
        "transition hover:shadow-sm active:scale-[0.995]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
      ].join(" ")}
    >
      <div className="relative aspect-square bg-muted">
        {thumb ? (
          <Image
            src={thumb}
            alt={title}
            fill
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_1x1}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          />
        ) : (
          // Clean “Apple-ish” placeholder (no heavy SVGs, no canvas, no GPU drama)
          <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_0%,rgba(77,238,84,0.10),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]" />
        )}

        {hasVideo ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
              Video
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-2 left-2 flex gap-2">
          {item.isListed ? (
            <span className="rounded-full bg-foreground px-2 py-1 text-[10px] font-semibold text-background">
              Listed
            </span>
          ) : null}
          {item.isAuctioned ? (
            <span className="rounded-full border bg-background/90 px-2 py-1 text-[10px] font-semibold">
              Auction
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-3">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">#{item.tokenId}</div>
      </div>
    </button>
  );
}
