"use client";

import * as React from "react";
import { cn } from "../lib/utils";


type Variant = "default" | "soft" | "outline";

export function Badge({
  className,
  variant = "soft",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        variant === "default" && "bg-foreground text-background",
        variant === "soft" && "bg-black/5 dark:bg-white/10 text-foreground border border-border",
        variant === "outline" && "bg-transparent text-foreground border border-border",
        className
      )}
    />
  );
}
