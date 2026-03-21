"use client";

import {
  formatBool,
  shortenAddress,
  WARPOOL_QUEUE_META,
} from "@/src/features/admin/warpool/constants";
import type {
  WarpoolAdminConfigSnapshot,
  WarpoolAdminQueueCard,
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
  WarpoolWorkerReadinessData,
} from "@/src/features/admin/warpool/types";
import type { WarpoolRuntimeQueueStatus } from "@/src/features/admin/warpool/runtime-queries";

type Props = {
  configAddress: string | null;
  coreAddress: string | null;
  lensAddress: string | null;
  latestConfigSnapshot: WarpoolAdminConfigSnapshot | null;
  queueCards: WarpoolAdminQueueCard[];
  runtimeQueues: WarpoolRuntimeQueueStatus[];
  multisigSummary: WarpoolMultisigSummary | null;
  multisigResolutionSource: WarpoolMultisigResolutionSource | null;
  workerReadiness: WarpoolWorkerReadinessData;
};

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
          : "border-border bg-background text-muted";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}
    >
      {children}
    </span>
  );
}

function CheckRow({
  label,
  ok,
  value,
  hint,
}: {
  label: string;
  ok: boolean;
  value?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{label}</div>
          {hint ? <div className="mt-1 text-xs leading-5 text-muted">{hint}</div> : null}
        </div>

        <StatusPill tone={ok ? "good" : "warn"}>{ok ? "Ready" : "Needs attention"}</StatusPill>
      </div>

      {value ? <div className="mt-3 text-sm text-muted">{value}</div> : null}
    </div>
  );
}

function queueStateLabel(state: number | null) {
  switch (state) {
    case 1:
      return "Open";
    case 2:
      return "Locked";
    case 3:
      return "Battle Ready";
    case 4:
      return "Settling";
    case 5:
      return "Settled";
    case 6:
      return "Closed";
    case 7:
      return "Expired Refunded";
    default:
      return "Idle";
  }
}

function overallReadiness(params: {
  configAddress: string | null;
  coreAddress: string | null;
  lensAddress: string | null;
  latestConfigSnapshot: WarpoolAdminConfigSnapshot | null;
  queueCards: WarpoolAdminQueueCard[];
  runtimeQueues: WarpoolRuntimeQueueStatus[];
  multisigSummary: WarpoolMultisigSummary | null;
}) {
  const hasContracts = !!params.configAddress && !!params.coreAddress && !!params.lensAddress;
  const hasSnapshot = !!params.latestConfigSnapshot;
  const hasMultisig = !!params.multisigSummary?.contract;
  const hasTreasury = !!params.latestConfigSnapshot?.treasury;
  const hasWorker = !!params.latestConfigSnapshot?.workerOperator;
  const anyQueueEnabled = params.queueCards.some((q) => q.enabled);
  const anyPoolOpen = params.runtimeQueues.some((q) => q.poolId && q.state === 1);
  const paused =
    !!params.latestConfigSnapshot?.entriesPaused ||
    !!params.latestConfigSnapshot?.reservationsPaused ||
    !!params.latestConfigSnapshot?.settlementsPaused;

  if (!hasContracts || !hasSnapshot) {
    return {
      label: "Needs configuration",
      tone: "warn" as const,
      text: "Warpool contracts or indexed config snapshot are still incomplete.",
    };
  }

  if (!hasMultisig) {
    return {
      label: "Needs multisig setup",
      tone: "warn" as const,
      text: "The config owner or latest registered safe could not be resolved cleanly.",
    };
  }

  if (!hasTreasury || !hasWorker) {
    return {
      label: "Needs addresses",
      tone: "warn" as const,
      text: "Treasury or worker operator is not configured yet.",
    };
  }

  if (!anyQueueEnabled) {
    return {
      label: "Needs queue enablement",
      tone: "warn" as const,
      text: "No queue is enabled yet, so no live pool can be opened.",
    };
  }

  if (paused) {
    return {
      label: "Blocked by pause flags",
      tone: "bad" as const,
      text: "One or more critical gameplay flows are paused.",
    };
  }

  if (!anyPoolOpen) {
    return {
      label: "Ready to open pools",
      tone: "warn" as const,
      text: "Configuration looks healthy, but there is no currently open live pool.",
    };
  }

  return {
    label: "Ready for testing",
    tone: "good" as const,
    text: "Warpool has live queue configuration and at least one open pool.",
  };
}

