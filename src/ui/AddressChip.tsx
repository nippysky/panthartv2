// src/components/common/AddressChip.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

function shorten(addr: string) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

export default function AddressChip({
  address,
  showCopy = false,
  className = "",
}: {
  address: string;
  showCopy?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const ok = await copyToClipboard(address);
    if (ok) {
      setCopied(true);
      toast.success("Address copied");
      window.setTimeout(() => setCopied(false), 1400);
    } else {
      toast.error("Copy failed");
    }
  };

  if (!address) {
    return (
      <span
        className={`inline-flex h-10 items-center rounded-full border border-border bg-background px-3 text-xs text-muted ${className}`}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={[
        "inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors",
        className,
      ].join(" ")}
      title={address}
    >
      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
      <span className="truncate font-mono text-xs sm:text-sm">{shorten(address)}</span>

      {showCopy ? (
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-background"
          aria-label={copied ? "Copied" : "Copy address"}
          title={copied ? "Copied" : "Copy address"}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="10" height="10" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}