// components/skeleton/MintingCardSkeleton.tsx
import * as React from "react";
import { Skeleton } from "@/src/ui/Skeleton";

export default function MintingCardSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-card p-3">
      {/* media */}
      <Skeleton className="aspect-square w-full rounded-2xl" />

      {/* meta */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-2/3 rounded-xl" />
          <Skeleton className="h-3.5 w-12 rounded-xl" />
        </div>

        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-28 rounded-xl" />
      </div>
    </div>
  );
}