"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import AsyncState from "@/src/features/warpool/components/AsyncState";
import BattleArenaCard from "@/src/features/warpool/components/BattleArenaCard";
import BattleSummaryCard from "@/src/features/warpool/components/BattleSummaryCard";
import EligibilityCard from "@/src/features/warpool/components/EligibilityCard";
import LoadingPanel from "@/src/features/warpool/components/LoadingPanel";
import SectionBadge from "@/src/features/warpool/components/SectionBadge";
import TimelineCard from "@/src/features/warpool/components/TimelineCard";
import { useWarpoolBattle } from "@/src/features/warpool/hook/useWarpoolBattle";

export default function WarpoolBattlePage() {
  const params = useParams<{ poolId: string }>();
  const poolId = decodeURIComponent(params.poolId);
  const { address } = useDecentWalletAccount();

  const { battle, eligibility, isLoading, error, refetch } = useWarpoolBattle(
    poolId,
    address
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <LoadingPanel className="h-10 w-24 rounded-full" />
          <div className="mt-6">
            <LoadingPanel className="h-[560px] rounded-[36px]" />
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
            title="Unable to load battle"
            body={error}
            onRetry={refetch}
            backHref="/comrades-warpool"
            backLabel="Back to Warpool"
          />
        </div>
      </main>
    );
  }

  if (!battle) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <AsyncState
            title="Battle not found"
            body="The pool you opened does not currently exist."
            backHref="/comrades-warpool/history"
            backLabel="Back to history"
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
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <SectionBadge
                icon={<Swords className="h-3.5 w-3.5 text-accent" />}
              >
                Live battle
              </SectionBadge>

              <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
  Pool #{battle.poolId}
</h1>
                  <p className="mt-2 text-sm text-foreground/60">
                    {battle.queue} · {battle.round}
                  </p>
                </div>

                <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
                  {battle.state}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                    Stake
                  </div>
                  <div className="mt-2 text-lg font-medium">{battle.stake}</div>
                </div>

                <div className="rounded-[24px] border border-border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                    Prize pool
                  </div>
                  <div className="mt-2 text-lg font-medium">
                    {battle.prizePool}
                  </div>
                </div>

                <div className="rounded-[24px] border border-border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                    Started
                  </div>
                  <div className="mt-2 text-lg font-medium">
                    {battle.startedAt}
                  </div>
                </div>
              </div>

              <BattleArenaCard battle={battle} />
            </div>

                   <aside className="space-y-5">
              <EligibilityCard type="battle" eligibility={eligibility} />
              <TimelineCard timeline={battle.timeline} />
              <BattleSummaryCard battle={battle} />
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}