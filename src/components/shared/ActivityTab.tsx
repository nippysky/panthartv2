/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/src/lib/utils";

type Variant =
  | "default" // ✅ alias for primary (for old code)
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "link"
  | "danger";

type Size = "sm" | "md" | "lg" | "icon";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
};

type ButtonOnlyProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type LinkOnlyProps = CommonProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

export function Button(props: ButtonOnlyProps | LinkOnlyProps) {
  const {
    className,
    variant = "primary",
    size = "md",
    loading,
    children,
    ...rest
  } = props as any;

  // ✅ Map legacy "default" => "primary"
  const v: Variant = variant === "default" ? "primary" : variant;

  const base = cn(
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
  );

  const content = loading ? (
    <span className="inline-flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
      {children}
    </span>
  ) : (
    children
  );

  // LINK MODE
  if ("href" in props && props.href) {
    const { href, ...a } = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    const ariaDisabled = (a as any)["aria-disabled"] ?? false;

    return (
      <Link
        href={href as string}
        className={cn(base, (ariaDisabled || loading) && "pointer-events-none opacity-60")}
        {...a}
      >
        {content}
      </Link>
    );
  }

  // BUTTON MODE
  const b = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  const isDisabled = Boolean(b.disabled || loading);

  return (
    <button {...b} disabled={isDisabled} className={base}>
      {content}
    </button>
  );
}
