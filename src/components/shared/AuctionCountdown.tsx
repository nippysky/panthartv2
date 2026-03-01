"use client";

import React from "react";

export default function AuctionCardCountdown({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = React.useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    ended: false,
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const diff = end - now;

      if (!Number.isFinite(end) || diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, ended: true });
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);

      setTimeLeft({ hours, minutes, seconds, ended: false });
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  if (timeLeft.ended) {
    return (
      <div className="inline-flex items-center px-3 py-1.5 rounded-full
        bg-red-500/10 dark:bg-red-500/20
        text-red-600 dark:text-red-400
        text-xs font-medium
        backdrop-blur-md border border-red-500/20">
        ● Auction Ended
      </div>
    );
  }

  const format = (num: number) => String(num).padStart(2, "0");

  return (
    <div
      className="
        inline-flex items-center gap-2
        px-3 py-1.5 rounded-full
        text-xs font-semibold tracking-tight
        bg-white/70 dark:bg-zinc-900/60
        text-zinc-900 dark:text-zinc-100
        border border-zinc-200 dark:border-zinc-700
        backdrop-blur-md
        shadow-sm
        transition-colors duration-300
      "
    >
      <TimeBlock value={format(timeLeft.hours)} label="H" />
      <Separator />
      <TimeBlock value={format(timeLeft.minutes)} label="M" />
      <Separator />
      <TimeBlock value={format(timeLeft.seconds)} label="S" />
    </div>
  );
}

function TimeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className="tabular-nums">{value}</span>
      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <span className="text-zinc-400 dark:text-zinc-600">:</span>
  );
}