"use client";

import React from "react";
import Link from "next/link";
import AuctionCardCountdown from "./AuctionCountdown";
import CardMedia from "./CardMedia";



function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

export default function AuctionNowCard({
  nftAddress,
  tokenId,
  name,
  image,
  endTime,
  href,
  subtitle,
}: {
  nftAddress: string;
  tokenId: string;
  name: string;
  image: string;
  endTime: string;
  href?: string;
  subtitle?: string;
}) {
  const linkHref = href || `/auctions/${nftAddress}/${tokenId}`;

  return (
    <Link href={linkHref} className="block group">
      <div
        className={cx(
          "h-full rounded-[22px] border border-black/10 dark:border-white/10",
          "bg-white/50 dark:bg-white/4",
          "p-3",
          "transition-transform duration-200 will-change-transform",
          "group-hover:-translate-y-0.5 group-hover:shadow-lg"
        )}
      >
        {/* Media */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-muted ring-1 ring-black/5 dark:ring-white/10">
          <CardMedia src={image} alt={name} className="absolute inset-0 object-cover" />
          <div className="absolute inset-0 pointer-events-none bg-linear-to-t from-black/25 via-transparent to-transparent opacity-60" />
        </div>

        {/* Meta */}
        <div className="mt-3 flex flex-col gap-2">
          <h2 className="text-sm font-semibold leading-tight truncate">{name}</h2>

          <p className="text-xs text-muted-foreground truncate">
            Current bid:{" "}
            <span className="text-foreground/90 font-medium">{subtitle || "—"}</span>
          </p>

          <div className="pt-1">
            <AuctionCardCountdown endTime={endTime} />
          </div>
        </div>
      </div>
    </Link>
  );
}