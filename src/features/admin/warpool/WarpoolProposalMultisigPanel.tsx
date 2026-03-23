"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  confirmMultisigAction,
  executeMultisigAction,
  submitMultisigAction,
} from "@/src/features/admin/warpool/multisig-browser";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import WalletPill from "@/src/ui/WalletPill";

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
  submittedAt?: string | Date | null;
  executedAt?: string | Date | null;
};

type StoredMultisigLink = {
  txId?: string | null;
  txIndex?: number | null;
  txHash?: string | null;
  executedTxHash?: string | null;
  submittedBy?: string | null;
  confirmedBy?: string | null;
  executedBy?: string | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  executedAt?: string | null;
  status?: "SUBMITTED" | "APPROVED" | "EXECUTED" | "FAILED";
};

type Props = {
  adminSlug: string;
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
  metadataJson: unknown;
  safeThreshold: number | null;
  safeOwnerAddresses: string[];
  actions: ProposalActionItem[];
};

type UiState =
  | { kind: "idle"; message: null; actionId: null }
  | { kind: "loading"; message: string; actionId: string | null }
  | { kind: "success"; message: string; actionId: string | null }
  | { kind: "error"; message: string; actionId: string | null };

function normalizeAddress(value: string | null | undefined) {
  const next = String(value ?? "").trim().toLowerCase();
  return next || null;
}

function StatusPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "good" | "warn" | "info";
}) {
  const className =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : tone === "info"
          ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
          : "border-border bg-card text-muted";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {label}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  loading,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        "inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        primary
          ? "border-border bg-foreground text-background hover:opacity-90"
          : "border-border bg-card text-foreground hover:bg-background",
      ].join(" ")}
    >
      {loading ? "Working..." : label}
    </button>
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getStoredLinks(metadataJson: unknown) {
  if (!isPlainObject(metadataJson)) return {} as Record<string, StoredMultisigLink>;
  const raw = metadataJson.multisigLinks;
  if (!isPlainObject(raw)) return {} as Record<string, StoredMultisigLink>;
  return raw as Record<string, StoredMultisigLink>;
}

