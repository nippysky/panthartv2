import Link from "next/link";
import { ArrowRight, Clock3, Sparkles, Users2 } from "lucide-react";
import type { WarpoolQueue } from "@/src/features/warpool/types";
import {
  clampPercent,
  queueStatusTone,
} from "@/src/features/warpool/lib/helpers";
import LiveCountdown from "@/src/features/warpool/components/LiveCountdown";

type Props = {
  queue: WarpoolQueue;
};

export default function QueueCard({ queue }: Props) {
  const pct = clampPercent(queue.entrants, queue.maxEntrants);

  const hasLivePool = !!queue.poolId && !!queue.poolIdOnChain;
  const isClosed = queue.status === "Closed";

  return (
    <Link
      href={`/comrades-warpool/queue/${queue.slug}`}
      className="group rounded-[30px] border border-border bg-card/85 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:bg-card dark:shadow-[0_16px_50px_rgba(0,0,0,0.22)]"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">{queue.title}</div>
          <div className="mt-1 text-sm text-foreground/55">
            {queue.format} · Stake {queue.stake}
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${queueStatusTone(
            queue.status
          )}`}
        >
          {queue.status}
        </span>
      </div>

      <p className="text-sm leading-6 text-foreground/62">{queue.summary}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-border bg-background/80 p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-foreground/42">
            <Users2 className="h-3.5 w-3.5 text-accent" />
            Pool fill
          </div>
          <div className="text-lg font-semibold">
            {queue.entrants}/{queue.maxEntrants}
          </div>
          <div className="mt-1 text-xs text-foreground/50">
            {hasLivePool && !isClosed
              ? queue.remainingSpots > 0
                ? `${queue.remainingSpots} spot${queue.remainingSpots === 1 ? "" : "s"} left`
                : "Pool filled"
              : "Waiting for next live pool"}
          </div>
        </div>

        <div className="rounded-[22px] border border-border bg-background/80 p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-foreground/42">
            <Clock3 className="h-3.5 w-3.5 text-accent" />
            Countdown
          </div>

          {hasLivePool && queue.expiresAt ? (
            <LiveCountdown
              target={queue.expiresAt}
              label="Closes in"
              expiredLabel="Processing expiry"
            />
          ) : (
            <div className="text-sm text-foreground/55">Waiting for next pool</div>
          )}
        </div>

        <div className="rounded-[22px] border border-border bg-background/80 p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-foreground/42">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Relics
          </div>
          <div className="text-sm text-foreground/75">
            {queue.acceptsRelics
              ? `Discount seats ${
                  queue.discountSeatsRemaining ?? 0
                } · Token 11 seats ${queue.token11SeatsRemaining ?? 0}`
              : "Not used in this queue"}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm text-foreground/60">
          <span>Queue progress</span>
          <span>{Math.round(pct)}%</span>
        </div>

        <div className="h-2 rounded-full bg-foreground/8">
          <div
            className="h-2 rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground/78 transition group-hover:text-foreground">
        View queue
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}