"use client";

import * as React from "react";
import { ethers } from "ethers";

import {
  WARPOOL_QUEUE_META,
  WARPOOL_QUEUE_ORDER,
  formatBps,
  formatDurationSeconds,
  formatTokenAmount,
  parseTokenDecimalToRaw,
} from "@/src/features/admin/warpool/constants";
import { encodeWarpoolConfigActions } from "@/src/features/admin/warpool/encodeConfigActions";
import type {
  WarpoolAdminConfigSnapshot,
  WarpoolAdminQueueCard,
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
} from "@/src/features/admin/warpool/types";
import type {
  WarpoolComposerQueueDraft,
  WarpoolConfigProposalDraft,
} from "@/src/features/admin/warpool/multisig-types";
import MultisigExecutionPanel from "@/src/features/admin/warpool/MultisigExecutionPanel";

type Props = {
  configAddress: string | null;
  latestConfigSnapshot: WarpoolAdminConfigSnapshot | null;
  queueCards: WarpoolAdminQueueCard[];
  defaultMultisigAddress?: string | null;
  multisigResolutionSource?: WarpoolMultisigResolutionSource | null;
  multisigSummary?: WarpoolMultisigSummary | null;
};

type QueueDraft = {
  slug: WarpoolComposerQueueDraft["slug"];
  enabled: boolean;
  singleEntryPerWallet: boolean;
  targetSize: string;
  minStartSize: string;
  openDurationSeconds: string;
  stakeAmountDecimal: string;
  platformFeeBps: string;
  firstPlaceBps: string;
  secondPlaceBps: string;
  thirdPlaceBps: string;
};

function normalizeQueueCards(queueCards: WarpoolAdminQueueCard[]) {
  const map = new Map(queueCards.map((item) => [item.slug, item]));

  return WARPOOL_QUEUE_ORDER.map((slug) => {
    const queue = map.get(slug);

    return {
      slug,
      enabled: queue?.enabled ?? false,
      singleEntryPerWallet: queue?.singleEntryPerWallet ?? true,
      targetSize: String(queue?.targetSize ?? 0),
      minStartSize: String(queue?.minStartSize ?? 0),
      openDurationSeconds: String(queue?.openDurationSeconds ?? 0),
      stakeAmountDecimal: queue ? rawToDecimalString(queue.stakeAmountRaw, 18) : "0",
      platformFeeBps: String(queue?.platformFeeBps ?? 0),
      firstPlaceBps: String(queue?.firstPlaceBps ?? 0),
      secondPlaceBps: String(queue?.secondPlaceBps ?? 0),
      thirdPlaceBps: String(queue?.thirdPlaceBps ?? 0),
    } satisfies QueueDraft;
  });
}

