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
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
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
  title: "No action selected yet",
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

function suggestedPrimaryAction(queue: WarpoolRuntimeQueueStatus) {
  if (!queue.poolId) return "Open pool";
  if (queue.state === 1) return "Process expired pool";
  if (queue.state === 2) return "Mark battle ready";
  if (queue.state === 3) return "Prepare settlement";
  return "Review queue";
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
      banner = `Prepared expired-pool action for pool ${prefill.payload.poolId}.`;
    }

    if (prefill.payload.type === "MARK_BATTLE_READY") {
      setManualPoolId(prefill.payload.poolId);
      nextFocus = "utility";
      banner = `Prepared battle-ready action for pool ${prefill.payload.poolId}.`;
    }

    if (prefill.payload.type === "SETTLE_POOL") {
      setSettlePoolId(prefill.payload.poolId);
      nextFocus = "settlement";
      banner = `Prepared settlement flow for pool ${prefill.payload.poolId}.`;
    }

    if (prefill.payload.type === "EXPIRE_RESERVATION") {
      setManualReservationId(prefill.payload.reservationId);
      nextFocus = "utility";
      banner = `Prepared reservation expiry for reservation ${prefill.payload.reservationId}.`;
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
      setErrorPreview("Open pool", "Core contract address is missing or invalid.");
      return;
    }

    try {
      const plan = encodeOpenPoolAction({
        coreAddress,
        queueSlug,
      });

      setPreview({
        title: `Open pool · ${WARPOOL_QUEUE_META[queueSlug].title}`,
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Open pool",
        error instanceof Error ? error.message : "Failed to prepare open-pool action."
      );
    }
  }

  function handleProcessExpired(poolId?: string | null) {
    const selectedPoolId = poolId ?? manualPoolId;

    if (!coreAddress || !ethers.isAddress(coreAddress)) {
      setErrorPreview("Process expired pool", "Core contract address is missing or invalid.");
      return;
    }

    try {
      const plan = encodeProcessExpiredPoolAction({
        coreAddress,
        poolId: selectedPoolId,
      });

      setPreview({
        title: "Process expired pool",
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Process expired pool",
        error instanceof Error
          ? error.message
          : "Failed to prepare process-expired action."
      );
    }
  }

  function handleMarkBattleReady(poolId?: string | null) {
    const selectedPoolId = poolId ?? manualPoolId;

    if (!coreAddress || !ethers.isAddress(coreAddress)) {
      setErrorPreview("Mark battle ready", "Core contract address is missing or invalid.");
      return;
    }

    try {
      const plan = encodeMarkBattleReadyAction({
        coreAddress,
        poolId: selectedPoolId,
      });

      setPreview({
        title: "Mark battle ready",
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Mark battle ready",
        error instanceof Error
          ? error.message
          : "Failed to prepare battle-ready action."
      );
    }
  }

  function handleExpireReservation() {
    if (!coreAddress || !ethers.isAddress(coreAddress)) {
      setErrorPreview("Expire reservation", "Core contract address is missing or invalid.");
      return;
    }

    try {
      const plan = encodeExpireReservationAction({
        coreAddress,
        reservationId: manualReservationId,
      });

      setPreview({
        title: "Expire reservation",
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Expire reservation",
        error instanceof Error
          ? error.message
          : "Failed to prepare reservation-expiry action."
      );
    }
  }

  function handleSettlePool() {
    if (!coreAddress || !ethers.isAddress(coreAddress)) {
      setErrorPreview("Prepare settlement", "Core contract address is missing or invalid.");
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
        title: "Prepare settlement",
        target: plan.target,
        warnings: plan.warnings,
        summaryLines: plan.summaryLines,
        actions: plan.actions,
      });
    } catch (error) {
      setErrorPreview(
        "Prepare settlement",
        error instanceof Error ? error.message : "Failed to prepare settlement action."
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

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        {prefillBanner ? (
          <div className="rounded-3xl border border-foreground/20 bg-background/80 p-4 text-sm text-foreground">
            {prefillBanner}
          </div>
        ) : null}

        <SectionCard
          title="Live queue operations"
          description="Open pool means: prepare the real on-chain openPool action for multisig approval. It does not silently execute by itself."
          tone={focusSection === "queues" ? "highlight" : "default"}
          sectionRef={queueSectionRef}
        >
          {(warnings.length > 0 || !lensAddress) && (
            <div className="mb-4 rounded-3xl border border-dashed border-border bg-background/70 p-4">
              <div className="text-sm font-semibold text-foreground">Live read notes</div>
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
                      <p className="mt-1 text-xs leading-5 text-muted">{meta.description}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Pill>{meta.badge}</Pill>
                      <Pill tone={hasActivePool ? "good" : "warn"}>
                        {hasActivePool ? "Live" : "Idle"}
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
                    <Kvp label="Primary action" value={suggestedPrimaryAction(queue)} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!queue.poolId ? (
                      <button
                        type="button"
                        onClick={() => handleQueueOpen(queue.slug)}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                      >
                        Open pool
                      </button>
                    ) : null}

                    {queue.poolId && queue.state === 1 ? (
                      <button
                        type="button"
                        onClick={() => handleProcessExpired(queue.poolId)}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                      >
                        Process expired pool
                      </button>
                    ) : null}

                    {queue.poolId && queue.state === 2 ? (
                      <button
                        type="button"
                        onClick={() => handleMarkBattleReady(queue.poolId)}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                      >
                        Mark battle ready
                      </button>
                    ) : null}

                    {queue.poolId && queue.state === 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSettlePoolId(queue.poolId ?? "");
                          setFocusSection("settlement");
                          settlementSectionRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                      >
                        Prepare settlement
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Settlement"
          description="Enter the final winner entry IDs in 1st / 2nd / 3rd order, then prepare the settlement action for multisig."
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
              Prepare settlement
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Manual utilities"
          description="Use these only when you already know the exact pool or reservation you want to act on."
          tone={focusSection === "utility" ? "highlight" : "default"}
          sectionRef={utilitySectionRef}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-sm font-semibold text-foreground">Pool utilities</div>
              <p className="mt-1 text-sm leading-6 text-muted">
                Prepare process-expired or battle-ready actions by pool ID.
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
                  Process expired pool
                </button>

                <button
                  type="button"
                  onClick={() => handleMarkBattleReady()}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                >
                  Mark battle ready
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-sm font-semibold text-foreground">Reservation utility</div>
              <p className="mt-1 text-sm leading-6 text-muted">
                Prepare reservation expiry for a specific overdue active reservation.
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
                  Expire reservation
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard
          title="Action review"
          description="The selected runtime action appears here before it is sent to multisig."
        >
          <div className="rounded-3xl border border-border bg-background/70 p-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">{preview.title}</div>

              {preview.target ? (
                <div className="text-sm text-muted">
                  Target contract:{" "}
                  <span className="font-medium text-foreground">{preview.target}</span>
                </div>
              ) : null}

              {preview.summaryLines.length > 0 ? (
                <div className="pt-2 space-y-2">
                  {preview.summaryLines.map((line) => (
                    <div key={line} className="text-sm leading-6 text-foreground">
                      • {line}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">
                  Select a queue action, prepare settlement, or use a manual utility to continue.
                </div>
              )}

              {preview.warnings.length > 0 ? (
                <div className="pt-2 space-y-1 text-sm leading-6 text-amber-600 dark:text-amber-400">
                  {preview.warnings.map((warning) => (
                    <div key={warning}>• {warning}</div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <MultisigExecutionPanel
          title="Submit runtime proposal"
          description="Send this runtime action to multisig. Clicking actions on the queue cards only prepares the action — the chain changes only after multisig approval."
          actions={preview.actions}
          defaultMultisigAddress={defaultMultisigAddress}
          multisigResolutionSource={multisigResolutionSource}
          multisigSummary={multisigSummary}
        />

        <details className="rounded-[28px] border border-border bg-card p-5 md:p-6">
          <summary className="cursor-pointer list-none text-[15px] font-semibold tracking-tight text-foreground">
            Advanced runtime details
          </summary>

          <div className="mt-5 space-y-6">
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Encoded actions</div>
              <pre className="max-h-120 overflow-auto whitespace-pre-wrap break-all rounded-3xl border border-border bg-background/70 p-4 text-xs leading-6 text-foreground">
                {JSON.stringify(preview.actions, null, 2)}
              </pre>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Multisig payload</div>
              <pre className="max-h-120 overflow-auto whitespace-pre-wrap break-all rounded-3xl border border-border bg-background/70 p-4 text-xs leading-6 text-foreground">
                {JSON.stringify(multisigPayload, null, 2)}
              </pre>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Live sources</div>
              <div className="rounded-3xl border border-border bg-background/70 p-4">
                <div className="space-y-1">
                  <Kvp label="Core" value={coreAddress ?? "—"} />
                  <Kvp label="Lens" value={lensAddress ?? "—"} />
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}