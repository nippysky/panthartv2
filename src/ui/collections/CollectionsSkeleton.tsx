// src/ui/collections/CollectionsSkeleton.tsx
import * as React from "react";
import { Skeleton } from "@/src/ui/Skeleton";

export default function CollectionsSkeleton({ compact }: { compact?: boolean } = {}) {
  const count = compact ? 6 : 10;

  return (
    <div className="grid gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-4"
        >
          <Skeleton className="h-12 w-12 rounded-2xl" />

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-40 rounded-lg" />
              <Skeleton className="h-3 w-14 rounded-lg" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Skeleton className="h-3 w-36 rounded-lg" />
              <Skeleton className="h-3 w-32 rounded-lg" />
              <Skeleton className="h-3 w-20 rounded-lg" />
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-2">
            <Skeleton className="h-3 w-14 rounded-lg" />
            <Skeleton className="h-3 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
