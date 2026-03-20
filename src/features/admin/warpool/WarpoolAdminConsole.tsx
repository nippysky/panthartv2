"use client";

import * as React from "react";

import WarpoolMultisigComposer from "@/src/features/admin/warpool/WarpoolMultisigComposer";
import WarpoolRuntimeOperations from "@/src/features/admin/warpool/WarpoolRuntimeOperations";
import WarpoolMultisigActivity from "@/src/features/admin/warpool/WarpoolMultisigActivity";
import WarpoolWorkerReadiness from "@/src/features/admin/warpool/WarpoolWorkerReadiness";

import type {
  WarpoolAdminConfigSnapshot,
  WarpoolAdminMultisigTxItem,
  WarpoolAdminQueueCard,
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
  WarpoolRuntimePrefill,
  WarpoolRuntimePrefillEnvelope,
  WarpoolWorkerOpsData,
  WarpoolWorkerReadinessData,
} from "@/src/features/admin/warpool/types";
import type { WarpoolRuntimeQueueStatus } from "@/src/features/admin/warpool/runtime-queries";
import WarpoolWorkerOpsPanel from "./WarpoolWorkerOpsPanel";

type Props = {
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
  workerOps: WarpoolWorkerOpsData;
};

export default function WarpoolAdminConsole({
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
  workerOps
}: Props) {
  const [runtimePrefill, setRuntimePrefill] =
    React.useState<WarpoolRuntimePrefillEnvelope | null>(null);

  function handlePrefillAction(prefill: WarpoolRuntimePrefill) {
    setRuntimePrefill({
      id: `${prefill.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      payload: prefill,
    });
  }

  return (
    <div className="space-y-6">
      <WarpoolMultisigComposer
        configAddress={configAddress}
        latestConfigSnapshot={latestConfigSnapshot}
        queueCards={queueCards}
        defaultMultisigAddress={defaultMultisigAddress}
        multisigResolutionSource={multisigResolutionSource}
        multisigSummary={multisigSummary}
      />

      <WarpoolWorkerReadiness
        data={workerReadiness}
        onPrefillAction={handlePrefillAction}
      />

      <WarpoolRuntimeOperations
        coreAddress={coreAddress}
        lensAddress={lensAddress}
        queues={runtimeQueues}
        warnings={runtimeWarnings}
        defaultMultisigAddress={defaultMultisigAddress}
        multisigResolutionSource={multisigResolutionSource}
        multisigSummary={multisigSummary}
        prefill={runtimePrefill}
      />

        <WarpoolWorkerOpsPanel data={workerOps} />

      <WarpoolMultisigActivity
        multisigSummary={multisigSummary}
        multisigResolutionSource={multisigResolutionSource}
        recentTxs={recentMultisigTxs}
      />
    </div>
  );
}