"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  confirmStoredMultisigProposal,
  executeStoredMultisigProposal,
  submitStoredMultisigProposal,
} from "@/src/features/admin/warpool/multisig-browser";

type ProposalActionItem = {
  id: string;
  orderIndex: number;
  label: string | null;
  summary: string | null;
  target: string;
  valueWei: string;
  tokenAddress: string | null;
  dataHex: string;
  functionName: string | null;
  argsJson: unknown;
  status: "PENDING" | "SUBMITTED" | "EXECUTED" | "FAILED";
};

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
  safeAddress: string | null;
  submittedMultisigTxId: string | null;
  submittedMultisigNonce: number | null;
  actions: ProposalActionItem[];
};

type UiState =
  | { kind: "idle"; message: null }
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function SmallKvp({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

export default function WarpoolProposalMultisigPanel({
  proposalId,
  proposalStatus,
  safeAddress,
  submittedMultisigTxId,
  submittedMultisigNonce,
  actions,
}: Props) {
  const router = useRouter();

  const [state, setState] = React.useState<UiState>({
    kind: "idle",
    message: null,
  });

  const canSubmit = proposalStatus === "READY" && !submittedMultisigTxId && !!safeAddress;
  const canConfirm =
    proposalStatus === "SUBMITTED" && !!submittedMultisigTxId && submittedMultisigNonce !== null;
  const canExecute =
    (proposalStatus === "SUBMITTED" || proposalStatus === "APPROVED") &&
    !!submittedMultisigTxId &&
    submittedMultisigNonce !== null;

  async function submitProposal() {
    if (!safeAddress) {
      setState({
        kind: "error",
        message: "No multisig safe is resolved for this proposal.",
      });
      return;
    }

    try {
      setState({
        kind: "loading",
        message: "Submitting proposal to multisig...",
      });

      await submitStoredMultisigProposal({
        proposalId,
        safeAddress,
        actions,
      });

      setState({
        kind: "success",
        message: "Proposal submitted to multisig.",
      });

      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to submit proposal.",
      });
    }
  }

  async function confirmProposal() {
    if (!safeAddress || submittedMultisigNonce === null) {
      setState({
        kind: "error",
        message: "Missing multisig address or nonce.",
      });
      return;
    }

    try {
      setState({
        kind: "loading",
        message: "Confirming multisig transaction...",
      });

      await confirmStoredMultisigProposal({
        proposalId,
        safeAddress,
        nonce: submittedMultisigNonce,
      });

      setState({
        kind: "success",
        message: "Multisig confirmation sent.",
      });

      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to confirm proposal.",
      });
    }
  }

  async function executeProposal() {
    if (!safeAddress || submittedMultisigNonce === null) {
      setState({
        kind: "error",
        message: "Missing multisig address or nonce.",
      });
      return;
    }

    try {
      setState({
        kind: "loading",
        message: "Executing multisig transaction...",
      });

      await executeStoredMultisigProposal({
        proposalId,
        safeAddress,
        nonce: submittedMultisigNonce,
      });

      setState({
        kind: "success",
        message: "Execution sent successfully.",
      });

      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to execute proposal.",
      });
    }
  }

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
          Multisig execution
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Submit, confirm, and execute this stored proposal from the shared admin flow.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-background/70 p-4">
        <SmallKvp label="Safe" value={safeAddress ?? "—"} />
        <SmallKvp label="Proposal status" value={proposalStatus} />
        <SmallKvp label="Stored actions" value={actions.length} />
        <SmallKvp label="Submitted tx id" value={submittedMultisigTxId ?? "—"} />
        <SmallKvp label="Submitted nonce" value={submittedMultisigNonce ?? "—"} />
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

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submitProposal()}
          disabled={!canSubmit || state.kind === "loading"}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Submit to multisig
        </button>

        <button
          type="button"
          onClick={() => void confirmProposal()}
          disabled={!canConfirm || state.kind === "loading"}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          Confirm
        </button>

        <button
          type="button"
          onClick={() => void executeProposal()}
          disabled={!canExecute || state.kind === "loading"}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          Execute
        </button>
      </div>
    </section>
  );
}