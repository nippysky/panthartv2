import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getWarpoolProposalList,
  getWarpoolProposalStats,
} from "@/src/features/admin/warpool/proposal-queries";
import { shortenAddress } from "@/src/features/admin/warpool/constants";
import type { AdminProposalListItem } from "@/src/features/admin/warpool/types";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

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

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function WarpoolProposalsPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const [stats, proposals] = await Promise.all([
    getWarpoolProposalStats(),
    getWarpoolProposalList(),
  ]);

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
          {proposals.map((proposal: AdminProposalListItem) => (
            <Link
              key={proposal.id}
              href={`/admin/${slug}/warpool/proposals/${proposal.id}`}
              className="rounded-[28px] border border-border bg-card p-5 transition hover:bg-background/40 md:p-6"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={proposal.status} />
                    <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {proposal.kind}
                    </span>

                    {proposal.submittedMultisigNonce !== null ? (
                      <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Nonce {proposal.submittedMultisigNonce}
                      </span>
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Actions" value={proposal._count.actions} />
                    <StatCard label="Events" value={proposal._count.events} />
                    <StatCard
                      label="Approved"
                      value={proposal.status === "APPROVED" || proposal.status === "EXECUTED" ? 1 : 0}
                    />
                    <StatCard
                      label="Executed"
                      value={proposal.status === "EXECUTED" ? 1 : 0}
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
                </div>
              </div>
            </Link>
          ))}
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
              Create proposal from config
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}