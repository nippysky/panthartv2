// app/admin/[slug]/warpool/config/page.tsx
import { notFound } from "next/navigation";

import { getWarpoolAdminOverviewData } from "@/src/features/admin/warpool/queries";
import { getWarpoolRuntimeOverviewData } from "@/src/features/admin/warpool/runtime-queries";
import WarpoolMultisigComposer from "@/src/features/admin/warpool/WarpoolMultisigComposer";
import WarpoolMultisigActivity from "@/src/features/admin/warpool/WarpoolMultisigActivity";
import { formatInteger } from "@/src/features/admin/warpool/constants";

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

export default async function WarpoolConfigPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const [data, runtimeData] = await Promise.all([
    getWarpoolAdminOverviewData(),
    getWarpoolRuntimeOverviewData(),
  ]);

  const configAddress =
    data.contracts.find((contract) => contract.kind === "CONFIG")?.address ?? null;

  const enabledQueueCount = data.queueCards.filter((queue) => queue.enabled).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-4xl border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Warpool Config
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Configuration composer
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              This page is strictly for future game rules and queue configuration.
              Save changes as shared proposals for multisig review.
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
              href={`/admin/${slug}/warpool/proposals`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90"
            >
              Open proposals
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Config Version"
          value={data.latestConfigSnapshot?.configVersion?.toString() ?? "—"}
        />
        <StatCard label="Enabled Queues" value={enabledQueueCount} />
        <StatCard
          label="Total Pools"
          value={formatInteger(data.stats.totalPools)}
        />
        <StatCard
          label="Live Pools"
          value={runtimeData.queues.filter((queue) => !!queue.poolId).length}
        />
      </div>

      <WarpoolMultisigComposer
        configAddress={configAddress}
        latestConfigSnapshot={data.latestConfigSnapshot}
        queueCards={data.queueCards}
        runtimeQueues={runtimeData.queues}
        defaultMultisigAddress={data.multisigAddress}
        multisigResolutionSource={data.multisigResolutionSource}
        multisigSummary={data.multisigSummary}
      />

      <WarpoolMultisigActivity
        multisigSummary={data.multisigSummary}
        multisigResolutionSource={data.multisigResolutionSource}
        recentTxs={data.recentMultisigTxs}
      />
    </div>
  );
}