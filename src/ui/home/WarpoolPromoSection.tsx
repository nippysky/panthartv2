import Link from "next/link";
import { ArrowRight, Shield, Sparkles, Swords, Trophy } from "lucide-react";
import { formatNumber } from "@/src/lib/utils";
import { listWarpoolQueues } from "@/src/server/warpool";

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

function toneForStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("open") || normalized.includes("filling")) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }
  if (normalized.includes("battle")) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }
  if (normalized.includes("locked")) {
    return "border-border bg-background text-foreground/70";
  }
  return "border-border bg-background text-foreground/60";
}

export default async function WarpoolPromoSection() {
  const queues = await listWarpoolQueues();
  const featuredQueues = queues.slice(0, 4);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[36px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs text-foreground/72">
              <Swords className="h-3.5 w-3.5 text-accent" />
              Comrades Warpool
            </div>

            <div className="space-y-4">
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Bring your comrade into live arena combat.
              </h2>

              <p className="max-w-2xl text-sm leading-7 text-foreground/64 sm:text-base">
                Pick a queue, lock your fighter, add a relic when the seat is open,
                and battle for the pool in Panth.art’s live on-chain game layer.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/72">
                <Shield className="h-3.5 w-3.5 text-accent" />
                Safeguard pools
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/72">
                <Trophy className="h-3.5 w-3.5 text-accent" />
                Vaultbound stakes
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/72">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                Relic discounts
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/comrades-warpool"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:scale-[1.01]"
              >
                Enter Warpool
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/comrades-warpool/rules"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition hover:bg-card"
              >
                Read rules
              </Link>
            </div>
          </div>

          <div className="rounded-[30px] border border-border bg-background/80 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                  Live queues
                </p>
                <h3 className="mt-1 text-lg font-semibold">Choose your lane</h3>
              </div>

              <div className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/60">
                {featuredQueues.length} queues
              </div>
            </div>

            <div className="space-y-3">
              {featuredQueues.map((queue) => (
                <div
                  key={queue.slug}
                  className="rounded-3xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {queue.title}
                      </div>
                      <div className="mt-1 text-sm text-foreground/55">
                        Entry {formatCompactAmount(queue.stake)}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneForStatus(
                        queue.status
                      )}`}
                    >
                      {queue.status}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-foreground/48">
                    {queue.entrants}/{queue.maxEntrants} entered
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}