export default function WarpoolGameReadiness({
  configAddress,
  coreAddress,
  lensAddress,
  latestConfigSnapshot,
  queueCards,
  runtimeQueues,
  multisigSummary,
  multisigResolutionSource,
  workerReadiness,
}: Props) {
  const readiness = overallReadiness({
    configAddress,
    coreAddress,
    lensAddress,
    latestConfigSnapshot,
    queueCards,
    runtimeQueues,
    multisigSummary,
  });

  const enabledQueues = queueCards.filter((queue) => queue.enabled);
  const activeQueues = runtimeQueues.filter((queue) => !!queue.poolId);
  const multisigSourceText =
    multisigResolutionSource === "CONFIG_OWNER_MATCH"
      ? "Resolved from config owner"
      : multisigResolutionSource === "CONFIG_OWNER_UNREGISTERED"
        ? "Owner found on-chain but not registered locally"
        : multisigResolutionSource === "LATEST_REGISTERED_FALLBACK"
          ? "Using latest registered fallback"
          : "Unavailable";

  return (
    <SectionCard
      title="Game Readiness"
      description="A straight answer on whether Warpool is ready to be tested, and what still needs attention."
    >
      <div className="flex flex-col gap-4 rounded-[28px] border border-border bg-background/70 p-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Overall status</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{readiness.text}</p>
        </div>

        <StatusPill tone={readiness.tone}>{readiness.label}</StatusPill>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CheckRow
          label="Contracts registered"
          ok={!!configAddress && !!coreAddress && !!lensAddress}
          value={`Config ${configAddress ? "present" : "missing"} · Core ${
            coreAddress ? "present" : "missing"
          } · Lens ${lensAddress ? "present" : "missing"}`}
        />

        <CheckRow
          label="Multisig resolved"
          ok={!!multisigSummary?.contract}
          value={
            multisigSummary?.contract
              ? `${shortenAddress(multisigSummary.contract)} · threshold ${multisigSummary.threshold} of ${multisigSummary.ownersCount}`
              : multisigSourceText
          }
        />

        <CheckRow
          label="Treasury configured"
          ok={!!latestConfigSnapshot?.treasury}
          value={latestConfigSnapshot?.treasury ? shortenAddress(latestConfigSnapshot.treasury) : "Missing"}
        />

        <CheckRow
          label="Worker operator configured"
          ok={!!latestConfigSnapshot?.workerOperator}
          value={
            latestConfigSnapshot?.workerOperator
              ? shortenAddress(latestConfigSnapshot.workerOperator)
              : "Missing"
          }
        />

        <CheckRow
          label="Queues enabled"
          ok={enabledQueues.length > 0}
          value={
            enabledQueues.length > 0
              ? enabledQueues.map((queue) => WARPOOL_QUEUE_META[queue.slug].title).join(" · ")
              : "No queue is enabled yet"
          }
        />

        <CheckRow
          label="Live pool availability"
          ok={activeQueues.length > 0}
          value={
            activeQueues.length > 0
              ? activeQueues
                  .map((queue) => `${WARPOOL_QUEUE_META[queue.slug].title} (${queueStateLabel(queue.state)})`)
                  .join(" · ")
              : "No queue currently has an active pool"
          }
        />

        <CheckRow
          label="Entries flow"
          ok={!latestConfigSnapshot?.entriesPaused}
          value={latestConfigSnapshot ? formatBool(!latestConfigSnapshot.entriesPaused) : "Unknown"}
          hint="Players cannot join queues while entries are paused."
        />

        <CheckRow
          label="Reservations flow"
          ok={!latestConfigSnapshot?.reservationsPaused}
          value={latestConfigSnapshot ? formatBool(!latestConfigSnapshot.reservationsPaused) : "Unknown"}
          hint="Relic reservation flow is blocked while reservations are paused."
        />

        <CheckRow
          label="Settlements flow"
          ok={!latestConfigSnapshot?.settlementsPaused}
          value={latestConfigSnapshot ? formatBool(!latestConfigSnapshot.settlementsPaused) : "Unknown"}
          hint="Pool finalization is blocked while settlements are paused."
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-border bg-background/60 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Enabled queues</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {enabledQueues.length}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background/60 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Active queues</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {activeQueues.length}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background/60 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Action candidates</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {workerReadiness.expiredOpenPools.length +
              workerReadiness.battleReadyCandidates.length +
              workerReadiness.settlementCandidates.length +
              workerReadiness.expiredReservations.length}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background/60 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Config version</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {latestConfigSnapshot?.configVersion?.toString() ?? "—"}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}