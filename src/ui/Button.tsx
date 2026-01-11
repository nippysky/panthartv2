"use client";

import * as React from "react";
import { cn } from "../lib/utils";

type Variant =
  | "default" // ✅ backward-compatible alias
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "link"
  | "danger";

type Size = "sm" | "md" | "lg" | "icon";

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;

  // ✅ map "default" -> primary styles
  const v: Variant = variant === "default" ? "primary" : variant;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none",
        "rounded-2xl border transition active:scale-[0.99]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm font-semibold",
        size === "lg" && "h-12 px-5 text-base font-semibold",
        size === "icon" && "h-10 w-10 px-0",

        v === "primary" && "bg-foreground text-background border-border hover:opacity-95",
        v === "secondary" && "bg-card text-foreground border-border hover:bg-background/60",
        v === "outline" && "bg-transparent text-foreground border-border hover:bg-background/60",
        v === "ghost" && "bg-transparent text-foreground border-transparent hover:bg-background/60",
        v === "link" &&
          "bg-transparent border-transparent text-foreground underline-offset-4 hover:underline px-0",
        v === "danger" && "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/15",

        className
      )}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
