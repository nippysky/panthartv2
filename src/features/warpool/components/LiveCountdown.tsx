"use client";

import * as React from "react";
import { formatRemaining } from "@/src/features/warpool/lib/helpers";

type Props = {
  target: string | null | undefined;
  label?: string;
  expiredLabel?: string;
  className?: string;
};

export default function LiveCountdown({
  target,
  label = "Time left",
  expiredLabel = "Ended",
  className = "",
}: Props) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!target) return;

    const parsed = Date.parse(target);
    if (Number.isNaN(parsed)) return;

    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [target]);

  if (!target) {
    return (
      <span
        className={[
          "inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/70",
          className,
        ].join(" ")}
      >
        Waiting for next pool
      </span>
    );
  }

  const parsed = Date.parse(target);
  if (Number.isNaN(parsed)) {
    return (
      <span
        className={[
          "inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/70",
          className,
        ].join(" ")}
      >
        {target}
      </span>
    );
  }

  const diff = parsed - now;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/75",
        className,
      ].join(" ")}
    >
      {diff <= 0 ? expiredLabel : `${label}: ${formatRemaining(diff)}`}
    </span>
  );
}