function shortenAddress(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function hasTxIndex(link: StoredMultisigLink | undefined) {
  return link?.txIndex !== undefined && link?.txIndex !== null;
}

function deriveLifecycle(
  action: ProposalActionItem,
  link: StoredMultisigLink | undefined
) {
  const submitted =
    hasTxIndex(link) ||
    !!link?.txId ||
    !!link?.txHash ||
    !!link?.submittedAt ||
    action.status === "SUBMITTED" ||
    action.status === "EXECUTED" ||
    link?.status === "SUBMITTED" ||
    link?.status === "APPROVED" ||
    link?.status === "EXECUTED";

  const approved =
    link?.status === "APPROVED" ||
    link?.status === "EXECUTED";

  const executed =
    !!link?.executedAt ||
    !!link?.executedTxHash ||
    action.status === "EXECUTED" ||
    link?.status === "EXECUTED";

  const failed = action.status === "FAILED" || link?.status === "FAILED";

  return { submitted, approved, executed, failed };
}

function proposalAllowsMoreSubmission(
  status: Props["proposalStatus"]
) {
  return status === "READY" || status === "SUBMITTED" || status === "APPROVED";
}

export default function WarpoolProposalMultisigPanel({
  proposalId,
  proposalStatus,
  safeAddress,
  submittedMultisigTxId,
  submittedMultisigNonce,
  metadataJson,
  safeThreshold,
  safeOwnerAddresses,
  actions,
}: Props) {
  const router = useRouter();
  const { address } = useDecentWalletAccount();

  const [state, setState] = React.useState<UiState>({
    kind: "idle",
    message: null,
    actionId: null,
  });

  const storedLinks = React.useMemo(() => getStoredLinks(metadataJson), [metadataJson]);

  const normalizedWallet = normalizeAddress(address);
  const hasWallet = !!normalizedWallet;
  const normalizedOwners = React.useMemo(
    () => safeOwnerAddresses.map((item) => item.toLowerCase()),
    [safeOwnerAddresses]
  );
  const isSafeOwner = !!normalizedWallet && normalizedOwners.includes(normalizedWallet);

  async function postMultisigSync(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/warpool/proposals/${proposalId}/multisig`, {
      method: "POST",
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
      throw new Error(json.error || "Failed to sync multisig result.");
    }
  }

  async function runAction(
    actionId: string,
    message: string,
    handler: () => Promise<void>
  ) {
    try {
      setState({
        kind: "loading",
        message,
        actionId,
      });

      await handler();

      setState({
        kind: "success",
        message: "Action synced successfully.",
        actionId,
      });

      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Action failed.",
        actionId,
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
          Submit, confirm, and execute each stored action through the resolved safe.
          Older already-submitted actions can continue from their current stage.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-background/70 p-4">
        {!safeAddress ? (
          <div className="text-sm text-muted">
            No multisig safe is resolved for this proposal.
          </div>
        ) : !hasWallet ? (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-muted">
              Connect an allowed admin wallet to use the multisig controls.
            </div>
            <div className="flex">
              <WalletPill />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-muted">
              Connected wallet:{" "}
              <span className="font-medium text-foreground">{shortenAddress(address)}</span>
            </div>
            <div className="text-sm text-muted">
              Safe: <span className="font-medium text-foreground">{safeAddress}</span>
            </div>
            <div className="text-sm text-muted">
              Threshold: <span className="font-medium text-foreground">{safeThreshold ?? "—"}</span>
            </div>
            <div className="text-sm text-muted">
              Wallet access:{" "}
              <span className="font-medium text-foreground">
                {isSafeOwner ? "Safe owner detected" : "Server will validate this wallet on submit"}
              </span>
            </div>
            <div className="text-sm text-muted">
              Proposal status:{" "}
              <span className="font-medium text-foreground">{proposalStatus}</span>
            </div>
            <div className="text-sm text-muted">
              First linked tx id:{" "}
              <span className="font-medium text-foreground">{submittedMultisigTxId ?? "—"}</span>
            </div>
            <div className="text-sm text-muted">
              First linked nonce:{" "}
              <span className="font-medium text-foreground">{submittedMultisigNonce ?? "—"}</span>
            </div>
          </div>
        )}
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

      <div className="mt-5 space-y-4">
        {actions.map((action) => {
          const link = storedLinks[action.id];
          const isBusy = state.kind === "loading" && state.actionId === action.id;

          const lifecycle = deriveLifecycle(action, link);
          const txIndexPresent = hasTxIndex(link);

          const canSubmit =
            !!safeAddress &&
            hasWallet &&
            proposalAllowsMoreSubmission(proposalStatus) &&
            !lifecycle.submitted &&
            !lifecycle.executed &&
            !lifecycle.failed;

          const canConfirm =
            !!safeAddress &&
            hasWallet &&
            txIndexPresent &&
            lifecycle.submitted &&
            !lifecycle.approved &&
            !lifecycle.executed &&
            !lifecycle.failed;

          const canExecute =
            !!safeAddress &&
            hasWallet &&
            txIndexPresent &&
            lifecycle.approved &&
            !lifecycle.executed &&
            !lifecycle.failed;

          return (
            <div key={action.id} className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    #{action.orderIndex + 1} {action.label || action.functionName || "Stored action"}
                  </div>
                  {action.summary ? (
                    <p className="mt-1 text-sm leading-6 text-muted">{action.summary}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusPill label={action.status} />
                  {txIndexPresent ? (
                    <StatusPill label={`Tx #${link?.txIndex}`} tone="info" />
                  ) : (
                    <StatusPill label="Not submitted" />
                  )}
                  {lifecycle.failed ? (
                    <StatusPill label="Failed" tone="warn" />
                  ) : lifecycle.executed ? (
                    <StatusPill label="Executed" tone="good" />
                  ) : lifecycle.approved ? (
                    <StatusPill label="Ready to execute" tone="good" />
                  ) : lifecycle.submitted ? (
                    <StatusPill label="Awaiting confirmations" tone="info" />
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-muted">
                <div>
                  Target: <span className="font-medium text-foreground">{action.target}</span>
                </div>
                <div>
                  Value: <span className="font-medium text-foreground">{action.valueWei}</span>
                </div>
                <div>
                  Submitted:{" "}
                  <span className="font-medium text-foreground">
                    {formatDateTime(link?.submittedAt ?? action.submittedAt)}
                  </span>
                </div>
                <div>
                  Confirmed:{" "}
                  <span className="font-medium text-foreground">
                    {formatDateTime(link?.confirmedAt)}
                  </span>
                </div>
                <div>
                  Executed:{" "}
                  <span className="font-medium text-foreground">
                    {formatDateTime(link?.executedAt ?? action.executedAt)}
                  </span>
                </div>

                {link?.txHash ? (
                  <div>
                    Submit tx:{" "}
                    <span className="break-all font-medium text-foreground">{link.txHash}</span>
                  </div>
                ) : null}

                {link?.executedTxHash ? (
                  <div>
                    Execute tx:{" "}
                    <span className="break-all font-medium text-foreground">{link.executedTxHash}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton
                  label="Submit"
                  primary
                  loading={isBusy}
                  disabled={!canSubmit}
                  onClick={() =>
                    void runAction(
                      action.id,
                      `Submitting action #${action.orderIndex + 1} to multisig...`,
                      async () => {
                        if (!safeAddress) throw new Error("Missing safe contract.");
                        if (!address) throw new Error("Wallet not connected.");

                        const submitted = await submitMultisigAction({
                          multisigAddress: safeAddress,
                          action,
                          autoConfirm: true,
                        });

                        await postMultisigSync({
                          type: "record_submission",
                          actionId: action.id,
                          txIndex: submitted.txIndex,
                          txHash: submitted.txHash,
                          submitter: address,
                          confirmedInSameTx: submitted.confirmedInSameTx,
                          executedInSameTx: submitted.executedInSameTx,
                        });
                      }
                    )
                  }
                />

                <ActionButton
                  label="Confirm"
                  loading={isBusy}
                  disabled={!canConfirm}
                  onClick={() =>
                    void runAction(
                      action.id,
                      `Confirming action #${action.orderIndex + 1}...`,
                      async () => {
                        if (!safeAddress) throw new Error("Missing safe contract.");
                        if (!address) throw new Error("Wallet not connected.");
                        if (!txIndexPresent || link?.txIndex == null) {
                          throw new Error("This action has not been submitted yet.");
                        }

                        const confirmed = await confirmMultisigAction({
                          multisigAddress: safeAddress,
                          txIndex: link.txIndex,
                        });

                        await postMultisigSync({
                          type: "record_confirmation",
                          actionId: action.id,
                          txIndex: link.txIndex,
                          txHash: confirmed.txHash,
                          ownerAddress: address,
                          executedInSameTx: confirmed.executedInSameTx,
                        });
                      }
                    )
                  }
                />

                <ActionButton
                  label="Execute"
                  loading={isBusy}
                  disabled={!canExecute}
                  onClick={() =>
                    void runAction(
                      action.id,
                      `Executing action #${action.orderIndex + 1}...`,
                      async () => {
                        if (!safeAddress) throw new Error("Missing safe contract.");
                        if (!address) throw new Error("Wallet not connected.");
                        if (!txIndexPresent || link?.txIndex == null) {
                          throw new Error("This action has not been submitted yet.");
                        }

                        const executed = await executeMultisigAction({
                          multisigAddress: safeAddress,
                          txIndex: link.txIndex,
                        });

                        await postMultisigSync({
                          type: "record_execution",
                          actionId: action.id,
                          txIndex: link.txIndex,
                          txHash: executed.txHash,
                          executor: address,
                        });
                      }
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}