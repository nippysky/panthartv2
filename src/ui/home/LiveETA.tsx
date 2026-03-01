
"use client";

// src/ui/home/LiveEta.tsx
import * as React from "react";

function msParts(ms: number) {
  const clamp = Math.max(0, ms);
  const d = Math.floor(clamp / 86400000);
  const h = Math.floor((clamp % 86400000) / 3600000);
  const m = Math.floor((clamp % 3600000) / 60000);
  const s = Math.floor((clamp % 60000) / 1000);
  return { d, h, m, s };
}

function formatEta(ms: number) {
  const { d, h, m, s } = msParts(ms);

  // “premium short”
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LiveEta({
  endISO,
  nowMs,
  prefix,
  className,
}: {
  endISO: string;
  nowMs: number; // server-provided “now” for purity
  prefix?: string; // e.g. "Ends "
  className?: string;
}) {
  const endMs = React.useMemo(() => new Date(endISO).getTime(), [endISO]);

  const [t, setT] = React.useState(() => nowMs);

  React.useEffect(() => {
    // re-seed when server “now” changes (navigation / refresh)
    setT(nowMs);

    const id = window.setInterval(() => setT(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [nowMs]);

  if (!Number.isFinite(endMs)) return <span className={className}>—</span>;

  const left = endMs - t;
  const label = left <= 0 ? "Ended" : formatEta(left);

  return <span className={className}>{prefix ? `${prefix}${label}` : label}</span>;
}