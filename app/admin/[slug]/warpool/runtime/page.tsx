// app/admin/[slug]/warpool/runtime/page.tsx
import { notFound } from "next/navigation";

import { getWarpoolAdminOverviewData } from "@/src/features/admin/warpool/queries";
import { getWarpoolRuntimeOverviewData } from "@/src/features/admin/warpool/runtime-queries";
import { getWarpoolWorkerReadinessData } from "@/src/features/admin/warpool/worker-readiness-queries";
import WarpoolRuntimeOperations from "@/src/features/admin/warpool/WarpoolRuntimeOperations";
import WarpoolWorkerReadiness from "@/src/features/admin/warpool/WarpoolWorkerReadiness";
import {
  formatInteger,
} from "@/src/features/admin/warpool/constants";

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

export default async function WarpoolRuntimePage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const [data, runtimeData, workerReadiness] = await Promise.all([
    getWarpoolAdminOverviewData(),
    getWarpoolRuntimeOverviewData(),
    getWarpoolWorkerReadinessData(),
  ]);

  const recoveryCount =
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
              Warpool Runtime
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Live monitor and recovery
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              Runtime should mostly be automated by the worker. This page is for
              monitoring and controlled manual recovery only.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={`/admin/${slug}/warpool`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Overview
            </a>
            <a
              href={`/admin/${slug}/warpool/config`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Config
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Active Pools"
          value={runtimeData.queues.filter((queue) => !!queue.poolId).length}
        />
        <StatCard
          label="Open Pools"
          value={formatInteger(data.stats.openPools)}
        />
        <StatCard
          label="Battle Ready"
          value={formatInteger(data.stats.battleReadyPools)}
        />
        <StatCard
          label="Pending Recovery"
          value={recoveryCount}
          hint="Should normally be handled by worker"
        />
        <StatCard
          label="Captures"
          value={formatInteger(data.stats.totalCaptures)}
        />
      </div>

      <WarpoolWorkerReadiness
        data={workerReadiness}
      />

      <WarpoolRuntimeOperations
        coreAddress={runtimeData.coreAddress}
        lensAddress={runtimeData.lensAddress}
        queues={runtimeData.queues}
        warnings={runtimeData.warnings}
        defaultMultisigAddress={data.multisigAddress}
        multisigResolutionSource={data.multisigResolutionSource}
        multisigSummary={data.multisigSummary}
        prefill={null}
      />
    </div>
  );
}