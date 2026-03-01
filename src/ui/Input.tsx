// src/ui/Input.tsx
"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        // a bit taller + better vertical rhythm
        "h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground",
        "leading-5 placeholder:text-muted outline-none",
        "transition-colors",
        "focus-visible:border-emerald-400/40 focus-visible:ring-2 focus-visible:ring-emerald-400/20",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
    />
  );
}