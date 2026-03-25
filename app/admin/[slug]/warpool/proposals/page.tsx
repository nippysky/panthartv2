import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Gem,
  Swords,
  TimerReset,
} from "lucide-react";

import { listWarpoolAdminProposals } from "@/src/features/admin/warpool/proposal-queries";
import { shortenAddress } from "@/src/features/admin/warpool/constants";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function StatusPill({
  status,
}: {
  status:
    | "DRAFT"
    | "READY"
    | "SUBMITTED"
    | "APPROVED"
    | "EXECUTED"
    | "CANCELLED"
    | "FAILED";
}) {
  const className =
    status === "EXECUTED"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : status === "SUBMITTED" || status === "APPROVED"
        ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
        : status === "READY"
          ? "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400"
          : status === "FAILED" || status === "CANCELLED"
            ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "border-border bg-background text-muted";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {status}
    </span>
  );
}

function SmallPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "battle" | "config" | "relic" | "fatigue";
}) {
  const className =
    tone === "battle"
      ? "border-accent/20 bg-accent/10 text-accent"
      : tone === "config"
        ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
        : tone === "relic"
          ? "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
          : tone === "fatigue"
            ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-border bg-background text-muted";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-22 flex-1 rounded-2xl border border-border bg-card px-3 py-3 sm:min-w-24 sm:flex-none">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getActionNames(
  actions:
    | Array<{
        functionName?: string | null;
      }>
    | undefined
) {
  if (!actions) return [];

  return actions
    .map((action) => action.functionName ?? null)
    .filter((value): value is string => !!value);
}

function getBattlePreview(snapshotJson: unknown) {
  if (!isPlainObject(snapshotJson)) return null;

  const global = isPlainObject(snapshotJson.global) ? snapshotJson.global : null;
  const battle = global && isPlainObject(global.battle) ? global.battle : null;
  if (!battle) return null;

  const rounds =
    typeof battle.roundsPerMatch === "number" ? battle.roundsPerMatch : null;
  const traitMin =
    typeof battle.traitPowerMin === "number" ? battle.traitPowerMin : null;
  const traitMax =
    typeof battle.traitPowerMax === "number" ? battle.traitPowerMax : null;
  const variance =
    typeof battle.roundVarianceMax === "number" ? battle.roundVarianceMax : null;
  const momentum =
    typeof battle.microMomentumMax === "number" ? battle.microMomentumMax : null;

  if (
    rounds == null &&
    traitMin == null &&
    traitMax == null &&
    variance == null &&
    momentum == null
  ) {
    return null;
  }

  return {
    rounds,
    traitMin,
    traitMax,
    variance,
    momentum,
  };
}

function getRelicPreview(snapshotJson: unknown) {
  if (!isPlainObject(snapshotJson)) return null;

  const global = isPlainObject(snapshotJson.global) ? snapshotJson.global : null;
  const relic = global && isPlainObject(global.relic) ? global.relic : null;
  if (!relic) return null;

  const minDiscountBps =
    typeof relic.minDiscountBps === "number" ? relic.minDiscountBps : null;
  const maxDiscountBps =
    typeof relic.maxDiscountBps === "number" ? relic.maxDiscountBps : null;
  const discountSeatCap =
    typeof relic.discountSeatCap === "number" ? relic.discountSeatCap : null;
  const token11SeatCap =
    typeof relic.token11SeatCap === "number" ? relic.token11SeatCap : null;
  const reservationTtlSeconds =
    typeof relic.reservationTtlSeconds === "number"
      ? relic.reservationTtlSeconds
      : null;

  if (
    minDiscountBps == null &&
    maxDiscountBps == null &&
    discountSeatCap == null &&
    token11SeatCap == null &&
    reservationTtlSeconds == null
  ) {
    return null;
  }

  return {
    minDiscountBps,
    maxDiscountBps,
    discountSeatCap,
    token11SeatCap,
    reservationTtlSeconds,
  };
}

function getFatiguePreview(snapshotJson: unknown) {
  if (!isPlainObject(snapshotJson)) return null;

  const global = isPlainObject(snapshotJson.global) ? snapshotJson.global : null;
  const fatigue = global && isPlainObject(global.fatigue) ? global.fatigue : null;
  if (!fatigue) return null;

  const maxConsecutiveEntries =
    typeof fatigue.maxConsecutiveEntries === "number"
      ? fatigue.maxConsecutiveEntries
      : null;
  const cooldownSeconds =
    typeof fatigue.cooldownSeconds === "number" ? fatigue.cooldownSeconds : null;

  if (maxConsecutiveEntries == null && cooldownSeconds == null) {
    return null;
  }

  return {
    maxConsecutiveEntries,
    cooldownSeconds,
  };
}

function proposalSignals(params: {
  actions?: Array<{
    functionName?: string | null;
  }>;
  snapshotJson: unknown;
}) {
  const actionNames = getActionNames(params.actions);
  const hasBattleAction = actionNames.includes("setBattleConfig");
  const hasQueueAction = actionNames.includes("setQueueConfig");
  const hasRelicAction = actionNames.includes("setRelicConfig");
  const hasFatigueAction = actionNames.includes("setFatigueConfig");
  const hasGlobalAction =
    actionNames.includes("setGlobalFlags") ||
    actionNames.includes("setPauseFlags") ||
    actionNames.includes("setTreasury") ||
    actionNames.includes("setWorkerOperator");

  return {
    hasBattleAction,
    hasQueueAction,
    hasRelicAction,
    hasFatigueAction,
    hasGlobalAction,
    battlePreview: getBattlePreview(params.snapshotJson),
    relicPreview: getRelicPreview(params.snapshotJson),
    fatiguePreview: getFatiguePreview(params.snapshotJson),
  };
}

export default async function WarpoolProposalsPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const proposals = await listWarpoolAdminProposals();

  const stats = {
    total: proposals.length,
    draft: proposals.filter((proposal) => proposal.status === "DRAFT").length,
    ready: proposals.filter((proposal) => proposal.status === "READY").length,
    submitted: proposals.filter(
      (proposal) =>
        proposal.status === "SUBMITTED" || proposal.status === "APPROVED"
    ).length,
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-[28px] border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Warpool Proposals
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Stored Admin Proposals
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              Review saved config proposals, monitor their lifecycle, and continue
              shared multisig workflow without rebuilding payloads.
            </p>
          </div>

          <Link
            href={`/admin/${slug}/warpool/config`}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Create proposal from config
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Draft" value={stats.draft} />
        <StatCard label="Ready" value={stats.ready} />
        <StatCard label="Submitted" value={stats.submitted} />
      </div>

      {proposals.length > 0 ? (
        <div className="grid gap-4">
          {proposals.map((proposal) => {
            const signals = proposalSignals({
              actions: proposal.actions,
              snapshotJson: proposal.snapshotJson,
            });

            return (
              <Link
                key={proposal.id}
                href={`/admin/${slug}/warpool/proposals/${proposal.id}`}
                className="rounded-[28px] border border-border bg-card p-5 transition hover:bg-background/40 md:p-6"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={proposal.status} />
                      <SmallPill>{proposal.kind}</SmallPill>

                      {proposal.submittedMultisigNonce !== null ? (
                        <SmallPill>Nonce {String(proposal.submittedMultisigNonce)}</SmallPill>
                      ) : null}

                      {signals.hasBattleAction ? (
                        <SmallPill tone="battle">Battle Config</SmallPill>
                      ) : null}

                      {signals.hasQueueAction ? (
                        <SmallPill tone="config">Queue Config</SmallPill>
                      ) : null}

                      {signals.hasRelicAction ? (
                        <SmallPill tone="relic">Relic Config</SmallPill>
                      ) : null}

                      {signals.hasFatigueAction ? (
                        <SmallPill tone="fatigue">Fatigue Config</SmallPill>
                      ) : null}

                      {signals.hasGlobalAction ? (
                        <SmallPill tone="config">Global Config</SmallPill>
                      ) : null}
                    </div>

                    <div className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                      {proposal.title}
                    </div>

                    {proposal.summary ? (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                        {proposal.summary}
                      </p>
                    ) : null}

                    {(signals.hasBattleAction && signals.battlePreview) ||
                    (signals.hasRelicAction && signals.relicPreview) ||
                    (signals.hasFatigueAction && signals.fatiguePreview) ? (
                      <div className="mt-4 grid gap-4 xl:grid-cols-3">
                        {signals.hasBattleAction && signals.battlePreview ? (
                          <div className="rounded-3xl border border-border bg-background/60 p-4 xl:col-span-2">
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                              <Swords className="h-4 w-4 text-accent" />
                              Battle simulation preview
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <PreviewMetric
                                label="Rounds"
                                value={signals.battlePreview.rounds ?? "—"}
                              />
                              <PreviewMetric
                                label="Trait Min"
                                value={signals.battlePreview.traitMin ?? "—"}
                              />
                              <PreviewMetric
                                label="Trait Max"
                                value={signals.battlePreview.traitMax ?? "—"}
                              />
                              <PreviewMetric
                                label="Variance"
                                value={signals.battlePreview.variance ?? "—"}
                              />
                              <PreviewMetric
                                label="Momentum"
                                value={signals.battlePreview.momentum ?? "—"}
                              />
                            </div>
                          </div>
                        ) : null}

                        {signals.hasRelicAction && signals.relicPreview ? (
                          <div className="rounded-3xl border border-border bg-background/60 p-4 xl:col-span-2">
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                              <Gem className="h-4 w-4 text-fuchsia-500" />
                              Relic config preview
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <PreviewMetric
                                label="Min BPS"
                                value={signals.relicPreview.minDiscountBps ?? "—"}
                              />
                              <PreviewMetric
                                label="Max BPS"
                                value={signals.relicPreview.maxDiscountBps ?? "—"}
                              />
                              <PreviewMetric
                                label="Discount Seats"
                                value={signals.relicPreview.discountSeatCap ?? "—"}
                              />
                              <PreviewMetric
                                label="Token11 Seats"
                                value={signals.relicPreview.token11SeatCap ?? "—"}
                              />
                              <PreviewMetric
                                label="TTL"
                                value={`${signals.relicPreview.reservationTtlSeconds ?? "—"}s`}
                              />
                            </div>
                          </div>
                        ) : null}

                        {signals.hasFatigueAction && signals.fatiguePreview ? (
                          <div className="rounded-3xl border border-border bg-background/60 p-4">
                            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                              <TimerReset className="h-4 w-4 text-amber-500" />
                              Fatigue config preview
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <PreviewMetric
                                label="Max Consecutive"
                                value={signals.fatiguePreview.maxConsecutiveEntries ?? "—"}
                              />
                              <PreviewMetric
                                label="Cooldown"
                                value={`${signals.fatiguePreview.cooldownSeconds ?? "—"}s`}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard label="Actions" value={proposal.actionCount} />
                      <StatCard
                        label="Submitted"
                        value={proposal.submittedActionCount}
                      />
                      <StatCard
                        label="Approved"
                        value={proposal.approvedActionCount}
                      />
                      <StatCard
                        label="Executed"
                        value={proposal.executedActionCount}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-3xl border border-border bg-background/60 p-4 text-sm text-muted xl:min-w-70">
                    <div className="flex items-start justify-between gap-4">
                      <span>Safe</span>
                      <span className="text-right font-medium text-foreground">
                        {shortenAddress(proposal.safeContract)}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <span>Created by</span>
                      <span className="text-right font-medium text-foreground">
                        {shortenAddress(proposal.createdByAddress)}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <span>Created</span>
                      <span className="text-right font-medium text-foreground">
                        {formatDate(proposal.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <span>Updated</span>
                      <span className="text-right font-medium text-foreground">
                        {formatDate(proposal.updatedAt)}
                      </span>
                    </div>

                    {proposal.basedOnConfigVersion ? (
                      <div className="flex items-start justify-between gap-4">
                        <span>Config ver.</span>
                        <span className="text-right font-medium text-foreground">
                          {proposal.basedOnConfigVersion}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-border bg-card p-10 text-center">
          <div className="text-base font-semibold text-foreground">
            No saved Warpool proposals yet
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted">
            Start from the config page, prepare a clean proposal, and save it into the
            shared admin workflow so other multisig owners can review and continue it.
          </p>

          <div className="mt-6">
            <Link
              href={`/admin/${slug}/warpool/config`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90"
            >
              Open config page
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}