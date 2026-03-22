import Link from "next/link";
import { notFound } from "next/navigation";

import { getWarpoolAdminProposalForDetailPage } from "@/src/features/admin/warpool/proposal-queries";
import WarpoolProposalWorkflowPanel from "@/src/features/admin/warpool/WarpoolProposalWorkflowPanel";
import WarpoolProposalMultisigPanel from "@/src/features/admin/warpool/WarpoolProposalMultisigPanel";

type Props = {
  params: Promise<{
    slug: string;
    proposalId: string;
  }>;
};

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === "bigint") return currentValue.toString();
      return currentValue;
    })
  ) as T;
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

export default async function WarpoolProposalDetailPage({ params }: Props) {
  const { slug, proposalId } = await params;
  if (!slug || !proposalId) notFound();

  const proposal = await getWarpoolAdminProposalForDetailPage(proposalId);
  if (!proposal) notFound();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-[28px] border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Warpool Proposal
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {proposal.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              {proposal.summary ||
                "Review, track, and execute this stored Warpool governance proposal."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/${slug}/warpool/proposals`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:bg-card"
            >
              Back to proposals
            </Link>
            <Link
              href={`/admin/${slug}/warpool/config`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:bg-card"
            >
              Config page
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
                Proposal details
              </h2>
            </div>

            <div className="space-y-1">
              <Kvp label="Area" value={proposal.area} />
              <Kvp label="Kind" value={proposal.kind} />
              <Kvp label="Status" value={proposal.status} />
              <Kvp label="Safe" value={proposal.safeContract ?? "—"} />
              <Kvp label="Chain" value={proposal.chainId ?? "—"} />
              <Kvp label="Based on config" value={proposal.basedOnConfigVersion ?? "—"} />
              <Kvp label="Created by" value={proposal.createdByAddress ?? "—"} />
              <Kvp label="Last edited by" value={proposal.lastEditedByAddress ?? "—"} />
              <Kvp label="Created" value={formatDateTime(proposal.createdAt)} />
              <Kvp label="Updated" value={formatDateTime(proposal.updatedAt)} />
            </div>
          </section>

          <WarpoolProposalWorkflowPanel
            adminSlug={slug}
            proposalId={proposal.id}
            proposalStatus={proposal.status}
            submittedMultisigTxId={proposal.submittedMultisigTxId}
            actionCount={proposal.actions.length}
            submittedActionCount={proposal.submittedActionCount}
            approvedActionCount={proposal.approvedActionCount}
            executedActionCount={proposal.executedActionCount}
            createdByAddress={proposal.createdByAddress}
          />

          <WarpoolProposalMultisigPanel
            adminSlug={slug}
            proposalId={proposal.id}
            proposalStatus={proposal.status}
            safeAddress={proposal.safeContract}
            submittedMultisigTxId={proposal.submittedMultisigTxId}
            submittedMultisigNonce={proposal.submittedMultisigNonce}
            metadataJson={proposal.metadataJson}
            safeThreshold={proposal.safe?.threshold ?? null}
            safeOwnerAddresses={proposal.safe?.ownerAddresses ?? []}
            actions={proposal.actions.map((action) => ({
              id: action.id,
              orderIndex: action.orderIndex,
              label: action.label,
              summary: action.summary,
              target: action.target,
              valueWei: action.valueWei,
              tokenAddress: action.tokenAddress,
              dataHex: action.dataHex,
              functionName: action.functionName,
              argsJson: action.argsJson,
              status: action.status,
              submittedAt: action.submittedAt,
              executedAt: action.executedAt,
            }))}
          />
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
                Action progress
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Each stored action is tracked separately so admins can understand real progress quickly.
              </p>
            </div>

            <div className="space-y-3">
              {proposal.actions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-3xl border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {action.label || action.functionName || `Action ${action.orderIndex + 1}`}
                      </div>
                      {action.summary ? (
                        <p className="mt-1 text-sm leading-6 text-muted">{action.summary}</p>
                      ) : null}
                    </div>

                    <div className="inline-flex rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {action.status}
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    <Kvp label="Order" value={action.orderIndex + 1} />
                    <Kvp label="Target" value={action.target} />
                    <Kvp label="Value" value={action.valueWei} />
                    <Kvp label="Method" value={action.functionName ?? "—"} />
                    <Kvp label="Submitted" value={formatDateTime(action.submittedAt)} />
                    <Kvp label="Executed" value={formatDateTime(action.executedAt)} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <details className="rounded-[28px] border border-border bg-card p-5 md:p-6">
            <summary className="cursor-pointer list-none text-[15px] font-semibold tracking-tight text-foreground">
              Advanced stored payload
            </summary>

            <div className="mt-5 space-y-6">
              <div>
                <div className="mb-2 text-sm font-semibold text-foreground">Snapshot JSON</div>
                <pre className="max-h-120 overflow-auto whitespace-pre-wrap break-all rounded-3xl border border-border bg-background/70 p-4 text-xs leading-6 text-foreground">
                  {JSON.stringify(toJsonSafe(proposal.snapshotJson), null, 2)}
                </pre>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-foreground">Metadata JSON</div>
                <pre className="max-h-120 overflow-auto whitespace-pre-wrap break-all rounded-3xl border border-border bg-background/70 p-4 text-xs leading-6 text-foreground">
                  {JSON.stringify(toJsonSafe(proposal.metadataJson), null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}