// src/ui/Skeleton.tsx
import * as React from "react";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

/**
 * Minimal shimmer skeleton:
 * - looks premium on dark/light
 * - no extra deps
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-2xl bg-foreground/5",
        "after:absolute after:inset-0",
        "after:-translate-x-full after:bg-linear-to-r after:from-transparent after:via-foreground/10 after:to-transparent",
        "after:animate-[shimmer_1.2s_infinite]",
        className
      )}
      aria-hidden="true"
    />
  );
}
