import Link from "next/link";
import { ArrowRight, Clock3, PlayCircle, Sparkles, Users2 } from "lucide-react";
import type { WarpoolQueue } from "@/src/features/warpool/types";
import {
  clampPercent,
  queueStatusTone,
} from "@/src/features/warpool/lib/helpers";
import LiveCountdown from "@/src/features/warpool/components/LiveCountdown";
import { formatNumber } from "@/src/lib/utils";

type Props = {
  queue: WarpoolQueue;
};

function isJoinable(status: WarpoolQueue["status"]) {
  return status === "Open" || status === "Filling";
}

function isBattleViewable(status: WarpoolQueue["status"]) {
  return status === "Battle Ready";
}

function isDisabled(status: WarpoolQueue["status"]) {
  return status === "Locked" || status === "Closed" || status === "Settled";
}

function formatCompactAmount(value: string | null | undefined) {
  if (!value) return "0";
  const match = value.trim().match(/^([+-]?\d*\.?\d+)\s*(.*)$/);
  if (!match) return value;

  const numeric = Number(match[1]);
  const suffix = match[2]?.trim();

  if (!Number.isFinite(numeric)) return value;

  const compact = formatNumber(numeric, { min: 0, max: 2 });
  return suffix ? `${compact} ${suffix}` : compact;
}

function QueueCardInner({ queue }: Props) {
  const pct = clampPercent(queue.entrants, queue.maxEntrants);

  const hasLivePool = !!queue.poolId && !!queue.poolIdOnChain;
  const joinable = isJoinable(queue.status);
  const battleViewable = isBattleViewable(queue.status);
  const disabled = isDisabled(queue.status) || battleViewable;

  return (
    <div
      className={[
        "rounded-[30px] border p-5 shadow-[0_12px_30px_rgba(0,0,0,0.03)] transition dark:shadow-[0_16px_50px_rgba(0,0,0,0.22)]",
        joinable
          ? "border-border bg-card/85 hover:-translate-y-0.5 hover:bg-card"
          : "border-border bg-card/55 opacity-75",
      ].join(" ")}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">{queue.title}</div>
          <div className="mt-1 text-sm text-foreground/55">
            {queue.format} · Entry {formatCompactAmount(queue.stake)}
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
            {hasLivePool && queue.status !== "Closed" && queue.status !== "Settled"
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
            className={[
              "h-2 rounded-full transition-all",
              disabled ? "bg-foreground/20" : "bg-accent",
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {joinable ? (
          <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground/78 transition group-hover:text-foreground">
            View queue
            <ArrowRight className="h-4 w-4" />
          </div>
        ) : battleViewable && queue.poolId ? (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground/60">
              Entry closed · battle ready
            </div>

            <Link
              href={`/comrades-warpool/battle/${queue.poolId}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-card"
            >
              <PlayCircle className="h-4 w-4" />
              Watch battle
            </Link>
          </div>
        ) : queue.status === "Locked" ? (
          <div className="text-sm font-medium text-foreground/55">
            Pool locking
          </div>
        ) : queue.status === "Closed" ? (
          <div className="text-sm font-medium text-foreground/55">
            Queue unavailable
          </div>
        ) : (
          <div className="text-sm font-medium text-foreground/55">
            Battle settled
          </div>
        )}
      </div>
    </div>
  );
}

export default function QueueCard({ queue }: Props) {
  const joinable = isJoinable(queue.status);

  if (!joinable) {
    return <QueueCardInner queue={queue} />;
  }

  return (
    <Link href={`/comrades-warpool/queue/${queue.slug}`} className="group block">
      <QueueCardInner queue={queue} />
    </Link>
  );
}