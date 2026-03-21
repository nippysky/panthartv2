// app/admin/[slug]/warpool/page.tsx
import { notFound } from "next/navigation";

import { getWarpoolAdminOverviewData } from "@/src/features/admin/warpool/queries";
import { getWarpoolRuntimeOverviewData } from "@/src/features/admin/warpool/runtime-queries";
import { getWarpoolWorkerReadinessData } from "@/src/features/admin/warpool/worker-readiness-queries";
import {
  formatInteger,
  shortenAddress,
} from "@/src/features/admin/warpool/constants";
import WarpoolGameReadiness from "@/src/features/admin/warpool/WarpoolGameReadiness";
import WarpoolMultisigActivity from "@/src/features/admin/warpool/WarpoolMultisigActivity";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/60 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

function ActionCard({
  title,
  text,
  href,
  cta,
}: {
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-[28px] border border-border bg-card p-5 md:p-6">
      <div className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>

      <div className="mt-5">
        <a
          href={href}
          className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90"
        >
          {cta}
        </a>
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

function EmptyPanel({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-background/50 p-6 text-center">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}

export default async function WarpoolAdminPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const [data, runtimeData, workerReadiness] = await Promise.all([
    getWarpoolAdminOverviewData(),
    getWarpoolRuntimeOverviewData(),
    getWarpoolWorkerReadinessData(),
  ]);

  const configAddress =
    data.contracts.find((contract) => contract.kind === "CONFIG")?.address ?? null;

  const enabledQueueCount = data.queueCards.filter((queue) => queue.enabled).length;
  const activeQueueCount = runtimeData.queues.filter((queue) => !!queue.poolId).length;

  const workerAttentionCount =
    workerReadiness.expiredOpenPools.length +
    workerReadiness.battleReadyCandidates.length +
    workerReadiness.settlementCandidates.length +
    workerReadiness.expiredReservations.length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-4xl border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Warpool Admin
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Comrades Warpool
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              Clean control surface for configuration, proposal review, and live
              runtime visibility.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:min-w-[320px]">
            <StatCard label="Contracts" value={data.contracts.length} />
            <StatCard label="Queues" value={data.queueCards.length} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Enabled Queues" value={enabledQueueCount} />
        <StatCard label="Active Pools" value={activeQueueCount} />
        <StatCard label="Total Pools" value={formatInteger(data.stats.totalPools)} />
        <StatCard
          label="Battle Ready"
          value={formatInteger(data.stats.battleReadyPools)}
        />
        <StatCard
          label="Worker Attention"
          value={workerAttentionCount}
          hint="Items the worker should process automatically"
        />
      </div>

      <WarpoolGameReadiness
        configAddress={configAddress}
        coreAddress={runtimeData.coreAddress}
        lensAddress={runtimeData.lensAddress}
        latestConfigSnapshot={data.latestConfigSnapshot}
        queueCards={data.queueCards}
        runtimeQueues={runtimeData.queues}
        multisigSummary={data.multisigSummary}
        multisigResolutionSource={data.multisigResolutionSource}
        workerReadiness={workerReadiness}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <ActionCard
          title="Config"
          text="Edit only long-lived Warpool rules here. Save clean proposals for multisig review."
          href={`/admin/${slug}/warpool/config`}
          cta="Open config"
        />
        <ActionCard
          title="Proposals"
          text="Review saved config proposals, pending handoffs, approvals, and execution history."
          href={`/admin/${slug}/warpool/proposals`}
          cta="Open proposals"
        />
        <ActionCard
          title="Runtime"
          text="Monitor live pools, worker-ready states, and manual recovery-only actions when needed."
          href={`/admin/${slug}/warpool/runtime`}
          cta="Open runtime"
        />
      </div>

      <WarpoolMultisigActivity
        multisigSummary={data.multisigSummary}
        multisigResolutionSource={data.multisigResolutionSource}
        recentTxs={data.recentMultisigTxs}
      />

      <details className="rounded-[28px] border border-border bg-card p-5 md:p-6">
        <summary className="cursor-pointer list-none text-[15px] font-semibold tracking-tight text-foreground">
          Diagnostics and indexed state
        </summary>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-border bg-background/60 p-4">
            <div className="text-sm font-semibold text-foreground">
              Registered contracts
            </div>

            {data.contracts.length > 0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {data.contracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-foreground">
                        {contract.label || contract.kind}
                      </div>
                      <div className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                        {contract.kind}
                      </div>
                    </div>

                    <div className="mt-4 space-y-1">
                      <Kvp label="Address" value={contract.address} />
                      <Kvp label="Chain ID" value={contract.chainId} />
                      <Kvp label="Status" value={contract.active ? "Active" : "Inactive"} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="No contracts registered yet"
                text="Bootstrap has not yet inserted the Config, Core, and Lens contract rows."
              />
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-sm font-semibold text-foreground">
                Global snapshot
              </div>

              {data.latestConfigSnapshot ? (
                <div className="mt-4 space-y-1">
                  <Kvp
                    label="Config Version"
                    value={data.latestConfigSnapshot.configVersion.toString()}
                  />
                  <Kvp
                    label="Treasury"
                    value={shortenAddress(data.latestConfigSnapshot.treasury)}
                  />
                  <Kvp
                    label="Worker"
                    value={shortenAddress(data.latestConfigSnapshot.workerOperator)}
                  />
                  <Kvp
                    label="Entries"
                    value={data.latestConfigSnapshot.entriesPaused ? "Paused" : "Live"}
                  />
                  <Kvp
                    label="Reservations"
                    value={
                      data.latestConfigSnapshot.reservationsPaused ? "Paused" : "Live"
                    }
                  />
                  <Kvp
                    label="Settlements"
                    value={
                      data.latestConfigSnapshot.settlementsPaused ? "Paused" : "Live"
                    }
                  />
                </div>
              ) : (
                <EmptyPanel
                  title="No config snapshot indexed yet"
                  text="The latest config snapshot has not yet been written."
                />
              )}
            </div>

            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-sm font-semibold text-foreground">
                System totals
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Open Pools"
                  value={formatInteger(data.stats.openPools)}
                />
                <StatCard
                  label="Locked"
                  value={formatInteger(data.stats.lockedPools)}
                />
                <StatCard
                  label="Settled"
                  value={formatInteger(data.stats.settledPools)}
                />
                <StatCard
                  label="Expired Refunded"
                  value={formatInteger(data.stats.expiredRefundedPools)}
                />
                <StatCard
                  label="Entries"
                  value={formatInteger(data.stats.totalEntries)}
                />
                <StatCard
                  label="Captures"
                  value={formatInteger(data.stats.totalCaptures)}
                />
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}