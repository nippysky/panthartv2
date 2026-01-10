// src/ui/collections/CollectionsSkeleton.tsx
import * as React from "react";
import { Skeleton } from "@/src/ui/Skeleton";

export function CollectionsGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-3xl border border-border bg-card overflow-hidden">
          <div className="h-24 sm:h-28">
            <Skeleton className="h-full w-full" />
          </div>

          <div className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40 rounded-lg" />
                <Skeleton className="mt-2 h-3 w-24 rounded-lg" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-border bg-background p-3">
                <Skeleton className="h-3 w-20 rounded-lg" />
                <Skeleton className="mt-2 h-4 w-24 rounded-lg" />
              </div>
              <div className="rounded-2xl border border-border bg-background p-3">
                <Skeleton className="h-3 w-24 rounded-lg" />
                <Skeleton className="mt-2 h-4 w-24 rounded-lg" />
              </div>
              <div className="rounded-2xl border border-border bg-background p-3">
                <Skeleton className="h-3 w-16 rounded-lg" />
                <Skeleton className="mt-2 h-4 w-16 rounded-lg" />
              </div>
              <div className="rounded-2xl border border-border bg-background p-3">
                <Skeleton className="h-3 w-16 rounded-lg" />
                <Skeleton className="mt-2 h-4 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
