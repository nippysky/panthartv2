import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { WarpoolQueue } from "@/src/features/warpool/types";
import {
  clampPercent,
  queueStatusTone,
} from "@/src/features/warpool/lib/helpers";

type Props = {
  queue: WarpoolQueue;
};

export default function QueueCard({ queue }: Props) {
  const pct = clampPercent(queue.entrants, queue.maxEntrants);

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

      <p className="text-sm leading-6 text-foreground/62">{queue.highlight}</p>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-sm text-foreground/60">
          <span>
            {queue.entrants}/{queue.maxEntrants} filled
          </span>
          <span>ETA {queue.eta}</span>
        </div>

        <div className="h-2 rounded-full bg-foreground/8">
          <div
            className="h-2 rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground/78 transition group-hover:text-foreground">
        Open queue
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}