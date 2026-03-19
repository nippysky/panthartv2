"use client";

import * as React from "react";
import { ethers } from "ethers";

import {
  WARPOOL_QUEUE_META,
  formatTokenAmount,
} from "@/src/features/admin/warpool/constants";
import {
  encodeExpireReservationAction,
  encodeMarkBattleReadyAction,
  encodeOpenPoolAction,
  encodeProcessExpiredPoolAction,
  encodeRuntimeActionsAsMultisigSubmissions,
  encodeSettlePoolAction,
} from "@/src/features/admin/warpool/encodeRuntimeActions";
import type { EncodedRuntimePlan } from "@/src/features/admin/warpool/encodeRuntimeActions";
import type { WarpoolQueueSlug } from "@/src/features/admin/warpool/multisig-types";
import type {
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
  WarpoolRuntimePrefillEnvelope,
} from "@/src/features/admin/warpool/types";
import type { WarpoolRuntimeQueueStatus } from "@/src/features/admin/warpool/runtime-queries";
import MultisigExecutionPanel from "@/src/features/admin/warpool/MultisigExecutionPanel";

type Props = {
  coreAddress: string | null;
  lensAddress: string | null;
  defaultMultisigAddress?: string | null;
  multisigResolutionSource?: WarpoolMultisigResolutionSource | null;
  multisigSummary?: WarpoolMultisigSummary | null;
  queues: WarpoolRuntimeQueueStatus[];
  warnings?: string[];
  prefill?: WarpoolRuntimePrefillEnvelope | null;
};

