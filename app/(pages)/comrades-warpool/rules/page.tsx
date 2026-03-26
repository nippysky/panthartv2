import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Clock3,
  Coins,
  Gauge,
  Link2,
  Shield,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";

import { formatNumber } from "@/src/lib/utils";
import { loadWarpoolDocsData } from "@/src/server/warpool-docs";

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

function formatPercentFromBps(bps: number | null | undefined) {
  if (bps == null) return "—";
  return `${formatNumber(bps / 100, { min: 0, max: 2 })}%`;
}

function humanizeSeconds(value: number | null | undefined) {
  if (value == null) return "—";
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${formatNumber(value / 60, { min: 0, max: 2 })} min`;
  if (value < 86400) return `${formatNumber(value / 3600, { min: 0, max: 2 })} hrs`;
  return `${formatNumber(value / 86400, { min: 0, max: 2 })} days`;
}

function tone(flag: boolean | null | undefined) {
  return flag
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
    : "border-border bg-background text-foreground/65";
}

function queueModeLabel(mode: number) {
  if (mode === 1) return "Safeguard";
  if (mode === 2) return "Vaultbound";
  return "Unknown";
}

function queueTierLabel(tier: number) {
  if (tier === 1) return "Forge";
  if (tier === 2) return "Legion";
  if (tier === 3) return "Crown";
  return "Unknown";
}

export default async function WarpoolRulesPage() {
  const { snapshot, queues, contracts } = await loadWarpoolDocsData();

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

        <section className="overflow-hidden rounded-[36px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7 lg:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs text-foreground/72">
                <CalendarRange className="h-3.5 w-3.5 text-accent" />
                Warpool rules & operations
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  How Comrades Warpool works
                </h1>

                <p className="max-w-3xl text-sm leading-7 text-foreground/66 sm:text-base">
                  This page explains, in simple terms, how to enter, how pools
                  start, how winners are chosen, what relics do, what happens in
                  Safeguard and Vaultbound queues, and how payouts, cooldowns,
                  and captured comrades are handled.
                </p>
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
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition hover:bg-card"
                >
                  Back to marketplace
                </Link>
              </div>
            </div>

            <div className="rounded-[30px] border border-border bg-background/80 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                <Gauge className="h-4 w-4 text-accent" />
                Current live config snapshot
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                    Config version
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {snapshot?.configVersion ?? "—"}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                    Match rounds
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {snapshot?.roundsPerMatch ?? "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs ${tone(!(snapshot?.entriesPaused ?? false))}`}>
                  Entries {snapshot?.entriesPaused ? "paused" : "live"}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs ${tone(!(snapshot?.reservationsPaused ?? false))}`}>
                  Reservations {snapshot?.reservationsPaused ? "paused" : "live"}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs ${tone(!(snapshot?.settlementsPaused ?? false))}`}>
                  Settlements {snapshot?.settlementsPaused ? "paused" : "live"}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs ${tone(snapshot?.relicsEnabled ?? false)}`}>
                  Relics {snapshot?.relicsEnabled ? "enabled" : "off"}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs ${tone(snapshot?.fatigueEnabled ?? false)}`}>
                  Fatigue {snapshot?.fatigueEnabled ? "enabled" : "off"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <section className="rounded-[30px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Swords className="h-4 w-4 text-accent" />
                  The basic game flow
                </div>

                <div className="space-y-4 text-sm leading-7 text-foreground/66">
                  <p>
                    You start by choosing a queue and entering one comrade into
                    the live pool for that queue.
                  </p>

                  <p>
                    As more players join, the pool fills up. If the pool reaches
                    its full size, it locks and moves into battle automatically.
                  </p>

                  <p>
                    If time runs out before the pool is full, the game checks
                    whether there are enough players to still run a battle. If
                    there are enough, the battle starts with the largest valid
                    bracket size. If there are not enough, the pool is refunded
                    and a new pool opens again automatically.
                  </p>
                </div>
              </section>

              <section className="rounded-[30px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Shield className="h-4 w-4 text-accent" />
                  Safeguard vs Vaultbound
                </div>

                <div className="space-y-4 text-sm leading-7 text-foreground/66">
                  <p>
                    Warpool has two main styles of play.
                  </p>

                  <p>
                    In <span className="font-medium text-foreground">Safeguard</span> queues,
                    your selected comrade is returned after the game settles.
                  </p>

                  <p>
                    In <span className="font-medium text-foreground">Vaultbound</span> queues,
                    winners still get their comrades back, but selected comrades
                    that lose can be captured as part of the game outcome.
                  </p>

                  <p>
                    Captured comrades are then handled automatically by the system’s
                    worker process, which settles the pool and relists captured
                    comrades on the marketplace for sale.
                  </p>
                </div>
              </section>

              <section className="rounded-[30px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-accent" />
                  How relics work
                </div>

                <div className="space-y-4 text-sm leading-7 text-foreground/66">
                  <p>
                    Relics are special items that can give extra advantages in
                    supported queues.
                  </p>

                  <p>
                    Standard relics can reduce the amount you pay to enter by
                    applying a discount when a discount seat is available.
                  </p>

                  <p>
                    Relic <span className="font-medium text-foreground">#11</span> is the special relic.
                    It can enter through its own special seat, pay no entry stake,
                    and may also receive a share of the platform fee when that
                    feature is enabled in the live config.
                  </p>

                  <p>
                    The exact discount range, seat limits, reservation timing,
                    and fee-share behavior are all controlled by live config and
                    shown on this page automatically.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-border bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-foreground/40">
                        Discount range
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {formatPercentFromBps(snapshot?.relicMinDiscountBps)} to{" "}
                        {formatPercentFromBps(snapshot?.relicMaxDiscountBps)}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-foreground/40">
                        Reservation TTL
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {humanizeSeconds(snapshot?.reservationTtlSeconds)}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-foreground/40">
                        Discount seats
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {snapshot?.discountSeatCap ?? "—"}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-foreground/40">
                        Token #11 seats
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {snapshot?.token11SeatCap ?? "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[30px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Coins className="h-4 w-4 text-accent" />
                  Payouts and settlement
                </div>

                <div className="space-y-4 text-sm leading-7 text-foreground/66">
                  <p>
                    When a battle ends, the system settles the pool automatically.
                  </p>

                  <p>
                    The total selected stake is split between the top finishers
                    using the live payout settings for that queue. The platform
                    fee is also taken automatically during settlement.
                  </p>

                  <p>
                    Any relic returns, winner payouts, token #11 fee-share, and
                    capture handling are all processed as part of that settlement flow.
                  </p>
                </div>
              </section>

              <section className="rounded-[30px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Clock3 className="h-4 w-4 text-accent" />
                  Fatigue and cooldowns
                </div>

                <div className="space-y-4 text-sm leading-7 text-foreground/66">
                  <p>
                    To keep the game fair and stop the same fighters from being
                    spammed over and over, Warpool uses a fatigue system.
                  </p>

                  <p>
                    After enough consecutive uses, a comrade enters a cooldown
                    period and cannot be used again until that cooldown ends.
                  </p>

                  <p>
                    This is why a fighter may appear disabled in the queue entry
                    screen with a live countdown showing when it becomes usable again.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-border bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-foreground/40">
                        Max consecutive entries
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {snapshot?.fatigueMaxConsecutive ?? "—"}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-foreground/40">
                        Cooldown
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {humanizeSeconds(snapshot?.fatigueCooldownSeconds)}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[30px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Trophy className="h-4 w-4 text-accent" />
                  Why players can trust it
                </div>

                <div className="space-y-4 text-sm leading-7 text-foreground/66">
                  <p>
                    Warpool is designed so the important actions happen through
                    contracts and automated worker flows, not through manual admin action.
                  </p>

                  <p>
                    Entries, reservations, battle settlement, payout handling,
                    capture processing, and marketplace relisting all follow the
                    live rules set by the system configuration.
                  </p>

                  <p>
                    If those rules are changed through governance, this page updates
                    automatically because the config panels below are read from the
                    latest database snapshot.
                  </p>
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-[30px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Coins className="h-4 w-4 text-accent" />
                  Queue lineup
                </div>

                <div className="space-y-3">
                  {queues.map((queue) => (
                    <div
                      key={queue.slug}
                      className="rounded-3xl border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {queue.title}
                          </div>
                          <div className="mt-1 text-xs text-foreground/52">
                            {queueTierLabel(queue.tier)} · {queueModeLabel(queue.mode)}
                          </div>
                        </div>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                            queue.enabled
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                              : "border-border bg-background text-foreground/60"
                          }`}
                        >
                          {queue.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                            Entry stake
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            {formatCompactAmount(queue.stakeAmount)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                            Open duration
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            {humanizeSeconds(queue.openDurationSeconds)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                            Bracket size
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            {queue.targetSize}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                            Minimum start
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            {queue.minStartSize}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                            Platform fee
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            {formatPercentFromBps(queue.platformFeeBps)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                            Single entry per wallet
                          </div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            {queue.singleEntryPerWallet ? "Yes" : "No"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-border bg-background px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                          Payout split
                        </div>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          1st {formatPercentFromBps(queue.firstPlaceBps)} · 2nd{" "}
                          {formatPercentFromBps(queue.secondPlaceBps)} · 3rd{" "}
                          {formatPercentFromBps(queue.thirdPlaceBps)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[30px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Swords className="h-4 w-4 text-accent" />
                  Battle engine config
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-border bg-card p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                      Rounds per match
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {snapshot?.roundsPerMatch ?? "—"}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-card p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                      Trait power band
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {snapshot?.traitPowerMin ?? "—"} to {snapshot?.traitPowerMax ?? "—"}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-card p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                      Round variance max
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {snapshot?.roundVarianceMax ?? "—"}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-card p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                      Micro momentum max
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {snapshot?.microMomentumMax ?? "—"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[30px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Link2 className="h-4 w-4 text-accent" />
                  Contracts
                </div>

                <div className="space-y-3">
                  {contracts.length === 0 ? (
                    <div className="rounded-3xl border border-border bg-card p-4 text-sm text-foreground/60">
                      No active Warpool contracts found in the database yet.
                    </div>
                  ) : (
                    contracts.map((contract) => (
                      <div
                        key={`${contract.kind}-${contract.address}`}
                        className="rounded-3xl border border-border bg-card p-4"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {contract.label}
                        </div>
                        <div className="mt-2 break-all text-xs text-foreground/55">
                          {contract.address}
                        </div>

                        {contract.href ? (
                          <a
                            href={contract.href}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/78 transition hover:bg-card"
                          >
                            View on explorer
                            <ArrowRight className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}