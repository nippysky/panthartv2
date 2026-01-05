// src/ui/home/TopCollectionsSkeleton.tsx
import * as React from "react";

function Row() {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3">
      <div className="h-10 w-10 rounded-2xl border border-border bg-background/60 animate-pulse" />
      <div className="flex-1">
        <div className="h-4 w-40 rounded bg-background/60 animate-pulse" />
        <div className="mt-2 h-3 w-56 rounded bg-background/50 animate-pulse" />
      </div>
      <div className="hidden sm:block h-3 w-24 rounded bg-background/50 animate-pulse" />
    </div>
  );
}

export function TopCollectionsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="mt-6 grid gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Row key={i} />
      ))}
    </div>
  );
}
