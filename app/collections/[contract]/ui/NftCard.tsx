"use client";

import Image from "next/image";
import Link from "next/link";
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

function pickThumb(item: GridItem) {
  if (isLikelyImageUrl(item.imageUrl)) return item.imageUrl!;
  if (isLikelyImageUrl(item.animationUrl)) return item.animationUrl!;
  return null;
}

export default function NftCard({
  item,
  contract,
  onOpen,
  priority = false,
}: {
  item: GridItem;
  contract: string;
  onOpen: () => void;
  priority?: boolean;
}) {
  const title = item.name ?? `#${item.tokenId}`;
  const hasVideo = Boolean(item.hasVideo || isLikelyVideoUrl(item.animationUrl));
  const thumb = pickThumb(item);

  const detailsHref = `/collections/${contract}/${item.tokenId}`;

  return (
    <button
      onClick={onOpen}
      className={[
        "group relative overflow-hidden rounded-2xl border border-border bg-background text-left",
        "transition hover:shadow-[0_18px_55px_rgba(0,0,0,0.22)] active:scale-[0.995]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
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
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_0%,rgba(77,238,84,0.10),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]" />
        )}

        {/* subtle glass top overlay */}
        <div className="absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/25 to-transparent opacity-80" />

        {/* Video pill */}
        {hasVideo ? (
          <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
            Video
          </div>
        ) : null}

        {/* Status pills */}
        <div className="absolute bottom-2 left-2 flex gap-2">
          {item.isListed ? (
            <span className="rounded-full bg-foreground px-2 py-1 text-[10px] font-semibold text-background">
              Listed
            </span>
          ) : null}
          {item.isAuctioned ? (
            <span className="rounded-full border border-border bg-background/85 px-2 py-1 text-[10px] font-semibold">
              Auction
            </span>
          ) : null}
        </div>

        {/* Details affordance (doesn't break modal) */}
        <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
          <Link
            href={detailsHref}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-[10px] font-semibold hover:bg-background"
            title="View details"
          >
            Details
          </Link>
        </div>
      </div>

      <div className="p-3">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">#{item.tokenId}</div>
      </div>
    </button>
  );
}
