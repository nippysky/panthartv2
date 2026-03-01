// app/profile/[address]/ui/CopyButton.tsx
"use client";

import { useMemo, useState } from "react";

export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const label = useMemo(() => (copied ? "Copied" : "Copy"), [copied]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background"
      aria-label="Copy to clipboard"
    >
      {label}
    </button>
  );
}
