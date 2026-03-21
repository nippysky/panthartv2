import Link from "next/link";
import { notFound } from "next/navigation";

import { getWarpoolAdminOverviewData } from "@/src/features/admin/warpool/queries";
import { getWarpoolRuntimeOverviewData } from "@/src/features/admin/warpool/runtime-queries";
import WarpoolMultisigComposer from "@/src/features/admin/warpool/WarpoolMultisigComposer";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function WarpoolConfigPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const [data, runtimeData] = await Promise.all([
    getWarpoolAdminOverviewData(),
    getWarpoolRuntimeOverviewData(),
  ]);

  const configAddress =
    data.contracts.find((contract) => contract.kind === "CONFIG")?.address ?? null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-[28px] border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Warpool Config
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Config Governance
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              Adjust future Warpool queue rules and global settings, then save
              a clean proposal for shared admin review and multisig execution.
            </p>
          </div>

          <Link
            href={`/admin/${slug}/warpool/proposals`}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:bg-card"
          >
            View saved proposals
          </Link>
        </div>
      </div>

      <WarpoolMultisigComposer
        slug={slug}
        configAddress={configAddress}
        latestConfigSnapshot={data.latestConfigSnapshot}
        queueCards={data.queueCards}
        runtimeQueues={runtimeData.queues}
        defaultMultisigAddress={data.multisigAddress}
        multisigResolutionSource={data.multisigResolutionSource}
        multisigSummary={data.multisigSummary}
      />
    </div>
  );
}