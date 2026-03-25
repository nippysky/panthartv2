"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gem, Swords, TimerReset } from "lucide-react";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";

type ProposalStatus =
  | "DRAFT"
  | "READY"
  | "SUBMITTED"
  | "APPROVED"
  | "EXECUTED"
  | "CANCELLED"
  | "FAILED";

type Props = {
  adminSlug: string;
  proposalId: string;
  proposalStatus: ProposalStatus;
  submittedMultisigTxId: string | null;
  actionCount: number;
  submittedActionCount: number;
  approvedActionCount: number;
  executedActionCount: number;
  createdByAddress: string | null;
  snapshotJson?: unknown;
  actions?: Array<{
    functionName?: string | null;
  }>;
};

type UiState =
  | { kind: "idle"; message: null }
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const STEPS: ProposalStatus[] = ["DRAFT", "READY", "SUBMITTED", "APPROVED", "EXECUTED"];

function normalizeAddress(value: string | null | undefined) {
  const next = String(value ?? "").trim().toLowerCase();
  return next || null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getFunctionNames(
  actions: Array<{ functionName?: string | null }> | undefined,
  snapshotJson: unknown
) {
  if (actions && actions.length > 0) {
    return actions
      .map((action) => action.functionName ?? null)
      .filter((value): value is string => !!value);
  }

  if (!isPlainObject(snapshotJson)) return [];
  const rawActions = snapshotJson.actions;
  if (!Array.isArray(rawActions)) return [];

  return rawActions
    .map((action) =>
      isPlainObject(action) && typeof action.functionName === "string"
        ? action.functionName
        : null
    )
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

function StepPill({
  label,
  tone,
}: {
  label: string;
  tone: "current" | "complete" | "upcoming" | "danger";
}) {
  const className =
    tone === "current"
      ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
      : tone === "complete"
        ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
        : tone === "danger"
          ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
          : "border-border bg-background text-muted";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      {label}
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
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
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
    <div className="min-w-23 flex-1 rounded-2xl border border-border bg-card px-3 py-3 sm:min-w-25 sm:flex-none">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="mt-2 wrap-break-word text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

function getProgressHeadline(params: {
  proposalStatus: ProposalStatus;
  actionCount: number;
  submittedActionCount: number;
  approvedActionCount: number;
  executedActionCount: number;
}) {
  const {
    proposalStatus,
    actionCount,
    submittedActionCount,
    approvedActionCount,
    executedActionCount,
  } = params;

  if (proposalStatus === "FAILED") return "This proposal hit a failure state and needs review.";
  if (proposalStatus === "CANCELLED") return "This proposal has been cancelled and will not continue.";
  if (proposalStatus === "DRAFT") return "Draft mode. You can still edit or cancel this proposal.";
  if (proposalStatus === "READY") return "Ready for multisig submission. Nothing has gone on-chain yet.";
  if (proposalStatus === "SUBMITTED") {
    return `${submittedActionCount}/${actionCount} action${actionCount === 1 ? "" : "s"} submitted. Waiting for approvals.`;
  }
  if (proposalStatus === "APPROVED") {
    return `${approvedActionCount}/${actionCount} action${actionCount === 1 ? "" : "s"} approved. Execution can begin.`;
  }
  if (proposalStatus === "EXECUTED") {
    return `${executedActionCount}/${actionCount} action${actionCount === 1 ? "" : "s"} executed successfully.`;
  }

  return "Proposal workflow is active.";
}

function getStepTone(step: ProposalStatus, current: ProposalStatus) {
  if (current === "FAILED" || current === "CANCELLED") {
    return step === current ? "danger" : "upcoming";
  }

  const currentIndex = STEPS.indexOf(current);
  const stepIndex = STEPS.indexOf(step);

  if (stepIndex < currentIndex) return "complete";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export default function WarpoolProposalWorkflowPanel({
  proposalId,
  proposalStatus,
  submittedMultisigTxId,
  actionCount,
  submittedActionCount,
  approvedActionCount,
  executedActionCount,
  createdByAddress,
  snapshotJson,
  actions,
}: Props) {
  const router = useRouter();
  const { address } = useDecentWalletAccount();

  const [state, setState] = React.useState<UiState>({
    kind: "idle",
    message: null,
  });

  const normalizedWallet = normalizeAddress(address);
  const normalizedCreator = normalizeAddress(createdByAddress);
  const hasWallet = !!normalizedWallet;
  const looksLikeCreator =
    !!normalizedWallet && !!normalizedCreator && normalizedWallet === normalizedCreator;

  const functionNames = React.useMemo(
    () => getFunctionNames(actions, snapshotJson),
    [actions, snapshotJson]
  );

  const hasBattleAction = functionNames.includes("setBattleConfig");
  const hasQueueAction = functionNames.includes("setQueueConfig");
  const hasRelicAction = functionNames.includes("setRelicConfig");
  const hasFatigueAction = functionNames.includes("setFatigueConfig");
  const hasGlobalAction =
    functionNames.includes("setGlobalFlags") ||
    functionNames.includes("setPauseFlags") ||
    functionNames.includes("setTreasury") ||
    functionNames.includes("setWorkerOperator");

  const battlePreview = React.useMemo(
    () => getBattlePreview(snapshotJson),
    [snapshotJson]
  );

  const relicPreview = React.useMemo(
    () => getRelicPreview(snapshotJson),
    [snapshotJson]
  );

  const fatiguePreview = React.useMemo(
    () => getFatiguePreview(snapshotJson),
    [snapshotJson]
  );

  async function patchProposal(body: Record<string, unknown>, successMessage: string) {
    try {
      setState({
        kind: "loading",
        message: "Updating proposal workflow...",
      });

      const res = await fetch(`/api/admin/warpool/proposals/${proposalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...body,
          actorAddress: address ?? null,
        }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to update proposal.");
      }

      setState({
        kind: "success",
        message: successMessage,
      });

      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to update proposal.",
      });
    }
  }

  const canMoveToDraft = hasWallet && (proposalStatus === "READY" || proposalStatus === "SUBMITTED");
  const canMarkReady = hasWallet && proposalStatus === "DRAFT";
  const canCancel =
    hasWallet &&
    (proposalStatus === "DRAFT" ||
      proposalStatus === "READY" ||
      proposalStatus === "SUBMITTED" ||
      proposalStatus === "APPROVED");

  const progressHeadline = getProgressHeadline({
    proposalStatus,
    actionCount,
    submittedActionCount,
    approvedActionCount,
    executedActionCount,
  });

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
          Proposal workflow
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Keep this proposal moving through a clean shared governance flow.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((step) => (
          <StepPill key={step} label={step} tone={getStepTone(step, proposalStatus)} />
        ))}
        {proposalStatus === "FAILED" ? <StepPill label="FAILED" tone="danger" /> : null}
        {proposalStatus === "CANCELLED" ? <StepPill label="CANCELLED" tone="danger" /> : null}
      </div>

      {(hasBattleAction ||
        hasQueueAction ||
        hasRelicAction ||
        hasFatigueAction ||
        hasGlobalAction) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {hasBattleAction ? <SmallPill tone="battle">Battle Config</SmallPill> : null}
          {hasQueueAction ? <SmallPill tone="config">Queue Config</SmallPill> : null}
          {hasRelicAction ? <SmallPill tone="relic">Relic Config</SmallPill> : null}
          {hasFatigueAction ? <SmallPill tone="fatigue">Fatigue Config</SmallPill> : null}
          {hasGlobalAction ? <SmallPill tone="config">Global Config</SmallPill> : null}
        </div>
      )}

      <div className="mt-5 rounded-3xl border border-border bg-background/60 p-4 text-sm text-muted">
        <span className="font-medium text-foreground">{progressHeadline}</span>
        {submittedMultisigTxId ? (
          <>
            {" "}
            Linked tx record:{" "}
            <span className="break-all font-medium text-foreground">{submittedMultisigTxId}</span>
          </>
        ) : null}
      </div>

      {(hasBattleAction && battlePreview) ||
      (hasRelicAction && relicPreview) ||
      (hasFatigueAction && fatiguePreview) ? (
        <div className="mt-5 grid gap-4">
          {hasBattleAction && battlePreview ? (
            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Swords className="h-4 w-4 text-accent" />
                Battle simulation preview
              </div>

              <div className="flex flex-wrap gap-3">
                <PreviewMetric label="Rounds" value={battlePreview.rounds ?? "—"} />
                <PreviewMetric label="Trait Min" value={battlePreview.traitMin ?? "—"} />
                <PreviewMetric label="Trait Max" value={battlePreview.traitMax ?? "—"} />
                <PreviewMetric label="Variance" value={battlePreview.variance ?? "—"} />
                <PreviewMetric label="Momentum" value={battlePreview.momentum ?? "—"} />
              </div>
            </div>
          ) : null}

          {hasRelicAction && relicPreview ? (
            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Gem className="h-4 w-4 text-fuchsia-500" />
                Relic config preview
              </div>

              <div className="flex flex-wrap gap-3">
                <PreviewMetric label="Min BPS" value={relicPreview.minDiscountBps ?? "—"} />
                <PreviewMetric label="Max BPS" value={relicPreview.maxDiscountBps ?? "—"} />
                <PreviewMetric label="Discount Seats" value={relicPreview.discountSeatCap ?? "—"} />
                <PreviewMetric label="Token11 Seats" value={relicPreview.token11SeatCap ?? "—"} />
                <PreviewMetric
                  label="TTL"
                  value={`${relicPreview.reservationTtlSeconds ?? "—"}s`}
                />
              </div>
            </div>
          ) : null}

          {hasFatigueAction && fatiguePreview ? (
            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <TimerReset className="h-4 w-4 text-amber-500" />
                Fatigue config preview
              </div>

              <div className="flex flex-wrap gap-3">
                <PreviewMetric
                  label="Max Consecutive"
                  value={fatiguePreview.maxConsecutiveEntries ?? "—"}
                />
                <PreviewMetric
                  label="Cooldown"
                  value={`${fatiguePreview.cooldownSeconds ?? "—"}s`}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total actions" value={actionCount} />
        <StatCard
          label="Submitted actions"
          value={submittedActionCount}
          hint={actionCount > 0 ? `${submittedActionCount}/${actionCount}` : undefined}
        />
        <StatCard
          label="Approved actions"
          value={approvedActionCount}
          hint={actionCount > 0 ? `${approvedActionCount}/${actionCount}` : undefined}
        />
        <StatCard
          label="Executed actions"
          value={executedActionCount}
          hint={actionCount > 0 ? `${executedActionCount}/${actionCount}` : undefined}
        />
      </div>

      {state.message ? (
        <div
          className={[
            "mt-5 rounded-3xl border p-4 text-sm",
            state.kind === "error"
              ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : state.kind === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border bg-background/70 text-foreground",
          ].join(" ")}
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-5 rounded-3xl border border-border bg-background/60 p-4 text-sm text-muted">
        {!hasWallet
          ? "Connect the creator wallet to manage draft and ready workflow states."
          : looksLikeCreator
            ? "Creator wallet detected."
            : "Server-side creator validation will decide whether this wallet can edit workflow state."}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canMoveToDraft || state.kind === "loading"}
          onClick={() =>
            void patchProposal(
              { status: "DRAFT", note: "Moved proposal back to draft." },
              "Proposal moved back to draft."
            )
          }
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          Move back to draft
        </button>

        <button
          type="button"
          disabled={!canMarkReady || state.kind === "loading"}
          onClick={() =>
            void patchProposal(
              { status: "READY", note: "Proposal marked ready for multisig submission." },
              "Proposal marked ready."
            )
          }
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mark ready
        </button>

        <button
          type="button"
          disabled={!canCancel || state.kind === "loading"}
          onClick={() =>
            void patchProposal(
              { status: "CANCELLED", note: "Proposal cancelled." },
              "Proposal cancelled."
            )
          }
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel proposal
        </button>
      </div>
    </section>
  );
}