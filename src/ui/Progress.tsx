// src/ui/Progress.tsx
"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

export function Progress({
  className = "",
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const v = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cx(
        "relative h-2 w-full overflow-hidden rounded-full",
        "bg-foreground/10 ring-1 ring-black/5",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cx(
          "h-full w-full flex-1 transition-transform duration-500",
          "bg-foreground"
        )}
        style={{ transform: `translateX(-${100 - v}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}