"use client";

import React from "react";

export default function AuctionCardSkeleton() {
  return (
    <div className="h-full rounded-[22px] border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-3">
      <div className="w-full aspect-square rounded-2xl bg-muted animate-pulse" />

      <div className="mt-3 space-y-2">
        <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
        <div className="h-3 w-3/5 rounded bg-muted animate-pulse" />
        <div className="h-6 w-2/3 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
}