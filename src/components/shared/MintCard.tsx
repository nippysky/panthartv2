// src/components/shared/MintCard.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Progress } from "@/src/ui/Progress";
import type { MintingNowItem } from "@/src/types/minting-now";
import { formatEtnFromWei} from "@/src/lib/utils";
import { useIsMobile } from "@/src/lib/isMobile";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function ipfsToHttp(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("ipfs://")) {
    const gw = (
      process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com/ipfs/"
    ).replace(/\/?$/, "/");
    return gw + u.slice(7);
  }
  return u;
}

function bypassOptimizer(u: string): boolean {
  try {
    const host = new URL(u).host;
    return /ipfs\.io$|cloudflare-ipfs\.com$|pinata\.cloud$|lighthouse\.storage$|arweave\.net$/.test(
      host
    );
  } catch {
    return true;
  }
}

export default function MintingCard({
  item,
  layoutVariant = "square",
  compact = false,
  mediaPreference = "cover",
}: {
  item: MintingNowItem;
  layoutVariant?: "square" | "banner" | "ultra" | "strip";
  compact?: boolean;
  mediaPreference?: "cover" | "logo" | "logo-on-mobile" | "logo-strict";
}) {
  const isMobile = useIsMobile();

  const coverUrl = ipfsToHttp(item.coverUrl || null);
  const logoUrl = ipfsToHttp(item.logoUrl || null);

  const coverType = item.coverMediaType;
  const logoType = item.logoMediaType;

  const forceLogo = mediaPreference === "logo-strict";
  let useLogoAsMain =
    forceLogo ||
    mediaPreference === "logo" ||
    (mediaPreference === "logo-on-mobile" && isMobile);

  if (useLogoAsMain && !logoUrl) useLogoAsMain = false;

  // Poster should always be an image if possible
  const posterUrl =
    (logoType === "image" && logoUrl) ? logoUrl :
    (coverType === "image" && coverUrl) ? coverUrl :
    "/placeholder.svg";

  // Motion: pick the URL that is actually a video (even if no file extension)
  const motionUrl =
    (coverType === "video" && coverUrl) ? coverUrl :
    (logoType === "video" && logoUrl) ? logoUrl :
    "";

  // Still: respect logo preference only when logo is an image
  const stillUrl = useLogoAsMain
    ? (logoType === "image" ? (logoUrl as string) : posterUrl)
    : (coverType === "image" ? (coverUrl as string) : posterUrl);

  let mediaBox = "relative w-full overflow-hidden rounded-2xl ring-1 ring-black/5";
  if (layoutVariant === "strip") mediaBox += " aspect-[16/9] md:h-[130px] md:aspect-auto";
  else if (layoutVariant === "ultra") mediaBox += " aspect-square md:aspect-[5/2] lg:aspect-[21/9]";
  else if (layoutVariant === "banner") mediaBox += " aspect-square sm:aspect-[4/3] lg:aspect-[16/9]";
  else mediaBox += " aspect-square";

  const priceWei =
    item.status === "presale" ? item.presale!.priceEtnWei : item.publicSale.priceEtnWei;
  const price = formatEtnFromWei(priceWei, 18, 4);

  const statusLabel =
    item.status === "presale" ? "Presale" :
    item.status === "upcoming" ? "Upcoming" :
    "Public";

  const badge = item.kind === "erc1155" ? " • ERC1155" : "";

  const pad = compact ? "p-2.5" : "p-3";
  const titleText = compact ? "text-[0.92rem]" : "text-sm";
  const priceText = compact ? "text-[11px]" : "text-xs";
  const progressH = compact ? "h-1.5" : "h-2";

  return (
    <Link href={item.href} className="block group">
      <div
        className={cx(
          "h-full rounded-3xl border border-border bg-card",
          "shadow-sm transition-transform duration-200",
          "hover:-translate-y-0.5 hover:shadow-xl",
          pad
        )}
      >
        <div className={cx(mediaBox, "bg-foreground/5")}>
          <Image
            src={stillUrl}
            alt={item.name}
            fill
            unoptimized={bypassOptimizer(stillUrl)}
            sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, 45vw"
            className={cx(
              "absolute inset-0 h-full w-full object-cover",
              "transition-transform duration-300 group-hover:scale-[1.02]"
            )}
            priority={false}
          />

          {motionUrl ? (
            <video
              key={motionUrl}
              src={motionUrl}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              playsInline
              loop
              preload="metadata"
              controls={false}
              poster={posterUrl}
              onError={(e) => {
                try {
                  (e.currentTarget as HTMLVideoElement).remove();
                } catch {}
              }}
            />
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/45 to-transparent" />

          {!useLogoAsMain && logoUrl && logoType === "image" ? (
            <div className="absolute left-3 top-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-black/10 ring-1 ring-white/25 shadow-md">
                <Image
                  src={logoUrl}
                  alt={`${item.name} logo`}
                  fill
                  unoptimized={bypassOptimizer(logoUrl)}
                  sizes="40px"
                  className="object-cover"
                />
              </div>
            </div>
          ) : null}

               {/* ✅ FIXED: status chip works in BOTH light & dark */}
          <div className="absolute right-3 top-3">
            <div
              className={cx(
                "text-[10px] uppercase tracking-wider px-2 py-1 rounded-full",
                // Always readable chip (dark glass)
                "bg-neutral-900/70 text-white",
                "backdrop-blur-md shadow-sm",
                // Subtle ring that adapts to theme
                "ring-1 ring-black/10 dark:ring-white/15"
              )}
            >
              {statusLabel}{item.status === "upcoming" ? "" : " Live"}{badge}
            </div>
          </div>
        </div>
    

        <div className="mt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className={cx("font-semibold truncate", titleText)}>{item.name}</h3>
            <div className={cx("shrink-0 text-muted text-right", priceText)}>
              {price} ETN
            </div>
          </div>

          <Progress value={item.mintedPct} className={progressH} />

          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              {item.minted} / {item.supply} minted
            </span>
            <span className="tabular-nums">{Math.round(item.mintedPct)}%</span>
          </div>
        </div>
      </div>
    </Link>
  );
}