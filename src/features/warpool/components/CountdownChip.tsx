"use client";

import * as React from "react";

type Props = {
  value: string | null | undefined;
  mode: "reservation" | "claim";
};

function formatRemaining(ms: number) {
  if (ms <= 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function CountdownChip({ value, mode }: Props) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!value) return;

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return;

    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [value]);

  if (!value) return null;

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/70">
        {value}
      </span>
    );
  }

  const diff = parsed - now;
  const expired = diff <= 0;

  const label =
    mode === "reservation"
      ? expired
        ? "Reservation expired"
        : `Expires in ${formatRemaining(diff)}`
      : expired
      ? "Claimable now"
      : `Claim in ${formatRemaining(diff)}`;

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/75">
      {label}
    </span>
  );
}