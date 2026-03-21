"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Shield,
  Swords,
  Users2,
} from "lucide-react";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";

import AsyncState from "@/src/features/warpool/components/AsyncState";
import EligibilityCard from "@/src/features/warpool/components/EligibilityCard";
import LoadingPanel from "@/src/features/warpool/components/LoadingPanel";
import QueueJoinCard from "@/src/features/warpool/components/QueueJoinCard";
import QueueRulesCard from "@/src/features/warpool/components/QueueRulesCard";
import SectionBadge from "@/src/features/warpool/components/SectionBadge";
import { clampPercent } from "@/src/features/warpool/lib/helpers";
import { useWarpoolQueue } from "@/src/features/warpool/hook/useWarpoolQueue";

export default function WarpoolQueuePage() {
  const params = useParams<{ queueSlug: string }>();
  const queueSlug = decodeURIComponent(params.queueSlug);
  const { address } = useDecentWalletAccount();

  const { queue, eligibility, isLoading, error, refetch } = useWarpoolQueue(
    queueSlug,
    address
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <LoadingPanel className="h-10 w-24 rounded-full" />
          <div className="mt-6">
            <LoadingPanel className="h-130 rounded-[34px]" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <AsyncState
            title="Unable to load queue"
            body={error}
            onRetry={refetch}
            backHref="/comrades-warpool"
            backLabel="Back to Warpool"
          />
        </div>
      </main>
    );
  }

  if (!queue) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <AsyncState
            title="Queue not found"
            body="The queue you opened is not currently available."
            backHref="/comrades-warpool"
            backLabel="Back to Warpool"
          />
        </div>
      </main>
    );
  }

  const progress = clampPercent(queue.entrants, queue.maxEntrants);

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

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[34px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <SectionBadge
                  icon={<Swords className="h-3.5 w-3.5 text-accent" />}
                >
                  Queue Detail
                </SectionBadge>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {queue.title}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/64 sm:text-base">
                  {queue.summary}
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-background/80 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                  ETA
                </div>
                <div className="mt-1 text-xl font-semibold">{queue.eta}</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-border bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                  Format
                </div>
                <div className="mt-2 text-lg font-medium">{queue.format}</div>
              </div>

              <div className="rounded-3xl border border-border bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                  Entry Stake
                </div>
                <div className="mt-2 text-lg font-medium">{queue.stake}</div>
              </div>

              <div className="rounded-3xl border border-border bg-background/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                  Queue Fee
                </div>
                <div className="mt-2 text-lg font-medium">{queue.fee}</div>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-border bg-background/80 p-5">
              <div className="mb-3 flex items-center justify-between text-sm text-foreground/65">
                <span className="inline-flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-accent" />
                  Fill progress
                </span>
                <span>
                  {queue.entrants}/{queue.maxEntrants}
                </span>
              </div>

              <div className="h-2.5 rounded-full bg-foreground/8">
                <div
                  className="h-2.5 rounded-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-border bg-background/80 p-4">
                <Clock3 className="mb-3 h-5 w-5 text-accent" />
                <div className="text-sm font-medium">Fast queueing</div>
                <p className="mt-1 text-sm leading-6 text-foreground/55">
                  Built for quick pool creation and short wait times.
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-background/80 p-4">
                <Shield className="mb-3 h-5 w-5 text-accent" />
                <div className="text-sm font-medium">Transparent flow</div>
                <p className="mt-1 text-sm leading-6 text-foreground/55">
                  Battle lifecycle becomes easy to follow once live state is
                  wired.
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-background/80 p-4">
                <CheckCircle2 className="mb-3 h-5 w-5 text-accent" />
                <div className="text-sm font-medium">History-ready</div>
                <p className="mt-1 text-sm leading-6 text-foreground/55">
                  Pools settle into the history feed for replayable tracking.
                </p>
              </div>
            </div>
          </section>

          <aside className="space-y-5">
       <QueueJoinCard
  queue={queue}
  eligibility={eligibility}
  onRefresh={refetch}
/>
            <EligibilityCard type="queue" eligibility={eligibility} />
            <QueueRulesCard rules={queue.rules} />
          </aside>
        </div>
      </div>
    </main>
  );
}