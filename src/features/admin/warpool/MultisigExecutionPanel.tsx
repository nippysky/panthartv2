"use client";

import * as React from "react";

import type {
  WarpoolConfigProposalSavePayload,
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
} from "@/src/features/admin/warpool/types";

type ExecutableAction = {
  id: string;
  target: string;
  value: string;
  data: string;
  summary: string;
  functionName: string;
  args: unknown[];
};

type Props = {
  title?: string;
  description?: string;
  actions: ExecutableAction[];
  defaultMultisigAddress?: string | null;
  multisigResolutionSource?: WarpoolMultisigResolutionSource | null;
  multisigSummary?: WarpoolMultisigSummary | null;
  savePayload?: WarpoolConfigProposalSavePayload | null;
  existingProposalId?: string | null;
  onSaveProposal?: (payload: WarpoolConfigProposalSavePayload) => Promise<{
    proposalId: string;
  }>;
  onOpenProposals?: () => void;
};

type ActionState =
  | { kind: "idle"; message: null }
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

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

function Kvp({
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

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition",
        "placeholder:text-muted focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-27.5 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition",
        "placeholder:text-muted focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Label({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{children}</span>
        {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      </div>
    </label>
  );
}

function sourceLabel(source: WarpoolMultisigResolutionSource | null | undefined) {
  switch (source) {
    case "CONFIG_OWNER_MATCH":
      return "Resolved from Warpool config owner";
    case "CONFIG_OWNER_UNREGISTERED":
      return "Config owner exists on-chain but is not registered locally";
    case "LATEST_REGISTERED_FALLBACK":
      return "Using latest registered multisig fallback";
    case "UNAVAILABLE":
      return "No multisig could be resolved automatically";
    default:
      return "—";
  }
}

function shortenAddress(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function MultisigExecutionPanel({
  title = "Proposal handoff",
  description = "Save this config proposal into the admin proposal registry so other multisig owners can review, submit, confirm, and execute it cleanly.",
  actions,
  defaultMultisigAddress = "",
  multisigResolutionSource = null,
  multisigSummary = null,
  savePayload = null,
  existingProposalId = null,
  onSaveProposal,
  onOpenProposals,
}: Props) {
  const [proposalTitle, setProposalTitle] = React.useState(
    savePayload?.title ?? "Warpool config update"
  );
  const [proposalSummary, setProposalSummary] = React.useState(
    savePayload?.summary ?? ""
  );
  const [proposalDescription, setProposalDescription] = React.useState(
    savePayload?.description ?? ""
  );
  const [actionState, setActionState] = React.useState<ActionState>({
    kind: "idle",
    message: null,
  });
  const [savedProposalId, setSavedProposalId] = React.useState<string | null>(
    existingProposalId ?? null
  );

  React.useEffect(() => {
    setProposalTitle(savePayload?.title ?? "Warpool config update");
    setProposalSummary(savePayload?.summary ?? "");
    setProposalDescription(savePayload?.description ?? "");
  }, [savePayload]);

  React.useEffect(() => {
    setSavedProposalId(existingProposalId ?? null);
  }, [existingProposalId]);

  async function handleSave() {
    if (!savePayload || !onSaveProposal) {
      setActionState({
        kind: "error",
        message: "Proposal saving is not wired yet.",
      });
      return;
    }

    if (!proposalTitle.trim()) {
      setActionState({
        kind: "error",
        message: "Proposal title is required.",
      });
      return;
    }

    setActionState({
      kind: "loading",
      message: "Saving proposal…",
    });

    try {
      const result = await onSaveProposal({
        ...savePayload,
        title: proposalTitle.trim(),
        summary: proposalSummary.trim() || null,
        description: proposalDescription.trim() || null,
      });

      setSavedProposalId(result.proposalId);
      setActionState({
        kind: "success",
        message: "Proposal saved successfully.",
      });
    } catch (error) {
      setActionState({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to save proposal.",
      });
    }
  }

  const tone =
    actionState.kind === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : actionState.kind === "error"
        ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
        : "border-border bg-background text-muted";

  return (
    <SectionCard title={title} description={description}>
      <div className="rounded-3xl border border-border bg-background/70 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Kvp
            label="Resolved multisig"
            value={(multisigSummary?.contract ?? defaultMultisigAddress) || "—"}
          />
          <Kvp
            label="Resolution source"
            value={sourceLabel(multisigResolutionSource)}
          />
          <Kvp
            label="Threshold"
            value={
              multisigSummary
                ? `${multisigSummary.threshold} of ${multisigSummary.ownersCount}`
                : "—"
            }
          />
          <Kvp
            label="Prepared actions"
            value={actions.length}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <div>
          <Label hint="Required">Proposal title</Label>
          <TextInput
            value={proposalTitle}
            onChange={(e) => setProposalTitle(e.target.value)}
            placeholder="Warpool config update"
          />
        </div>

        <div>
          <Label hint="Optional">Summary</Label>
          <TextInput
            value={proposalSummary}
            onChange={(e) => setProposalSummary(e.target.value)}
            placeholder="Short human summary for the proposals table"
          />
        </div>

        <div>
          <Label hint="Optional">Description</Label>
          <TextArea
            value={proposalDescription}
            onChange={(e) => setProposalDescription(e.target.value)}
            placeholder="Longer operator notes for other admins and multisig owners"
          />
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-border bg-background/70 p-4">
        <div className="text-sm font-semibold text-foreground">Prepared actions</div>

        {actions.length > 0 ? (
          <div className="mt-3 space-y-3">
            {actions.map((action, index) => (
              <div
                key={action.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="text-sm font-semibold text-foreground">
                  {index + 1}. {action.summary}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {action.functionName} · {shortenAddress(action.target)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-muted">
            No executable actions are currently prepared.
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={actionState.kind === "loading" || actions.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savedProposalId ? "Save changes" : "Save proposal"}
        </button>

        <button
          type="button"
          onClick={onOpenProposals}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
        >
          Open proposals page
        </button>
      </div>

      {savedProposalId ? (
        <div className="mt-4 rounded-3xl border border-border bg-background/70 p-4 text-sm text-foreground">
          Saved proposal ID: <span className="font-medium">{savedProposalId}</span>
        </div>
      ) : null}

      {actionState.message ? (
        <div className={`mt-4 rounded-3xl border p-4 text-sm ${tone}`}>
          {actionState.message}
        </div>
      ) : null}

      <details className="mt-4 rounded-3xl border border-border bg-background/70 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
          Advanced raw payload
        </summary>

        <div className="mt-4">
          <pre className="overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-border bg-card p-4 text-xs leading-6 text-foreground">
            {JSON.stringify(
              {
                title: proposalTitle,
                summary: proposalSummary || null,
                description: proposalDescription || null,
                safeContract: multisigSummary?.contract ?? defaultMultisigAddress ?? null,
                actions: actions.map((action, index) => ({
                  orderIndex: index,
                  summary: action.summary,
                  target: action.target,
                  valueWei: action.value,
                  dataHex: action.data,
                  functionName: action.functionName,
                  argsJson: action.args,
                })),
              },
              null,
              2
            )}
          </pre>
        </div>
      </details>
    </SectionCard>
  );
}