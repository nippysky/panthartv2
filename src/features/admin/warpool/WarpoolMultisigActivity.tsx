"use client";

import Link from "next/link";
import type {
  WarpoolAdminMultisigTxItem,
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
} from "@/src/features/admin/warpool/types";

type Props = {
  adminSlug: string;
  multisigSummary: WarpoolMultisigSummary | null;
  multisigResolutionSource: WarpoolMultisigResolutionSource | null;
  recentTxs: WarpoolAdminMultisigTxItem[];
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

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted">
      {text}
    </div>
  );
}

function sourceLabel(source: WarpoolMultisigResolutionSource | null | undefined) {
  switch (source) {
    case "CONFIG_OWNER_MATCH":
      return "Resolved from Warpool config owner";
    case "CONFIG_OWNER_UNREGISTERED":
      return "Config owner found on-chain but not registered locally";
    case "LATEST_REGISTERED_FALLBACK":
      return "Using latest registered fallback";
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

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toneClass(status: WarpoolAdminMultisigTxItem["status"]) {
  switch (status) {
    case "EXECUTED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "FAILED":
    case "CANCELLED":
    case "EXPIRED":
      return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
    case "APPROVED":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "SUBMITTED":
    default:
      return "border-border bg-background text-muted";
  }
}

function statusLabel(status: WarpoolAdminMultisigTxItem["status"]) {
  switch (status) {
    case "SUBMITTED":
      return "Pending approval";
    case "APPROVED":
      return "Ready to execute";
    case "EXECUTED":
      return "Executed";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    case "EXPIRED":
      return "Expired";
    default:
      return status;
  }
}

function getApprovalHint(
  approvalsCount: number,
  threshold: number | null | undefined
) {
  if (!threshold || threshold <= 0) return `${approvalsCount} confirmations`;
  return `${approvalsCount}/${threshold}`;
}

function sortPending(
  a: WarpoolAdminMultisigTxItem,
  b: WarpoolAdminMultisigTxItem
) {
  const weight = (status: WarpoolAdminMultisigTxItem["status"]) =>
    status === "APPROVED" ? 0 : 1;

  const byStatus = weight(a.status) - weight(b.status);
  if (byStatus !== 0) return byStatus;

  return Number(a.nonce) - Number(b.nonce);
}

function sortHistory(
  a: WarpoolAdminMultisigTxItem,
  b: WarpoolAdminMultisigTxItem
) {
  const aTime = new Date(a.executedAt ?? a.createdAt).getTime();
  const bTime = new Date(b.executedAt ?? b.createdAt).getTime();
  return bTime - aTime;
}

type TxCardProps = {
  tx: WarpoolAdminMultisigTxItem;
  threshold: number | null | undefined;
  mode: "pending" | "history";
};

function TxCard({ tx, threshold, mode }: TxCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Nonce #{tx.nonce}
            </div>
            <div className="mt-1 text-xs text-muted">
              To {shortenAddress(tx.to)} · Submitted {formatDate(tx.createdAt)}
            </div>
          </div>

          <div
            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClass(
              tx.status
            )}`}
          >
            {statusLabel(tx.status)}
          </div>
        </div>

        <div className="grid gap-2">
          <Kvp
            label="Approvals"
            value={getApprovalHint(tx.approvalsCount, threshold)}
          />
          <Kvp label="Submitted by" value={shortenAddress(tx.submittedBy)} />
          <Kvp label="Value" value={tx.valueWei} />

          {mode === "pending" ? (
            <Kvp
              label="Next step"
              value={
                tx.status === "APPROVED"
                  ? "Execution can proceed"
                  : "More confirmations needed"
              }
            />
          ) : (
            <>
              <Kvp label="Executed" value={formatDate(tx.executedAt)} />
              <Kvp label="Exec Tx" value={shortenAddress(tx.executedTxHash)} />
            </>
          )}

          <Kvp
            label="Data"
            value={tx.dataHex ? `${tx.dataHex.slice(0, 14)}…` : "—"}
          />
        </div>
      </div>
    </div>
  );
}

export default function WarpoolMultisigActivity({
  adminSlug,
  multisigSummary,
  multisigResolutionSource,
  recentTxs,
}: Props) {
  const threshold = multisigSummary?.threshold ?? null;

  const pendingTxs = recentTxs
    .filter((tx) => tx.status === "SUBMITTED" || tx.status === "APPROVED")
    .sort(sortPending);

  const historyTxs = recentTxs
    .filter((tx) => tx.status !== "SUBMITTED" && tx.status !== "APPROVED")
    .sort(sortHistory);

  const featuredPending = pendingTxs[0] ?? null;
  const featuredHistory = historyTxs[0] ?? null;

  const readyToExecuteCount = pendingTxs.filter(
    (tx) => tx.status === "APPROVED"
  ).length;

  return (
    <SectionCard
      title="Multisig Approvals"
      description="The resolved Warpool multisig, what still needs attention, and the latest tracked transaction history."
    >
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-background/60 p-4">
            <div className="text-sm font-semibold text-foreground">
              Resolved multisig
            </div>

            <div className="mt-4 space-y-1">
              <Kvp label="Source" value={sourceLabel(multisigResolutionSource)} />
              <Kvp label="Contract" value={multisigSummary?.contract ?? "—"} />
              <Kvp label="Threshold" value={multisigSummary?.threshold ?? "—"} />
              <Kvp label="Owners" value={multisigSummary?.ownersCount ?? "—"} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Pending approvals
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {pendingTxs.length}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Ready to execute
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {readyToExecuteCount}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Recent history
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {historyTxs.length}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-foreground">
                Pending approvals
              </div>

              <Link
                href={`/admin/${adminSlug}/warpool/proposals`}
                className="text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                View all proposals
              </Link>
            </div>

            {featuredPending ? (
              <div className="mt-4">
                <TxCard tx={featuredPending} threshold={threshold} mode="pending" />
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState text="There are no pending multisig approvals right now." />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-foreground">
                Recent history
              </div>

              <Link
                href={`/admin/${adminSlug}/warpool/proposals`}
                className="text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                See all history
              </Link>
            </div>

            {featuredHistory ? (
              <div className="mt-4">
                <TxCard tx={featuredHistory} threshold={threshold} mode="history" />
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState text="No executed or failed multisig history has been tracked yet." />
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}