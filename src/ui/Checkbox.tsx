"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export function Checkbox({
  checked,
  onCheckedChange,
  className,
  id,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
}) {
  return (
    <input
      {...props}
      id={id}
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={cn(
        "h-4 w-4 rounded border border-border bg-card",
        "accent-accent",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30",
        className
      )}
    />
  );
}
