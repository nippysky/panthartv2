"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Props = {
  proposalId: string;
  proposalStatus:
    | "DRAFT"
    | "READY"
    | "SUBMITTED"
    | "APPROVED"
    | "EXECUTED"
    | "CANCELLED"
    | "FAILED";
  submittedMultisigTxId: string | null;
  actionCount: number;
  submittedActionCount: number;
  approvedActionCount: number;
  executedActionCount: number;
};

type ActionState =
  | { kind: "idle"; message: null }
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function StepPill({
  label,
  active,
  complete,
}: {
  label: string;
  active?: boolean;
  complete?: boolean;
}) {
  const className = complete
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : active
      ? "border-foreground/20 bg-foreground/10 text-foreground"
      : "border-border bg-background text-muted";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${className}`}
    >
      {label}
    </span>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
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

export default function WarpoolProposalWorkflowPanel({
  proposalId,
  proposalStatus,
  submittedMultisigTxId,
  actionCount,
  submittedActionCount,
  approvedActionCount,
  executedActionCount,
}: Props) {
  const router = useRouter();

  const [state, setState] = React.useState<ActionState>({
    kind: "idle",
    message: null,
  });

  const isDraft = proposalStatus === "DRAFT";
  const isReady = proposalStatus === "READY";
  const isSubmitted = proposalStatus === "SUBMITTED";
  const isApproved = proposalStatus === "APPROVED";
  const isExecuted = proposalStatus === "EXECUTED";

  async function patchProposal(body: Record<string, unknown>, successMessage: string) {
    try {
      setState({
        kind: "loading",
        message: "Updating proposal...",
      });

      const res = await fetch(`/api/admin/warpool/proposals/${proposalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
        <StepPill label="Draft" active={isDraft} complete={!isDraft} />
        <StepPill
          label="Ready"
          active={isReady}
          complete={isSubmitted || isApproved || isExecuted}
        />
        <StepPill
          label="Submitted"
          active={isSubmitted}
          complete={isApproved || isExecuted}
        />
        <StepPill label="Approved" active={isApproved} complete={isExecuted} />
        <StepPill label="Executed" active={isExecuted} complete={isExecuted} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SmallStat label="Total actions" value={actionCount} />
        <SmallStat label="Submitted actions" value={submittedActionCount} />
        <SmallStat label="Approved actions" value={approvedActionCount} />
        <SmallStat label="Executed actions" value={executedActionCount} />
      </div>

      {submittedMultisigTxId ? (
        <div className="mt-5 rounded-3xl border border-border bg-background/70 p-4 text-sm text-muted">
          Linked multisig tx:
          <span className="ml-2 font-medium text-foreground">{submittedMultisigTxId}</span>
        </div>
      ) : null}

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

      <div className="mt-5 flex flex-wrap gap-2">
        {proposalStatus === "DRAFT" ? (
          <button
            type="button"
            onClick={() =>
              void patchProposal(
                { status: "READY" },
                "Proposal marked ready for multisig submission."
              )
            }
            disabled={state.kind === "loading"}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Mark ready
          </button>
        ) : null}

        {(proposalStatus === "READY" || proposalStatus === "FAILED") && !submittedMultisigTxId ? (
          <button
            type="button"
            onClick={() =>
              void patchProposal(
                { status: "DRAFT" },
                "Proposal moved back to draft for edits."
              )
            }
            disabled={state.kind === "loading"}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            Move back to draft
          </button>
        ) : null}

        {(proposalStatus === "DRAFT" || proposalStatus === "READY") && !submittedMultisigTxId ? (
          <button
            type="button"
            onClick={() =>
              void patchProposal(
                { status: "CANCELLED" },
                "Proposal cancelled."
              )
            }
            disabled={state.kind === "loading"}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}