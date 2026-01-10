"use client";

import * as React from "react";

export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 900);
        } catch {}
      }}
      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-background/60"
      aria-label="Copy contract address"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
