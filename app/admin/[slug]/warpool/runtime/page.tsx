import { notFound } from "next/navigation";

import { getWarpoolAdminOverviewData } from "@/src/features/admin/warpool/queries";
import { getWarpoolRuntimeOverviewData } from "@/src/features/admin/warpool/runtime-queries";
import { getWarpoolWorkerReadinessData } from "@/src/features/admin/warpool/worker-readiness-queries";
import WarpoolRuntimeOperations from "@/src/features/admin/warpool/WarpoolRuntimeOperations";
import WarpoolWorkerReadiness from "@/src/features/admin/warpool/WarpoolWorkerReadiness";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function WarpoolRuntimePage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const [data, runtimeData, workerReadiness] = await Promise.all([
    getWarpoolAdminOverviewData(),
    getWarpoolRuntimeOverviewData(),
    getWarpoolWorkerReadinessData(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-[28px] border border-border bg-card p-6 md:p-8">
        <div>
          <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Runtime Monitor
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Runtime Monitor and Recovery
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
            Live queue conditions, worker-ready candidates, and controlled runtime
            recovery actions. This is operational monitoring, not config governance.
          </p>
        </div>
      </div>

      <WarpoolWorkerReadiness data={workerReadiness} />

      <WarpoolRuntimeOperations
        coreAddress={runtimeData.coreAddress}
        lensAddress={runtimeData.lensAddress}
        queues={runtimeData.queues}
        warnings={runtimeData.warnings}
        defaultMultisigAddress={data.multisigAddress}
        multisigResolutionSource={data.multisigResolutionSource}
        multisigSummary={data.multisigSummary}
      />
    </div>
  );
}