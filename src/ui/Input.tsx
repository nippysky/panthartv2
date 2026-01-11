"use client";

import * as React from "react";
import { cn } from "../lib/utils";


export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground",
        "placeholder:text-muted outline-none",
        "focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/20",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
    />
  );
}
