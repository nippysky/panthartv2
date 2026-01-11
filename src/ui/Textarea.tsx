"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-30 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground",
        "placeholder:text-muted outline-none",
        "focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/20",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
    />
  );
}
