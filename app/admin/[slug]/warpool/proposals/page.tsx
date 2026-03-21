import { notFound } from "next/navigation";

import {
  getWarpoolProposalDetail,
  getWarpoolProposalList,
  getWarpoolProposalStats,
} from "@/src/features/admin/warpool/proposal-queries";

type Props = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    proposal?: string;
    status?: string;
  }>;
};

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/60 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
    </div>
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
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortenAddress(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function statusTone(status: string) {
  switch (status) {
    case "READY":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "SUBMITTED":
    case "APPROVED":
      return "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400";
    case "EXECUTED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "FAILED":
    case "CANCELLED":
      return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "border-border bg-background text-muted";
  }
}

export default async function WarpoolProposalsPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const resolvedSearch = searchParams ? await searchParams : undefined;
  const selectedProposalId = resolvedSearch?.proposal ?? null;
  const selectedStatus = resolvedSearch?.status ?? null;

  const [stats, proposals, selectedProposal] = await Promise.all([
    getWarpoolProposalStats(),
    getWarpoolProposalList({
      status: selectedStatus,
      limit: 50,
    }),
    selectedProposalId ? getWarpoolProposalDetail(selectedProposalId) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-4xl border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Warpool Proposals
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Config proposal registry
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              Shared admin handoff for Warpool config proposals. Save once, then let
              other multisig owners review, confirm, and execute cleanly.
            </p>
          </div>

          <a
            href={`/admin/${slug}/warpool/config`}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Open config composer
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Ready" value={stats.ready} />
        <StatCard label="Submitted" value={stats.submitted} />
        <StatCard label="Approved" value={stats.approved} />
        <StatCard label="Executed" value={stats.executed} />
        <StatCard label="Failed" value={stats.failed} />
        <StatCard label="Cancelled" value={stats.cancelled} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
          <div className="mb-5">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
              Proposal table
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Open a proposal to inspect actions and event history.
            </p>
          </div>

          {proposals.length > 0 ? (
            <div className="overflow-hidden rounded-3xl border border-border">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-background/70">
                    <tr className="text-left">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        Title
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        Status
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        Actions
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        Safe
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposals.map((proposal) => (
                      <tr
                        key={proposal.id}
                        className="border-t border-border bg-card align-top"
                      >
                        <td className="px-4 py-4">
                          <a
                            href={`/admin/${slug}/warpool/proposals?proposal=${proposal.id}${
                              selectedStatus ? `&status=${selectedStatus}` : ""
                            }`}
                            className="block"
                          >
                            <div className="text-sm font-semibold text-foreground">
                              {proposal.title}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-muted">
                              {proposal.summary || proposal.description || "—"}
                            </div>
                          </a>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone(
                              proposal.status
                            )}`}
                          >
                            {proposal.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {proposal.actionCount}
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {shortenAddress(proposal.safeContract)}
                        </td>
                        <td className="px-4 py-4 text-sm text-muted">
                          {formatDate(proposal.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-background/50 p-6 text-sm text-muted">
              No Warpool proposals have been saved yet.
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
          <div className="mb-5">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
              Proposal detail
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Selected proposal metadata, actions, and event history.
            </p>
          </div>

          {selectedProposal ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-border bg-background/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-foreground">
                      {selectedProposal.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-muted">
                      {selectedProposal.summary || selectedProposal.description || "—"}
                    </div>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone(
                      selectedProposal.status
                    )}`}
                  >
                    {selectedProposal.status}
                  </span>
                </div>

                <div className="mt-4 space-y-1">
                  <Kvp label="Proposal ID" value={selectedProposal.id} />
                  <Kvp label="Safe" value={selectedProposal.safeContract ?? "—"} />
                  <Kvp
                    label="Based on config version"
                    value={
                      selectedProposal.basedOnConfigVersion?.toString() ?? "—"
                    }
                  />
                  <Kvp
                    label="Submitted multisig nonce"
                    value={selectedProposal.submittedMultisigNonce ?? "—"}
                  />
                  <Kvp
                    label="Created by"
                    value={shortenAddress(selectedProposal.createdByAddress)}
                  />
                  <Kvp label="Created at" value={formatDate(selectedProposal.createdAt)} />
                  <Kvp label="Updated at" value={formatDate(selectedProposal.updatedAt)} />
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-background/70 p-4">
                <div className="text-sm font-semibold text-foreground">Actions</div>

                {selectedProposal.actions.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {selectedProposal.actions.map((action) => (
                      <div
                        key={action.id}
                        className="rounded-2xl border border-border bg-card p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              {action.orderIndex + 1}. {action.summary || action.label || action.functionName || "Action"}
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              {action.functionName || "raw calldata"} · {shortenAddress(action.target)}
                            </div>
                          </div>

                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone(
                              action.status
                            )}`}
                          >
                            {action.status}
                          </span>
                        </div>

                        <div className="mt-4 space-y-1">
                          <Kvp label="Target" value={action.target} />
                          <Kvp label="Value Wei" value={action.valueWei} />
                        </div>

                        <details className="mt-4 rounded-2xl border border-border bg-background/70 p-3">
                          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                            Raw calldata
                          </summary>
                          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-foreground">
                            {action.dataHex}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted">No actions found.</div>
                )}
              </div>

              <div className="rounded-3xl border border-border bg-background/70 p-4">
                <div className="text-sm font-semibold text-foreground">Event log</div>

                {selectedProposal.events.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {selectedProposal.events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-border bg-card p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-foreground">
                            {event.type}
                          </div>
                          <div className="text-xs text-muted">
                            {formatDate(event.createdAt)}
                          </div>
                        </div>

                        <div className="mt-2 text-sm leading-6 text-muted">
                          {event.note || "—"}
                        </div>

                        <div className="mt-2 text-xs text-muted">
                          Actor: {shortenAddress(event.actorAddress)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted">No proposal events yet.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-background/50 p-6 text-sm text-muted">
              Select a proposal from the table to inspect it here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}