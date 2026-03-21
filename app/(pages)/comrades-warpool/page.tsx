"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Shield,
  Swords,
  Trophy,
  Wallet,
} from "lucide-react";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";

import AsyncState from "@/src/features/warpool/components/AsyncState";
import FilterToolbar from "@/src/features/warpool/components/FilterToolbar";
import HeroStats from "@/src/features/warpool/components/HeroStats";
import LoadingPanel from "@/src/features/warpool/components/LoadingPanel";
import QueueCard from "@/src/features/warpool/components/QueueCard";
import SectionBadge from "@/src/features/warpool/components/SectionBadge";
import { shortAddress } from "@/src/features/warpool/lib/helpers";
import { useWarpoolQueues } from "@/src/features/warpool/hook/useWarpoolQueues";

export default function ComradesWarpoolPage() {
  const { address, isConnected } = useDecentWalletAccount();

  const {
    filteredQueues,
    recentWinners,
    liveQueueCount,
    search,
    setSearch,
    filter,
    setFilter,
    isLoading,
    isRefreshing,
    error,
    refetch,
  } = useWarpoolQueues();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <LoadingPanel className="h-16 w-2/3 rounded-3xl" />
          <LoadingPanel className="mt-4 h-5 w-1/2 rounded-full" />

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <LoadingPanel className="h-64 rounded-[30px]" />
            <LoadingPanel className="h-64 rounded-[30px]" />
            <LoadingPanel className="h-64 rounded-[30px]" />
            <LoadingPanel className="h-64 rounded-[30px]" />
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
            title="Unable to load Warpool"
            body={error}
            onRetry={refetch}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground page-enter">
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 -top-55 h-130 w-130 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl dark:bg-accent/8" />
          <div className="absolute left-[10%] top-[14%] h-48 w-48 rounded-full bg-accent/8 blur-3xl dark:bg-accent/6" />
          <div className="absolute right-[10%] top-[18%] h-56 w-56 rounded-full bg-foreground/5 blur-3xl dark:bg-accent/5" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="space-y-6">
              <SectionBadge
                icon={<Swords className="h-3.5 w-3.5 text-accent" />}
              >
                Comrades Warpool
              </SectionBadge>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Stake. Queue. Battle.
                  <br />
                  Win the pool.
                </h1>

                <p className="max-w-2xl text-sm leading-7 text-foreground/68 sm:text-base">
                  Comrades Warpool is the competitive layer for DCNT-powered
                  battles. Join live queues, reserve your position with your
                  wallet, follow active pools, and track battle history in a
                  premium fast interface built for serious play.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="#live-queues"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:scale-[1.01]"
                >
                  Enter queue
                  <ArrowRight className="h-4 w-4" />
                </a>

                <Link
                  href="/comrades-warpool/history"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground/86 transition hover:bg-background"
                >
                  View history
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeroStats
                  icon={<Shield className="h-5 w-5" />}
                  title="On-chain"
                  body="Battle actions and reward flow designed for transparent play."
                />

                <HeroStats
                  icon={<Clock3 className="h-5 w-5" />}
                  title={String(liveQueueCount)}
                  body="Live queues filling right now across battle formats."
                />

                <HeroStats
                  icon={<Wallet className="h-5 w-5" />}
                  title={isConnected ? "Ready" : "Connect"}
                  body={
                    isConnected
                      ? `Wallet linked: ${shortAddress(address)}`
                      : "Connect wallet from the global header to join gated battles."
                  }
                />
              </div>
            </div>

            <div className="rounded-4xl border border-border bg-card/85 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">
                    Live pulse
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    Recent winners
                  </h2>
                </div>
                <Trophy className="h-5 w-5 text-foreground/55" />
              </div>

              <div className="space-y-3">
                {recentWinners.map((battle) => (
                  <div
                    key={battle.id}
                    className="rounded-3xl border border-border bg-background/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground/92">
                          {battle.label}
                        </p>
                        <p className="mt-1 text-sm text-foreground/55">
                          Winner {battle.winner}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {battle.prize}
                        </p>
                        <p className="mt-1 text-xs text-foreground/45">
                          {battle.time}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/comrades-warpool/history"
                className="mt-4 inline-flex items-center gap-2 text-sm text-foreground/70 transition hover:text-foreground"
              >
                Full history
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="live-queues"
        className="mx-auto max-w-7xl scroll-mt-28 px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/42">
              Matchmaking
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Live queues
            </h2>
          </div>

          <Link
            href="/comrades-warpool/history"
            className="hidden rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground/72 transition hover:bg-background sm:inline-flex"
          >
            History
          </Link>
        </div>

        <FilterToolbar
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={(value) => setFilter(value as typeof filter)}
          searchPlaceholder="Search queues, stakes, or formats..."
          isRefreshing={isRefreshing}
          filterOptions={[
            { label: "All statuses", value: "all" },
            { label: "Open", value: "Open" },
            { label: "Filling", value: "Filling" },
            { label: "Locked", value: "Locked" },
            { label: "Battle Ready", value: "Battle Ready" },
            { label: "Settled", value: "Settled" },
          ]}
        />

        {filteredQueues.length === 0 ? (
          <AsyncState
            title="No matching queues"
            body="Try a different search or status filter."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredQueues.map((queue) => (
              <QueueCard key={queue.slug} queue={queue} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}