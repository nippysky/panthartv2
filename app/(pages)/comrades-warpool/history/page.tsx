"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarRange, Trophy } from "lucide-react";
import AsyncState from "@/src/features/warpool/components/AsyncState";
import SectionBadge from "@/src/features/warpool/components/SectionBadge";
import { useWarpoolHistory } from "@/src/features/warpool/hook/useWarpoolHistory";

export default function WarpoolHistoryPage() {
  const { items, isLoading, isRefreshing, error, refetch } = useWarpoolHistory();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 animate-pulse">
          <div className="h-10 w-24 rounded-full bg-foreground/8" />
          <div className="mt-6 h-130 rounded-[36px] bg-foreground/8" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <AsyncState
            title="Unable to load history"
            body={error}
            onRetry={refetch}
            backHref="/comrades-warpool"
            backLabel="Back to Warpool"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground page-enter">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/comrades-warpool"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground/78 transition hover:bg-card/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        <section className="rounded-[36px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <SectionBadge
                icon={<CalendarRange className="h-3.5 w-3.5 text-accent" />}
              >
                Battle history
              </SectionBadge>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Resolved pools
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/62 sm:text-base">
                Settled pools, winners, and prize outcomes from the indexed
                Warpool battle history.
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-background/80 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                Visible records
              </div>
              <div className="mt-1 text-xl font-semibold">{items.length}</div>
              <div className="mt-1 text-xs text-foreground/45">
                {isRefreshing ? "Refreshing..." : "Live data ready"}
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <AsyncState title="No history yet" body="No resolved pools found." />
          ) : (
            <div className="grid gap-4">
              {items.map((row) => (
                <Link
                  key={row.id}
                  href={`/comrades-warpool/battle/${row.id}`}
                  className="group rounded-[28px] border border-border bg-background/80 p-5 transition hover:bg-card"
                >
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                    <div>
                      <div className="text-lg font-medium">Pool #{row.id}</div>
                      <div className="mt-1 text-sm text-foreground/55">
                        {row.queue}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                        Winner
                      </div>
                      <div className="mt-2 text-sm text-foreground">
                        {row.winner}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-accent">
                        <Trophy className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                          Prize
                        </div>
                        <div className="mt-2 text-sm text-foreground">
                          {row.prize}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 lg:justify-end">
                      <div className="text-right">
                        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-200">
                          {row.status}
                        </div>
                        <div className="mt-2 text-xs text-foreground/45">
                          {row.time}
                        </div>
                      </div>

                      <ArrowRight className="h-4 w-4 text-foreground/45 transition group-hover:text-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}