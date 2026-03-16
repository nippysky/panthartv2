"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { detectMediaType, isVideoType } from "@/src/lib/media";
import { fetchJsonFromIpfs, toGatewayUrl } from "@/src/lib/ipfs";

const BLUR_1x1 =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

type GridItem = {
  id: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  tokenUri?: string | null;
  hasVideo: boolean;
  isListed: boolean;
  isAuctioned: boolean;
};

type RecoveredMeta = {
  name: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
};

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function normalizeMediaCandidate(value?: string | null) {
  return toGatewayUrl(value, "PINATA");
}

function pickImageThumb(
  imageUrl?: string | null,
  animationUrl?: string | null
) {
  const img = normalizeMediaCandidate(imageUrl);
  if (img && detectMediaType(img) === "image") return img;

  const anim = normalizeMediaCandidate(animationUrl);
  if (anim && detectMediaType(anim) === "image") return anim;

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
  const [recovered, setRecovered] = useState<RecoveredMeta | null>(null);

  const hasPrimaryMedia = !!item.imageUrl || !!item.animationUrl;

  useEffect(() => {
    let cancelled = false;

    async function hydrateFallback() {
      if (hasPrimaryMedia) return;
      if (!item.tokenUri) return;

      try {
        const meta = await fetchJsonFromIpfs(item.tokenUri, {
          pref: "PINATA",
          cache: "no-store",
        });

        if (cancelled) return;

        setRecovered({
          name:
            typeof meta?.name === "string" && meta.name.trim()
              ? meta.name.trim()
              : null,
          imageUrl:
            typeof meta?.image === "string"
              ? meta.image
              : typeof meta?.image_url === "string"
              ? meta.image_url
              : null,
          animationUrl:
            typeof meta?.animation_url === "string"
              ? meta.animation_url
              : typeof meta?.animationUrl === "string"
              ? meta.animationUrl
              : null,
        });
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to recover NFT metadata for card:",
            item.tokenId,
            error
          );
        }
      }
    }

    hydrateFallback();

    return () => {
      cancelled = true;
    };
  }, [hasPrimaryMedia, item.tokenId, item.tokenUri]);

  const resolvedName = useMemo(() => {
    return item.name ?? recovered?.name ?? `#${item.tokenId}`;
  }, [item.name, item.tokenId, recovered?.name]);

  const resolvedImageUrl = recovered?.imageUrl ?? item.imageUrl;
  const resolvedAnimationUrl = recovered?.animationUrl ?? item.animationUrl;

  const mediaUrl =
    normalizeMediaCandidate(resolvedAnimationUrl) ||
    normalizeMediaCandidate(resolvedImageUrl);

  const mediaType = detectMediaType(mediaUrl);
  const isVideo = isVideoType(mediaType) || Boolean(item.hasVideo);

  const thumb = pickImageThumb(resolvedImageUrl, resolvedAnimationUrl);

  return (
    <button
      onClick={onOpen}
      className={cx(
        "group overflow-hidden rounded-2xl border border-border bg-background text-left",
        "transition hover:shadow-sm active:scale-[0.995]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      )}
    >
      <div className="relative aspect-square bg-muted">
        {thumb ? (
          <Image
            src={thumb}
            alt={resolvedName}
            fill
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_1x1}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_0%,rgba(77,238,84,0.10),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]" />
        )}

        {isVideo ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 18V6l12 6-12 6Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
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
            <span className="rounded-full border border-border bg-background/90 px-2 py-1 text-[10px] font-semibold">
              Auction
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-3">
        <div className="truncate text-sm font-semibold">{resolvedName}</div>
        <div className="mt-1 text-xs text-muted-foreground">#{item.tokenId}</div>
      </div>
    </button>
  );
}