function SectionCard({
  title,
  description,
  children,
  tone = "default",
  sectionRef,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "default" | "highlight";
  sectionRef?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section
      ref={sectionRef}
      className={[
        "scroll-mt-24 rounded-[28px] border bg-card p-5 transition-all duration-300 md:p-6",
        tone === "highlight"
          ? "border-foreground/30 ring-2 ring-foreground/10"
          : "border-border",
      ].join(" ")}
    >
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

function Label({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{children}</span>
        {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      </div>
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition",
        "placeholder:text-muted focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn";
}) {
  const className =
    tone === "good"
      ? "border-border bg-background text-foreground"
      : tone === "warn"
        ? "border-border bg-background text-foreground"
        : "border-border bg-background text-muted";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${className}`}
    >
      {children}
    </span>
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
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

type PreviewPlan = EncodedRuntimePlan & {
  title: string;
};

type FocusSection = "queues" | "settlement" | "utility" | null;

const EMPTY_PREVIEW: PreviewPlan = {
  title: "No runtime action selected yet",
  target: "",
  warnings: [],
  summaryLines: [],
  actions: [],
};

function stateLabel(state: number | null) {
  switch (state) {
    case 1:
      return "Open";
    case 2:
      return "Locked";
    case 3:
      return "Battle Ready";
    case 4:
      return "Settling";
    case 5:
      return "Settled";
    case 6:
      return "Closed";
    case 7:
      return "Expired Refunded";
    default:
      return "Idle";
  }
}

function unixToText(value: number | null) {
  if (!value || value <= 0) return "—";
  return new Date(value * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function WarpoolRuntimeOperations({
  coreAddress,
  lensAddress,
  queues,
  defaultMultisigAddress = null,
  multisigResolutionSource = null,
  multisigSummary = null,
  warnings = [],
  prefill = null,
}: Props) {
  const [preview, setPreview] = React.useState<PreviewPlan>(EMPTY_PREVIEW);

  const [settlePoolId, setSettlePoolId] = React.useState("");
  const [firstEntryId, setFirstEntryId] = React.useState("");
  const [secondEntryId, setSecondEntryId] = React.useState("");
  const [thirdEntryId, setThirdEntryId] = React.useState("");

  const [manualPoolId, setManualPoolId] = React.useState("");
  const [manualReservationId, setManualReservationId] = React.useState("");

  const [focusSection, setFocusSection] = React.useState<FocusSection>(null);
  const [prefillBanner, setPrefillBanner] = React.useState<string | null>(null);

  const queueSectionRef = React.useRef<HTMLElement | null>(null);
  const settlementSectionRef = React.useRef<HTMLElement | null>(null);
  const utilitySectionRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!prefill) return;

    let nextFocus: FocusSection = null;
    let banner: string | null = null;

    if (prefill.payload.type === "PROCESS_EXPIRED_POOL") {
      setManualPoolId(prefill.payload.poolId);
      nextFocus = "utility";
      banner = `Prefilled Process Expired for pool ${prefill.payload.poolId}.`;
    }

    if (prefill.payload.type === "MARK_BATTLE_READY") {
      setManualPoolId(prefill.payload.poolId);
      nextFocus = "utility";
      banner = `Prefilled Battle Ready for pool ${prefill.payload.poolId}.`;
    }

    if (prefill.payload.type === "SETTLE_POOL") {
      setSettlePoolId(prefill.payload.poolId);
      nextFocus = "settlement";
      banner = `Prefilled Settle Pool for pool ${prefill.payload.poolId}.`;
    }

    if (prefill.payload.type === "EXPIRE_RESERVATION") {
      setManualReservationId(prefill.payload.reservationId);
      nextFocus = "utility";
      banner = `Prefilled Expire Reservation for reservation ${prefill.payload.reservationId}.`;
    }

    setFocusSection(nextFocus);
    setPrefillBanner(banner);

    const timer = window.setTimeout(() => {
      setFocusSection(null);
    }, 2200);

    const bannerTimer = window.setTimeout(() => {
      setPrefillBanner(null);
    }, 3200);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(bannerTimer);
    };
  }, [prefill]);

  React.useEffect(() => {
    if (!focusSection) return;

    const refMap: Record<Exclude<FocusSection, null>, React.RefObject<HTMLElement | null>> = {
      queues: queueSectionRef,
      settlement: settlementSectionRef,
      utility: utilitySectionRef,
    };

    const target = refMap[focusSection]?.current;
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [focusSection]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op
    }
  }

  function setErrorPreview(title: string, message: string) {
    setPreview({
      title,
      target: coreAddress ?? "",
      warnings: [message],
      summaryLines: [],
      actions: [],
    });
  }

  function handleQueueOpen(queueSlug: WarpoolQueueSlug) {
    if (!coreAddress || !ethers.isAddress(coreAddress)) {
      setErrorPreview("Open Pool", "Core contract address is missing or invalid.");
      return;
    }

    try {
      const plan = encodeOpenPoolAction({
        coreAddress,
        queueSlug,
      });

      setPreview({
        title: `Open Pool · ${WARPOOL_QUEUE_META[queueSlug].title}`,
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Open Pool",
        error instanceof Error ? error.message : "Failed to encode openPool action."
      );
    }
  }

  function handleProcessExpired(poolId?: string | null) {
    const selectedPoolId = poolId ?? manualPoolId;

    if (!coreAddress || !ethers.isAddress(coreAddress)) {
      setErrorPreview(
        "Process Expired Pool",
        "Core contract address is missing or invalid."
      );
      return;
    }

    try {
      const plan = encodeProcessExpiredPoolAction({
        coreAddress,
        poolId: selectedPoolId,
      });

      setPreview({
        title: "Process Expired Pool",
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Process Expired Pool",
        error instanceof Error
          ? error.message
          : "Failed to encode processExpiredPool action."
      );
    }
  }

  function handleMarkBattleReady(poolId?: string | null) {
    const selectedPoolId = poolId ?? manualPoolId;

    if (!coreAddress || !ethers.isAddress(coreAddress)) {
      setErrorPreview(
        "Mark Battle Ready",
        "Core contract address is missing or invalid."
      );
      return;
    }

    try {
      const plan = encodeMarkBattleReadyAction({
        coreAddress,
        poolId: selectedPoolId,
      });

      setPreview({
        title: "Mark Pool Battle Ready",
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Mark Battle Ready",
        error instanceof Error
          ? error.message
          : "Failed to encode markPoolBattleReady action."
      );
    }
  }

  function handleExpireReservation() {
    if (!coreAddress || !ethers.isAddress(coreAddress)) {
      setErrorPreview(
        "Expire Reservation",
        "Core contract address is missing or invalid."
      );
      return;
    }

    try {
      const plan = encodeExpireReservationAction({
        coreAddress,
        reservationId: manualReservationId,
      });

      setPreview({
        title: "Expire Reservation",
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Expire Reservation",
        error instanceof Error
          ? error.message
          : "Failed to encode expireReservation action."
      );
    }
  }

  function handleSettlePool() {
    if (!coreAddress || !ethers.isAddress(coreAddress)) {
      setErrorPreview("Settle Pool", "Core contract address is missing or invalid.");
      return;
    }

    try {
      const plan = encodeSettlePoolAction({
        coreAddress,
        poolId: settlePoolId,
        firstEntryId,
        secondEntryId,
        thirdEntryId,
      });

      setPreview({
        title: "Settle Pool",
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Settle Pool",
        error instanceof Error ? error.message : "Failed to encode settlePool action."
      );
    }
  }

  const multisigPayload = React.useMemo(() => {
    if (preview.actions.length === 0 || !preview.target) return [];

    return encodeRuntimeActionsAsMultisigSubmissions({
      runtimePlan: {
        target: preview.target,
        actions: preview.actions,
        warnings: preview.warnings,
        summaryLines: preview.summaryLines,
      },
    });
  }, [preview]);

  const previewSummaryText = React.useMemo(() => {
    const lines: string[] = [];

    lines.push(preview.title);
    lines.push("");

    if (preview.target) {
      lines.push(`Core contract: ${preview.target}`);
      lines.push("");
    }

    if (preview.summaryLines.length > 0) {
      lines.push("Summary");
      lines.push("");
      for (const line of preview.summaryLines) {
        lines.push(`- ${line}`);
      }
      lines.push("");
    }

    if (preview.warnings.length > 0) {
      lines.push("Warnings");
      lines.push("");
      for (const line of preview.warnings) {
        lines.push(`- ${line}`);
      }
      lines.push("");
    }

    lines.push(`Encoded actions: ${preview.actions.length}`);

    return lines.join("\n");
  }, [preview]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        {prefillBanner ? (
          <div className="rounded-3xl border border-foreground/20 bg-background/80 p-4 text-sm text-foreground">
            {prefillBanner}
          </div>
        ) : null}

        <SectionCard
          title="Queue Operations"
          description="Live queue state from Lens plus quick runtime actions for pool management."
          tone={focusSection === "queues" ? "highlight" : "default"}
          sectionRef={queueSectionRef}
        >
          {(warnings.length > 0 || !lensAddress) && (
            <div className="mb-4 rounded-3xl border border-dashed border-border bg-background/70 p-4">
              <div className="text-sm font-semibold text-foreground">
                Live lens notes
              </div>
              <div className="mt-2 space-y-1 text-sm leading-6 text-muted">
                {!lensAddress ? <div>• Lens contract address is not available.</div> : null}
                {warnings.map((warning) => (
                  <div key={warning}>• {warning}</div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {queues.map((queue) => {
              const meta = WARPOOL_QUEUE_META[queue.slug];
              const hasActivePool = Boolean(queue.poolId);

              return (
                <div
                  key={queue.slug}
                  className="rounded-[28px] border border-border bg-background/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {meta.title}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {meta.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Pill>{meta.badge}</Pill>
                      <Pill tone={hasActivePool ? "good" : "warn"}>
                        {hasActivePool ? "Active" : "Idle"}
                      </Pill>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    <Kvp label="Pool ID" value={queue.poolId ?? "—"} />
                    <Kvp label="State" value={stateLabel(queue.state)} />
                    <Kvp
                      label="Entrants"
                      value={
                        queue.entrantCount !== null && queue.targetSize !== null
                          ? `${queue.entrantCount} / ${queue.targetSize}`
                          : "—"
                      }
                    />
                    <Kvp label="Runnable" value={queue.runnableSize ?? "—"} />
                    <Kvp label="Min Start" value={queue.minStartSize ?? "—"} />
                    <Kvp
                      label="Stake"
                      value={
                        queue.stakeAmountRaw
                          ? formatTokenAmount(queue.stakeAmountRaw)
                          : "—"
                      }
                    />
                    <Kvp label="Opened" value={unixToText(queue.openedAt)} />
                    <Kvp label="Expires" value={unixToText(queue.expiresAt)} />
                    <Kvp
                      label="Discount Seats"
                      value={
                        queue.discountSeatsUsed !== null &&
                        queue.discountSeatsReserved !== null
                          ? `${queue.discountSeatsUsed} used · ${queue.discountSeatsReserved} reserved`
                          : "—"
                      }
                    />
                    <Kvp label="Token11 Seats" value={queue.token11SeatsUsed ?? "—"} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleQueueOpen(queue.slug)}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                    >
                      Encode Open Pool
                    </button>

                    {queue.poolId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleProcessExpired(queue.poolId)}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                        >
                          Process Expired
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMarkBattleReady(queue.poolId)}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                        >
                          Battle Ready
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Settlement Composer"
          description="Prepare settlement calldata for a battle-ready pool by supplying the winning entry IDs in order."
          tone={focusSection === "settlement" ? "highlight" : "default"}
          sectionRef={settlementSectionRef}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label hint="Required">Pool ID</Label>
              <TextInput
                inputMode="numeric"
                value={settlePoolId}
                onChange={(e) => setSettlePoolId(e.target.value)}
                placeholder="e.g. 12"
              />
            </div>

            <div>
              <Label hint="Winner">1st Entry ID</Label>
              <TextInput
                inputMode="numeric"
                value={firstEntryId}
                onChange={(e) => setFirstEntryId(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>

            <div>
              <Label hint="Runner-up">2nd Entry ID</Label>
              <TextInput
                inputMode="numeric"
                value={secondEntryId}
                onChange={(e) => setSecondEntryId(e.target.value)}
                placeholder="e.g. 102"
              />
            </div>

            <div>
              <Label hint="Third place">3rd Entry ID</Label>
              <TextInput
                inputMode="numeric"
                value={thirdEntryId}
                onChange={(e) => setThirdEntryId(e.target.value)}
                placeholder="e.g. 103"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleSettlePool}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Encode Settle Pool
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Utility Actions"
          description="Manual runtime utilities for worker-compatible actions on the Warpool core contract."
          tone={focusSection === "utility" ? "highlight" : "default"}
          sectionRef={utilitySectionRef}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-sm font-semibold text-foreground">
                Pool Utilities
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">
                Encode manual process-expired or battle-ready actions by pool ID.
              </p>

              <div className="mt-4">
                <Label>Pool ID</Label>
                <TextInput
                  inputMode="numeric"
                  value={manualPoolId}
                  onChange={(e) => setManualPoolId(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleProcessExpired()}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                >
                  Encode Process Expired
                </button>

                <button
                  type="button"
                  onClick={() => handleMarkBattleReady()}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                >
                  Encode Battle Ready
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-sm font-semibold text-foreground">
                Reservation Utility
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">
                Encode manual reservation expiry for an overdue active reservation.
              </p>

              <div className="mt-4">
                <Label>Reservation ID</Label>
                <TextInput
                  inputMode="numeric"
                  value={manualReservationId}
                  onChange={(e) => setManualReservationId(e.target.value)}
                  placeholder="e.g. 55"
                />
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleExpireReservation}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                >
                  Encode Expire Reservation
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard
          title="Runtime Review"
          description="Human-readable review of the selected runtime operation before multisig submission."
        >
          <div className="rounded-3xl border border-border bg-background/70 p-4">
            <pre className="whitespace-pre-wrap wrap-break-word text-xs leading-6 text-foreground">
              {previewSummaryText}
            </pre>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyText(previewSummaryText)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Copy summary
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Encoded Runtime Actions"
          description="Exact core contract calls in execution order for the selected runtime operation."
        >
          <div className="space-y-3">
            {preview.warnings.length > 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-background/70 p-4">
                <div className="text-sm font-semibold text-foreground">
                  Cannot generate executable runtime action yet
                </div>
                <div className="mt-2 space-y-1 text-sm leading-6 text-muted">
                  {preview.warnings.map((warning) => (
                    <div key={warning}>• {warning}</div>
                  ))}
                </div>
              </div>
            ) : null}

            {preview.actions.length > 0 ? (
              <>
                {preview.actions.map((action, index) => (
                  <div
                    key={action.id}
                    className="rounded-3xl border border-border bg-background/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-foreground">
                        {index + 1}. {action.functionName}
                      </div>
                      <div className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                        {action.value} ETH
                      </div>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-muted">
                      {action.summary}
                    </p>

                    <div className="mt-4 space-y-3 text-xs">
                      <div>
                        <div className="mb-1 font-medium text-muted">Target</div>
                        <pre className="overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-border bg-card p-3 text-foreground">
                          {action.target}
                        </pre>
                      </div>

                      <div>
                        <div className="mb-1 font-medium text-muted">Calldata</div>
                        <pre className="overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-border bg-card p-3 text-foreground">
                          {action.data}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Multisig Submission Payload"
          description="Runtime action batch shaped for multisig submitTransaction or submitAndConfirm workflows."
        >
          <div className="rounded-3xl border border-border bg-background/70 p-4">
            <pre className="max-h-140 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-6 text-foreground">
              {JSON.stringify(multisigPayload, null, 2)}
            </pre>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyText(JSON.stringify(multisigPayload, null, 2))}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Copy multisig JSON
            </button>
          </div>
        </SectionCard>

        <MultisigExecutionPanel
          title="Runtime Multisig Handoff"
          description="Wrap the selected runtime action into exact multisig submitTransaction and submitAndConfirm calldata."
          actions={preview.actions}
          defaultMultisigAddress={defaultMultisigAddress}
          multisigResolutionSource={multisigResolutionSource}
          multisigSummary={multisigSummary}
        />

        <SectionCard
          title="Live Sources"
          description="Registered contract endpoints currently feeding the runtime surface."
        >
          <div className="space-y-1">
            <Kvp label="Core" value={coreAddress ?? "—"} />
            <Kvp label="Lens" value={lensAddress ?? "—"} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}