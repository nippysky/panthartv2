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
  WarpoolConfigProposalSavePayload,
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
} from "@/src/features/admin/warpool/types";
import type {
  WarpoolComposerQueueDraft,
  WarpoolConfigProposalDraft,
} from "@/src/features/admin/warpool/multisig-types";
import type { WarpoolRuntimeQueueStatus } from "@/src/features/admin/warpool/runtime-queries";
import MultisigExecutionPanel from "@/src/features/admin/warpool/MultisigExecutionPanel";

type Props = {
  configAddress: string | null;
  latestConfigSnapshot: WarpoolAdminConfigSnapshot | null;
  queueCards: WarpoolAdminQueueCard[];
  runtimeQueues: WarpoolRuntimeQueueStatus[];
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

const RECOMMENDED_TEST_PRESETS: Record<
  QueueDraft["slug"],
  Omit<QueueDraft, "slug">
> = {
  FORGE_SAFEGUARD: {
    enabled: true,
    singleEntryPerWallet: true,
    targetSize: "8",
    minStartSize: "4",
    openDurationSeconds: "900",
    stakeAmountDecimal: "10",
    platformFeeBps: "1000",
    firstPlaceBps: "6000",
    secondPlaceBps: "2000",
    thirdPlaceBps: "1000",
  },
  LEGION_SAFEGUARD: {
    enabled: true,
    singleEntryPerWallet: true,
    targetSize: "8",
    minStartSize: "4",
    openDurationSeconds: "1200",
    stakeAmountDecimal: "25",
    platformFeeBps: "1000",
    firstPlaceBps: "6000",
    secondPlaceBps: "2000",
    thirdPlaceBps: "1000",
  },
  LEGION_VAULTBOUND: {
    enabled: true,
    singleEntryPerWallet: true,
    targetSize: "8",
    minStartSize: "4",
    openDurationSeconds: "1200",
    stakeAmountDecimal: "35",
    platformFeeBps: "500",
    firstPlaceBps: "6500",
    secondPlaceBps: "2000",
    thirdPlaceBps: "1000",
  },
  CROWN_VAULTBOUND: {
    enabled: true,
    singleEntryPerWallet: true,
    targetSize: "8",
    minStartSize: "4",
    openDurationSeconds: "1800",
    stakeAmountDecimal: "50",
    platformFeeBps: "500",
    firstPlaceBps: "6500",
    secondPlaceBps: "2000",
    thirdPlaceBps: "1000",
  },
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

function queueRuntimeStateText(
  runtimeQueues: WarpoolRuntimeQueueStatus[],
  slug: QueueDraft["slug"]
) {
  const runtime = runtimeQueues.find((queue) => queue.slug === slug);
  if (!runtime || !runtime.poolId) return "No active pool";

  switch (runtime.state) {
    case 1:
      return `Open · Pool ${runtime.poolId}`;
    case 2:
      return `Locked · Pool ${runtime.poolId}`;
    case 3:
      return `Battle Ready · Pool ${runtime.poolId}`;
    case 4:
      return `Settling · Pool ${runtime.poolId}`;
    case 5:
      return `Settled · Pool ${runtime.poolId}`;
    case 7:
      return `Expired Refunded · Pool ${runtime.poolId}`;
    default:
      return `Pool ${runtime.poolId}`;
  }
}

function diffSummaryLines(params: {
  current: WarpoolConfigProposalDraft | null;
  encodedSummaryLines: string[];
}) {
  if (params.encodedSummaryLines.length > 0) {
    return params.encodedSummaryLines;
  }

  if (!params.current) {
    return ["This proposal is based on an empty current snapshot."];
  }

  return ["No changes detected yet."];
}

function winnerBeatsStakeAtMinStart(params: {
  minStartSize: number;
  payoutBps: number;
}) {
  return (params.minStartSize * params.payoutBps) / 10000 > 1;
}

export default function WarpoolMultisigComposer({
  configAddress,
  latestConfigSnapshot,
  queueCards,
  runtimeQueues,
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
  const [savedProposalId, setSavedProposalId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTreasury(latestConfigSnapshot?.treasury ?? "");
    setWorkerOperator(latestConfigSnapshot?.workerOperator ?? "");
    setEntriesPaused(latestConfigSnapshot?.entriesPaused ?? false);
    setReservationsPaused(latestConfigSnapshot?.reservationsPaused ?? false);
    setSettlementsPaused(latestConfigSnapshot?.settlementsPaused ?? false);
    setRelicsEnabled(latestConfigSnapshot?.relicsEnabled ?? false);
    setFatigueEnabled(latestConfigSnapshot?.fatigueEnabled ?? false);
    setToken11FeeShareEnabled(latestConfigSnapshot?.token11FeeShareEnabled ?? false);
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
          error instanceof Error ? error.message : "Failed to prepare config actions.",
        ],
        summaryLines: [],
      };
    }
  }, [configAddress, currentDraft, proposal]);

  const reviewLines = React.useMemo(
    () =>
      diffSummaryLines({
        current: currentDraft,
        encodedSummaryLines: encodedPlan.summaryLines,
      }),
    [currentDraft, encodedPlan.summaryLines]
  );

  const savePayload = React.useMemo<WarpoolConfigProposalSavePayload>(() => {
    return {
      title: "Warpool config update",
      summary:
        reviewLines.length > 0
          ? reviewLines.slice(0, 2).join(" · ")
          : "Warpool configuration proposal",
      description:
        "Saved from the Warpool config composer. Review in proposals before multisig submission.",
      basedOnConfigVersion: proposal.basedOnConfigVersion ?? null,
      safeContract: multisigSummary?.contract ?? defaultMultisigAddress ?? null,
      snapshotJson: proposal,
      actions: encodedPlan.actions.map((action, index) => ({
        orderIndex: index,
        label: action.functionName,
        summary: action.summary,
        target: action.target,
        valueWei: action.value,
        tokenAddress: null,
        dataHex: action.data,
        functionName: action.functionName,
        argsJson: action.args,
      })),
    };
  }, [
    defaultMultisigAddress,
    encodedPlan.actions,
    multisigSummary?.contract,
    proposal,
    reviewLines,
  ]);

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

  function applyRecommendedPreset(slug: QueueDraft["slug"]) {
    const preset = RECOMMENDED_TEST_PRESETS[slug];
    setQueues((prev) => prev.map((queue) => (queue.slug === slug ? { slug, ...preset } : queue)));
  }

  function applyAllRecommendedPresets() {
    setQueues(
      WARPOOL_QUEUE_ORDER.map((slug) => ({
        slug,
        ...RECOMMENDED_TEST_PRESETS[slug],
      }))
    );
  }

  function resetToLiveSnapshot() {
    setTreasury(latestConfigSnapshot?.treasury ?? "");
    setWorkerOperator(latestConfigSnapshot?.workerOperator ?? "");
    setEntriesPaused(latestConfigSnapshot?.entriesPaused ?? false);
    setReservationsPaused(latestConfigSnapshot?.reservationsPaused ?? false);
    setSettlementsPaused(latestConfigSnapshot?.settlementsPaused ?? false);
    setRelicsEnabled(latestConfigSnapshot?.relicsEnabled ?? false);
    setFatigueEnabled(latestConfigSnapshot?.fatigueEnabled ?? false);
    setToken11FeeShareEnabled(latestConfigSnapshot?.token11FeeShareEnabled ?? false);
    setToken11FeeShareBps(String(latestConfigSnapshot?.token11FeeShareBps ?? 0));
    setQueues(normalizeQueueCards(queueCards));
  }

  async function handleSaveProposal(payload: WarpoolConfigProposalSavePayload) {
    const res = await fetch("/api/admin/warpool/proposals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json()) as {
      ok?: boolean;
      proposalId?: string;
      error?: string;
    };

    if (!res.ok || !json.ok || !json.proposalId) {
      throw new Error(json.error || "Failed to save proposal.");
    }

    setSavedProposalId(json.proposalId);
    return { proposalId: json.proposalId };
  }

  function openProposalsPage() {
    window.location.href = window.location.pathname.replace(/\/config$/, "/proposals");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <SectionCard
          title="Configuration"
          description="Adjust Warpool rules and queue settings, then save a clean multisig-ready config proposal for shared admin review."
        >
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
              <Label hint="Automation / worker operator">Worker operator</Label>
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

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Toggle
              checked={entriesPaused}
              onChange={setEntriesPaused}
              label="Entries"
              description="Pause or allow players to join queues."
            />
            <Toggle
              checked={reservationsPaused}
              onChange={setReservationsPaused}
              label="Reservations"
              description="Pause or allow relic reservation flow."
            />
            <Toggle
              checked={settlementsPaused}
              onChange={setSettlementsPaused}
              label="Settlements"
              description="Pause or allow pool settlement actions."
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
              description="Enable or disable fighter fatigue logic."
            />
            <Toggle
              checked={token11FeeShareEnabled}
              onChange={setToken11FeeShareEnabled}
              label="Token11 fee share"
              description="Enable or disable Token11 fee sharing."
            />
          </div>

          <div className="mt-4 max-w-sm">
            <Label hint="Basis points">Token11 fee share BPS</Label>
            <TextInput
              inputMode="numeric"
              value={token11FeeShareBps}
              onChange={(e) => setToken11FeeShareBps(e.target.value)}
              placeholder="0"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Queue settings"
          description="Each queue gets proper breathing room here. Apply recommended test presets or edit each queue individually before saving."
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyAllRecommendedPresets}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90"
            >
              Apply recommended presets to all queues
            </button>

            <button
              type="button"
              onClick={resetToLiveSnapshot}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Reset to live values
            </button>
          </div>

          <div className="space-y-4">
            {queues.map((queue) => {
              const meta = WARPOOL_QUEUE_META[queue.slug];
              const runtimeText = queueRuntimeStateText(runtimeQueues, queue.slug);

              const minStart = Number(queue.minStartSize || 0);
              const firstBps = Number(queue.firstPlaceBps || 0);
              const winnerPositive = winnerBeatsStakeAtMinStart({
                minStartSize: minStart,
                payoutBps: firstBps,
              });

              const totalBps =
                Number(queue.platformFeeBps || 0) +
                Number(queue.firstPlaceBps || 0) +
                Number(queue.secondPlaceBps || 0) +
                Number(queue.thirdPlaceBps || 0);

              return (
                <div
                  key={queue.slug}
                  className="rounded-[28px] border border-border bg-background/60 p-4 md:p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold tracking-tight text-foreground">
                          {meta.title}
                        </div>
                        <Pill>{meta.badge}</Pill>
                        <Pill tone={queue.enabled ? "good" : "warn"}>
                          {queue.enabled ? "Enabled" : "Disabled"}
                        </Pill>
                      </div>

                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                        {meta.description}
                      </p>

                      <div className="mt-3 rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-muted">
                        Live status:{" "}
                        <span className="font-medium text-foreground">{runtimeText}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyRecommendedPreset(queue.slug)}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background"
                      >
                        Apply preset
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
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
                        onChange={(e) => updateQueue(queue.slug, "targetSize", e.target.value)}
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
                      <Label hint="Must total 10000 with fee">Payout split</Label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <TextInput
                          inputMode="numeric"
                          value={queue.firstPlaceBps}
                          onChange={(e) =>
                            updateQueue(queue.slug, "firstPlaceBps", e.target.value)
                          }
                          placeholder="1st place"
                        />
                        <TextInput
                          inputMode="numeric"
                          value={queue.secondPlaceBps}
                          onChange={(e) =>
                            updateQueue(queue.slug, "secondPlaceBps", e.target.value)
                          }
                          placeholder="2nd place"
                        />
                        <TextInput
                          inputMode="numeric"
                          value={queue.thirdPlaceBps}
                          onChange={(e) =>
                            updateQueue(queue.slug, "thirdPlaceBps", e.target.value)
                          }
                          placeholder="3rd place"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted">
                      Stake preview:{" "}
                      <span className="font-medium text-foreground">
                        {formatTokenAmount(
                          parseTokenDecimalToRaw(queue.stakeAmountDecimal || "0", 18)
                        )}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted">
                      Window:{" "}
                      <span className="font-medium text-foreground">
                        {formatDurationSeconds(Number(queue.openDurationSeconds || 0))}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted">
                      Payout:{" "}
                      <span className="font-medium text-foreground">
                        {formatBps(Number(queue.firstPlaceBps || 0))} /{" "}
                        {formatBps(Number(queue.secondPlaceBps || 0))} /{" "}
                        {formatBps(Number(queue.thirdPlaceBps || 0))}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted">
                      Total BPS:{" "}
                      <span
                        className={
                          totalBps === 10000
                            ? "font-medium text-foreground"
                            : "font-medium text-amber-600 dark:text-amber-400"
                        }
                      >
                        {totalBps}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone={winnerPositive ? "good" : "warn"}>
                      {winnerPositive
                        ? "1st place beats stake at min start"
                        : "1st place too low at min start"}
                    </Pill>

                    <Pill tone={totalBps === 10000 ? "good" : "warn"}>
                      {totalBps === 10000 ? "BPS balanced" : "BPS must equal 10000"}
                    </Pill>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard
          title="Review"
          description="Review only the actual changes that will be saved into the shared admin proposal registry."
        >
          <div className="rounded-3xl border border-border bg-background/70 p-4">
            {reviewLines.length > 0 ? (
              <div className="space-y-2">
                {reviewLines.map((line) => (
                  <div key={line} className="text-sm leading-6 text-foreground">
                    • {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted">No changes detected yet.</div>
            )}
          </div>

          {encodedPlan.warnings.length > 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-border bg-background/70 p-4">
              <div className="text-sm font-semibold text-foreground">
                Fix these before saving
              </div>
              <div className="mt-2 space-y-1 text-sm leading-6 text-muted">
                {encodedPlan.warnings.map((warning) => (
                  <div key={warning}>• {warning}</div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Config version
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {proposal.basedOnConfigVersion ?? "—"}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Actions prepared
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {encodedPlan.actions.length}
              </div>
            </div>
          </div>
        </SectionCard>

        <MultisigExecutionPanel
          title="Save proposal"
          description="Save this configuration change as a shared admin proposal first. Submission, confirmation, and execution should happen from the proposals flow."
          actions={encodedPlan.actions}
          defaultMultisigAddress={defaultMultisigAddress}
          multisigResolutionSource={multisigResolutionSource}
          multisigSummary={multisigSummary}
          savePayload={savePayload}
          existingProposalId={savedProposalId}
          onSaveProposal={handleSaveProposal}
          onOpenProposals={openProposalsPage}
        />

        <details className="rounded-[28px] border border-border bg-card p-5 md:p-6">
          <summary className="cursor-pointer list-none text-[15px] font-semibold tracking-tight text-foreground">
            Advanced technical details
          </summary>

          <div className="mt-5 space-y-6">
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Proposal JSON</div>
              <pre className="max-h-120 overflow-auto whitespace-pre-wrap break-all rounded-3xl border border-border bg-background/70 p-4 text-xs leading-6 text-foreground">
                {JSON.stringify(proposal, null, 2)}
              </pre>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Encoded actions</div>
              <pre className="max-h-120 overflow-auto whitespace-pre-wrap break-all rounded-3xl border border-border bg-background/70 p-4 text-xs leading-6 text-foreground">
                {JSON.stringify(
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
                )}
              </pre>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}