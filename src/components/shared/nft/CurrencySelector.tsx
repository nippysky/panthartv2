"use client";

import * as React from "react";
import { cn } from "@/src/lib/utils";

export type CurrencyOption = {
  id: string; // "native" or Currency.id
  symbol: string;
  decimals: number;
  kind: "NATIVE" | "ERC20";
  tokenAddress?: string | null;
};

export function CurrencySelect({
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  options: CurrencyOption[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "h-10 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground",
        "outline-none",
        "focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/20",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
    >
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.symbol} {c.kind === "ERC20" ? "(Token)" : "(Native)"}
        </option>
      ))}
    </select>
  );
}