function rawToDecimalString(raw: string, decimals = 18) {
  if (!/^\d+$/.test(raw)) return raw;

  const value = BigInt(raw);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  if (fraction === BigInt(0)) return whole.toString();

  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${whole.toString()}.${fractionStr}`;
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

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-3xl border border-border bg-background/70 p-4 text-left transition hover:bg-background"
    >
      <div>
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {description ? (
          <div className="mt-1 text-sm leading-6 text-muted">{description}</div>
        ) : null}
      </div>

      <div
        className={[
          "relative mt-1 h-6 w-11 rounded-full border transition",
          checked ? "border-foreground bg-foreground" : "border-border bg-card",
        ].join(" ")}
      >
        <div
          className={[
            "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all",
            checked ? "left-5.5" : "left-0.5",
          ].join(" ")}
        />
      </div>
    </button>
  );
}

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

export default function WarpoolMultisigComposer({
  configAddress,
  latestConfigSnapshot,
  queueCards,
  defaultMultisigAddress = null,
  multisigResolutionSource = null,
    multisigSummary = null,
}: Props) {
  const [treasury, setTreasury] = React.useState(latestConfigSnapshot?.treasury ?? "");
  const [workerOperator, setWorkerOperator] = React.useState(
    latestConfigSnapshot?.workerOperator ?? ""
  );

  const [entriesPaused, setEntriesPaused] = React.useState(
    latestConfigSnapshot?.entriesPaused ?? false
  );
  const [reservationsPaused, setReservationsPaused] = React.useState(
    latestConfigSnapshot?.reservationsPaused ?? false
  );
  const [settlementsPaused, setSettlementsPaused] = React.useState(
    latestConfigSnapshot?.settlementsPaused ?? false
  );
  const [relicsEnabled, setRelicsEnabled] = React.useState(
    latestConfigSnapshot?.relicsEnabled ?? false
  );
  const [fatigueEnabled, setFatigueEnabled] = React.useState(
    latestConfigSnapshot?.fatigueEnabled ?? false
  );
  const [token11FeeShareEnabled, setToken11FeeShareEnabled] = React.useState(
    latestConfigSnapshot?.token11FeeShareEnabled ?? false
  );
  const [token11FeeShareBps, setToken11FeeShareBps] = React.useState(
    String(latestConfigSnapshot?.token11FeeShareBps ?? 0)
  );

  const [queues, setQueues] = React.useState<QueueDraft[]>(() =>
    normalizeQueueCards(queueCards)
  );

  React.useEffect(() => {
    setTreasury(latestConfigSnapshot?.treasury ?? "");
    setWorkerOperator(latestConfigSnapshot?.workerOperator ?? "");
    setEntriesPaused(latestConfigSnapshot?.entriesPaused ?? false);
    setReservationsPaused(latestConfigSnapshot?.reservationsPaused ?? false);
    setSettlementsPaused(latestConfigSnapshot?.settlementsPaused ?? false);
    setRelicsEnabled(latestConfigSnapshot?.relicsEnabled ?? false);
    setFatigueEnabled(latestConfigSnapshot?.fatigueEnabled ?? false);
    setToken11FeeShareEnabled(
      latestConfigSnapshot?.token11FeeShareEnabled ?? false
    );
    setToken11FeeShareBps(String(latestConfigSnapshot?.token11FeeShareBps ?? 0));
  }, [latestConfigSnapshot]);

  React.useEffect(() => {
    setQueues(normalizeQueueCards(queueCards));
  }, [queueCards]);

  const currentDraft = React.useMemo<WarpoolConfigProposalDraft | null>(() => {
    if (!latestConfigSnapshot) return null;

    return {
      mode: "warpool-config-draft",
      basedOnConfigVersion: latestConfigSnapshot.configVersion.toString(),
      global: {
        treasury: latestConfigSnapshot.treasury ?? null,
        workerOperator: latestConfigSnapshot.workerOperator ?? null,
        entriesPaused: latestConfigSnapshot.entriesPaused,
        reservationsPaused: latestConfigSnapshot.reservationsPaused,
        settlementsPaused: latestConfigSnapshot.settlementsPaused,
        relicsEnabled: latestConfigSnapshot.relicsEnabled,
        fatigueEnabled: latestConfigSnapshot.fatigueEnabled,
        token11FeeShareEnabled: latestConfigSnapshot.token11FeeShareEnabled,
        token11FeeShareBps: latestConfigSnapshot.token11FeeShareBps,
      },
      queues: queueCards.map((queue) => ({
        slug: queue.slug,
        enabled: queue.enabled,
        singleEntryPerWallet: queue.singleEntryPerWallet,
        targetSize: Number(queue.targetSize),
        minStartSize: Number(queue.minStartSize),
        openDurationSeconds: Number(queue.openDurationSeconds),
        stakeAmountRaw: String(queue.stakeAmountRaw),
        platformFeeBps: Number(queue.platformFeeBps),
        firstPlaceBps: Number(queue.firstPlaceBps),
        secondPlaceBps: Number(queue.secondPlaceBps),
        thirdPlaceBps: Number(queue.thirdPlaceBps),
      })),
    };
  }, [latestConfigSnapshot, queueCards]);

  const proposal = React.useMemo<WarpoolConfigProposalDraft>(() => {
    return {
      mode: "warpool-config-draft",
      basedOnConfigVersion: latestConfigSnapshot?.configVersion.toString() ?? null,
      global: {
        treasury: treasury || null,
        workerOperator: workerOperator || null,
        entriesPaused,
        reservationsPaused,
        settlementsPaused,
        relicsEnabled,
        fatigueEnabled,
        token11FeeShareEnabled,
        token11FeeShareBps: Number(token11FeeShareBps || 0),
      },
      queues: queues.map((queue) => ({
        slug: queue.slug,
        enabled: queue.enabled,
        singleEntryPerWallet: queue.singleEntryPerWallet,
        targetSize: Number(queue.targetSize || 0),
        minStartSize: Number(queue.minStartSize || 0),
        openDurationSeconds: Number(queue.openDurationSeconds || 0),
        stakeAmountRaw: parseTokenDecimalToRaw(queue.stakeAmountDecimal || "0", 18),
        platformFeeBps: Number(queue.platformFeeBps || 0),
        firstPlaceBps: Number(queue.firstPlaceBps || 0),
        secondPlaceBps: Number(queue.secondPlaceBps || 0),
        thirdPlaceBps: Number(queue.thirdPlaceBps || 0),
      })),
    };
  }, [
    entriesPaused,
    fatigueEnabled,
    latestConfigSnapshot?.configVersion,
    queues,
    relicsEnabled,
    reservationsPaused,
    settlementsPaused,
    token11FeeShareBps,
    token11FeeShareEnabled,
    treasury,
    workerOperator,
  ]);

  const encodedPlan = React.useMemo(() => {
    if (!configAddress || !ethers.isAddress(configAddress)) {
      return {
        target: null,
        actions: [],
        warnings: ["Config contract address is missing or invalid."],
        summaryLines: [],
      };
    }

    try {
      return encodeWarpoolConfigActions({
        configAddress,
        current: currentDraft,
        next: proposal,
      });
    } catch (error) {
      return {
        target: null,
        actions: [],
        warnings: [
          error instanceof Error ? error.message : "Failed to encode config actions.",
        ],
        summaryLines: [],
      };
    }
  }, [configAddress, currentDraft, proposal]);

  const summaryText = React.useMemo(() => {
    const lines: string[] = [];

    lines.push("Warpool multisig proposal summary");
    lines.push("");
    lines.push(`Base config version: ${proposal.basedOnConfigVersion ?? "none"}`);
    lines.push(`Config contract: ${configAddress ?? "unset"}`);
    lines.push(`Treasury: ${proposal.global.treasury ?? "unset"}`);
    lines.push(`Worker operator: ${proposal.global.workerOperator ?? "unset"}`);
    lines.push(`Entries paused: ${proposal.global.entriesPaused ? "yes" : "no"}`);
    lines.push(
      `Reservations paused: ${proposal.global.reservationsPaused ? "yes" : "no"}`
    );
    lines.push(
      `Settlements paused: ${proposal.global.settlementsPaused ? "yes" : "no"}`
    );
    lines.push(`Relics enabled: ${proposal.global.relicsEnabled ? "yes" : "no"}`);
    lines.push(`Fatigue enabled: ${proposal.global.fatigueEnabled ? "yes" : "no"}`);
    lines.push(
      `Token11 fee share: ${
        proposal.global.token11FeeShareEnabled ? "enabled" : "disabled"
      } at ${formatBps(proposal.global.token11FeeShareBps)}`
    );
    lines.push("");
    lines.push("Queues");
    lines.push("");

    for (const queue of proposal.queues) {
      const meta = WARPOOL_QUEUE_META[queue.slug];
      lines.push(`- ${meta.title}`);
      lines.push(`  enabled: ${queue.enabled ? "yes" : "no"}`);
      lines.push(`  target size: ${queue.targetSize}`);
      lines.push(`  min start size: ${queue.minStartSize}`);
      lines.push(`  open window: ${formatDurationSeconds(queue.openDurationSeconds)}`);
      lines.push(`  stake: ${formatTokenAmount(queue.stakeAmountRaw)}`);
      lines.push(`  single entry: ${queue.singleEntryPerWallet ? "yes" : "no"}`);
      lines.push(
        `  fees: platform ${formatBps(queue.platformFeeBps)} | payouts ${formatBps(
          queue.firstPlaceBps
        )} / ${formatBps(queue.secondPlaceBps)} / ${formatBps(queue.thirdPlaceBps)}`
      );
      lines.push("");
    }

    if (encodedPlan.summaryLines.length > 0) {
      lines.push("Detected action changes");
      lines.push("");
      for (const line of encodedPlan.summaryLines) {
        lines.push(`- ${line}`);
      }
      lines.push("");
    }

    if (encodedPlan.warnings.length > 0) {
      lines.push("Warnings");
      lines.push("");
      for (const warning of encodedPlan.warnings) {
        lines.push(`- ${warning}`);
      }
      lines.push("");
    }

    lines.push(`Encoded actions: ${encodedPlan.actions.length}`);

    return lines.join("\n");
  }, [configAddress, encodedPlan.actions.length, encodedPlan.summaryLines, encodedPlan.warnings, proposal]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op
    }
  }

  function updateQueue<K extends keyof QueueDraft>(
    slug: QueueDraft["slug"],
    key: K,
    value: QueueDraft[K]
  ) {
    setQueues((prev) =>
      prev.map((queue) =>
        queue.slug === slug ? { ...queue, [key]: value } : queue
      )
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <SectionCard
          title="Multisig Config Composer"
          description="Stage the next Warpool configuration set from the latest indexed snapshot. This panel prepares the exact operator payload and encoded config calls for multisig execution."
        >
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label hint="Global payout receiver">Treasury address</Label>
                <TextInput
                  value={treasury}
                  onChange={(e) => setTreasury(e.target.value)}
                  placeholder="0x..."
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>

              <div>
                <Label hint="Worker / automation operator">Worker address</Label>
                <TextInput
                  value={workerOperator}
                  onChange={(e) => setWorkerOperator(e.target.value)}
                  placeholder="0x..."
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Toggle
                checked={entriesPaused}
                onChange={setEntriesPaused}
                label="Entries"
                description="Pause or allow new queue entries."
              />
              <Toggle
                checked={reservationsPaused}
                onChange={setReservationsPaused}
                label="Reservations"
                description="Pause or allow reservation flow."
              />
              <Toggle
                checked={settlementsPaused}
                onChange={setSettlementsPaused}
                label="Settlements"
                description="Pause or allow settlement operations."
              />
              <Toggle
                checked={relicsEnabled}
                onChange={setRelicsEnabled}
                label="Relics"
                description="Enable or disable relic-based mechanics."
              />
              <Toggle
                checked={fatigueEnabled}
                onChange={setFatigueEnabled}
                label="Fatigue"
                description="Enable or disable fatigue logic."
              />
              <Toggle
                checked={token11FeeShareEnabled}
                onChange={setToken11FeeShareEnabled}
                label="Token11 fee share"
                description="Enable fee sharing to Token11 holders."
              />
            </div>

            <div className="max-w-sm">
              <Label hint="Basis points">Token11 fee share BPS</Label>
              <TextInput
                inputMode="numeric"
                value={token11FeeShareBps}
                onChange={(e) => setToken11FeeShareBps(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Queue Overrides"
          description="Tune each queue independently. Stake is entered in human-readable DCNT and converted into raw 18-decimal amount for the final payload."
        >
          <div className="space-y-4">
            {queues.map((queue) => {
              const meta = WARPOOL_QUEUE_META[queue.slug];

              return (
                <div
                  key={queue.slug}
                  className="rounded-[28px] border border-border bg-background/60 p-4 md:p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-base font-semibold tracking-tight text-foreground">
                        {meta.title}
                      </div>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                        {meta.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Pill>{meta.badge}</Pill>
                      <Pill tone={queue.enabled ? "good" : "warn"}>
                        {queue.enabled ? "Enabled" : "Disabled"}
                      </Pill>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Toggle
                      checked={queue.enabled}
                      onChange={(value) => updateQueue(queue.slug, "enabled", value)}
                      label="Queue enabled"
                    />
                    <Toggle
                      checked={queue.singleEntryPerWallet}
                      onChange={(value) =>
                        updateQueue(queue.slug, "singleEntryPerWallet", value)
                      }
                      label="Single entry per wallet"
                    />

                    <div>
                      <Label>Target size</Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.targetSize}
                        onChange={(e) =>
                          updateQueue(queue.slug, "targetSize", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label>Min start size</Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.minStartSize}
                        onChange={(e) =>
                          updateQueue(queue.slug, "minStartSize", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label hint="Seconds">Open duration</Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.openDurationSeconds}
                        onChange={(e) =>
                          updateQueue(queue.slug, "openDurationSeconds", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label hint="DCNT">Stake amount</Label>
                      <TextInput
                        inputMode="decimal"
                        value={queue.stakeAmountDecimal}
                        onChange={(e) =>
                          updateQueue(queue.slug, "stakeAmountDecimal", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label hint="Basis points">Platform fee</Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.platformFeeBps}
                        onChange={(e) =>
                          updateQueue(queue.slug, "platformFeeBps", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label hint="Basis points">1st place</Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.firstPlaceBps}
                        onChange={(e) =>
                          updateQueue(queue.slug, "firstPlaceBps", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label hint="Basis points">2nd place</Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.secondPlaceBps}
                        onChange={(e) =>
                          updateQueue(queue.slug, "secondPlaceBps", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label hint="Basis points">3rd place</Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.thirdPlaceBps}
                        onChange={(e) =>
                          updateQueue(queue.slug, "thirdPlaceBps", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard
          title="Operator Review"
          description="Human-readable summary for review before submitting the multisig batch."
        >
          <div className="rounded-3xl border border-border bg-background/70 p-4">
            <pre className="whitespace-pre-wrap wrap-break-word text-xs leading-6 text-foreground">
              {summaryText}
            </pre>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyText(summaryText)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Copy summary
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Generated Payload"
          description="Structured proposal payload for review, storage, or handoff into proposer tooling."
        >
          <div className="rounded-3xl border border-border bg-background/70 p-4">
            <pre className="max-h-180 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-6 text-foreground">
              {JSON.stringify(proposal, null, 2)}
            </pre>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyText(JSON.stringify(proposal, null, 2))}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Copy JSON
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Encoded Multisig Actions"
          description="Exact config contract calls in execution order. These are the actions the Safe or multisig batch should execute."
        >
          <div className="space-y-3">
            {encodedPlan.warnings.length > 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-background/70 p-4">
                <div className="text-sm font-semibold text-foreground">
                  Cannot generate executable action batch yet
                </div>
                <div className="mt-2 space-y-1 text-sm leading-6 text-muted">
                  {encodedPlan.warnings.map((warning) => (
                    <div key={warning}>• {warning}</div>
                  ))}
                </div>
              </div>
            ) : null}

            {encodedPlan.actions.length > 0 ? (
              <>
                {encodedPlan.actions.map((action, index) => (
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

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        JSON.stringify(
                          encodedPlan.actions.map((action) => ({
                            to: action.target,
                            value: action.value,
                            data: action.data,
                            contractMethod: action.functionName,
                            args: action.args,
                            summary: action.summary,
                          })),
                          null,
                          2
                        )
                      )
                    }
                    className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                  >
                    Copy action batch JSON
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </SectionCard>

  <MultisigExecutionPanel
  title="Config Multisig Handoff"
  description="Wrap the encoded config actions into exact multisig submitTransaction and submitAndConfirm calldata."
  actions={encodedPlan.actions}
  defaultMultisigAddress={defaultMultisigAddress}
  multisigResolutionSource={multisigResolutionSource}
  multisigSummary={multisigSummary}
/>

        <SectionCard
          title="Next Wiring"
          description="This UI now prepares real config contract action batches. The next layer is proposal persistence or direct Safe handoff."
        >
          <div className="space-y-3 text-sm leading-6 text-muted">
            <p>
              Recommended next step is a proposal review flow that stores draft
              metadata, signer notes, action count, and final export payload before
              execution.
            </p>
            <p>
              After that, you can add Safe-specific export formatting or a direct
              multisig creation route without changing this composer surface.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}