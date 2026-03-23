"use client";

import * as React from "react";

import WarpoolGameReadiness from "@/src/features/admin/warpool/WarpoolGameReadiness";
import WarpoolMultisigActivity from "@/src/features/admin/warpool/WarpoolMultisigActivity";
import WarpoolWorkerReadiness from "@/src/features/admin/warpool/WarpoolWorkerReadiness";

import type {
  WarpoolAdminConfigSnapshot,
  WarpoolAdminMultisigTxItem,
  WarpoolAdminQueueCard,
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
  WarpoolWorkerReadinessData,
} from "@/src/features/admin/warpool/types";
import type { WarpoolRuntimeQueueStatus } from "@/src/features/admin/warpool/runtime-queries";

type Props = {
  adminSlug: string;
  configAddress: string | null;
  coreAddress: string | null;
  lensAddress: string | null;
  latestConfigSnapshot: WarpoolAdminConfigSnapshot | null;
  queueCards: WarpoolAdminQueueCard[];
  runtimeQueues: WarpoolRuntimeQueueStatus[];
  runtimeWarnings: string[];
  workerReadiness: WarpoolWorkerReadinessData;
  defaultMultisigAddress: string | null;
  multisigResolutionSource: WarpoolMultisigResolutionSource | null;
  multisigSummary: WarpoolMultisigSummary | null;
  recentMultisigTxs: WarpoolAdminMultisigTxItem[];
};

function NotesCard({
  warnings,
}: {
  warnings: string[];
}) {
  if (warnings.length === 0) return null;

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
          Runtime notes
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Non-blocking read warnings from the live runtime query layer.
        </p>
      </div>

      <div className="rounded-3xl border border-dashed border-border bg-background/60 p-4">
        <div className="space-y-1 text-sm leading-6 text-muted">
          {warnings.map((warning) => (
            <div key={warning}>• {warning}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function WarpoolAdminConsole({
  adminSlug,
  configAddress,
  coreAddress,
  lensAddress,
  latestConfigSnapshot,
  queueCards,
  runtimeQueues,
  runtimeWarnings,
  workerReadiness,
  defaultMultisigAddress,
  multisigResolutionSource,
  multisigSummary,
  recentMultisigTxs,
}: Props) {
  return (
    <div className="space-y-6">
      <WarpoolGameReadiness
        configAddress={configAddress}
        coreAddress={coreAddress}
        lensAddress={lensAddress}
        latestConfigSnapshot={latestConfigSnapshot}
        queueCards={queueCards}
        runtimeQueues={runtimeQueues}
        multisigSummary={multisigSummary}
        multisigResolutionSource={multisigResolutionSource}
        workerReadiness={workerReadiness}
      />

      <WarpoolMultisigActivity
        adminSlug={adminSlug}
        multisigSummary={multisigSummary}
        multisigResolutionSource={multisigResolutionSource}
        recentTxs={recentMultisigTxs}
      />

      <WarpoolWorkerReadiness data={workerReadiness} />

      <NotesCard warnings={runtimeWarnings} />

      {defaultMultisigAddress ? (
        <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
          <div className="mb-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
              Resolved execution safe
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              This is the multisig currently resolved for config governance flows.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-background/60 p-4 text-sm text-foreground">
            {defaultMultisigAddress}
          </div>
        </section>
      ) : null}
    </div>
  );
}