"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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

function getProgressHeadline(params: {
  proposalStatus: ProposalStatus;
  actionCount: number;
  submittedActionCount: number;
  approvedActionCount: number;
  executedActionCount: number;
}) {
  const { proposalStatus, actionCount, submittedActionCount, approvedActionCount, executedActionCount } =
    params;

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

      <div className="mt-5 rounded-3xl border border-border bg-background/60 p-4 text-sm text-muted">
        <span className="font-medium text-foreground">{progressHeadline}</span>
        {submittedMultisigTxId ? (
          <>
            {" "}
            Linked tx record:{" "}
            <span className="font-medium text-foreground">{submittedMultisigTxId}</span>
          </>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total actions" value={actionCount} />
        <StatCard label="Submitted actions" value={submittedActionCount} hint={actionCount > 0 ? `${submittedActionCount}/${actionCount}` : undefined} />
        <StatCard label="Approved actions" value={approvedActionCount} hint={actionCount > 0 ? `${approvedActionCount}/${actionCount}` : undefined} />
        <StatCard label="Executed actions" value={executedActionCount} hint={actionCount > 0 ? `${executedActionCount}/${actionCount}` : undefined} />
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
              { status: "CANCELLED", note: "Proposal cancelled by admin." },
              "Proposal cancelled."
            )
          }
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}