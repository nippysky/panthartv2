// src/features/admin/warpool/WarpoolMultisigComposer.tsx
"use client";

import * as React from "react";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";

import {
  WARPOOL_QUEUE_META,
  WARPOOL_QUEUE_ORDER,
  formatBps,
  formatDurationSeconds,
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
import type { WarpoolRuntimeQueueStatus } from "@/src/features/admin/warpool/runtime-queries";
import {
  dwGetAccounts,
  useDecentWalletAccount,
} from "@/src/lib/decentWallet";

type Props = {
  slug: string;
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

type SaveState =
  | { kind: "idle"; message: null }
  | { kind: "saving"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function normalizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function normalizeTokenDecimalInput(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/\s+/g, "");
  if (!cleaned) return "";

  const hasLeadingDot = cleaned.startsWith(".");
  const [wholeRaw, ...fractionParts] = cleaned.split(".");
  const whole = wholeRaw.replace(/[^\d]/g, "");
  const fraction = fractionParts.join("").replace(/[^\d]/g, "");

  if (hasLeadingDot) {
    return fraction ? `0.${fraction}` : "0.";
  }

  if (fractionParts.length > 0) {
    return `${whole || "0"}.${fraction}`;
  }

  return whole;
}

function scientificIntegerToPlain(value: string) {
  const trimmed = value.trim().toLowerCase();

  if (!/^\d+e\+\d+$/.test(trimmed)) return null;

  const [base, exponentRaw] = trimmed.split("e+");
  const exponent = Number(exponentRaw);
  if (!Number.isFinite(exponent) || exponent < 0) return null;

  return base + "0".repeat(exponent);
}

function decimalStringToRaw(value: string, decimals = 18) {
  const normalized = normalizeTokenDecimalInput(value);

  if (!normalized || normalized === ".") return "0";

  try {
    return ethers.parseUnits(normalized, decimals).toString();
  } catch {
    return "0";
  }
}

function rawTokenToDecimalString(raw: string | number | bigint | null | undefined, decimals = 18) {
  if (raw === null || raw === undefined) return "0";

  const rawString = String(raw).trim();
  if (!rawString) return "0";

  const scientificPlain = scientificIntegerToPlain(rawString);
  const normalizedRaw = scientificPlain ?? rawString;

  if (!/^\d+$/.test(normalizedRaw)) {
    const normalizedDecimal = normalizeTokenDecimalInput(rawString);
    return normalizedDecimal || "0";
  }

  try {
    return ethers.formatUnits(normalizedRaw, decimals);
  } catch {
    return "0";
  }
}

function formatTokenDisplay(value: string, symbol = "DCNT") {
  const normalized = normalizeTokenDecimalInput(value);
  return `${normalized || "0"} ${symbol}`;
}

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
      stakeAmountDecimal: rawTokenToDecimalString(queue?.stakeAmountRaw ?? "0", 18),
      platformFeeBps: String(queue?.platformFeeBps ?? 0),
      firstPlaceBps: String(queue?.firstPlaceBps ?? 0),
      secondPlaceBps: String(queue?.secondPlaceBps ?? 0),
      thirdPlaceBps: String(queue?.thirdPlaceBps ?? 0),
    } satisfies QueueDraft;
  });
}

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      typeof currentValue === "bigint" ? currentValue.toString() : currentValue
    )
  ) as T;
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
  tone?: "default" | "good" | "warn" | "danger";
}) {
  const className =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
          : "border-border bg-background text-muted";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${className}`}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  tone = "default",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  tone?: "default" | "primary";
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition",
        tone === "primary"
          ? "bg-foreground text-background hover:opacity-90 disabled:opacity-50"
          : "border border-border bg-background text-foreground hover:bg-card disabled:opacity-50",
      ].join(" ")}
    >
      {children}
    </button>
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
      return `Live · Pool ${runtime.poolId}`;
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
  proposal: WarpoolConfigProposalDraft;
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

function slugToTitle(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferProposalTitle(proposal: WarpoolConfigProposalDraft) {
  const enabledQueues = proposal.queues.filter((queue) => queue.enabled);
  if (enabledQueues.length === 1) {
    return `Warpool config · ${slugToTitle(enabledQueues[0].slug)}`;
  }
  return "Warpool config update";
}

function formatResolutionSource(value: WarpoolMultisigResolutionSource | null | undefined) {
  switch (value) {
    case "CONFIG_OWNER_MATCH":
      return "Resolved from config owner";
    case "CONFIG_OWNER_UNREGISTERED":
      return "Config owner not registered locally";
    case "LATEST_REGISTERED_FALLBACK":
      return "Latest registered safe fallback";
    default:
      return "Unavailable";
  }
}

export default function WarpoolMultisigComposer({
  slug,
  configAddress,
  latestConfigSnapshot,
  queueCards,
  runtimeQueues,
  defaultMultisigAddress = null,
  multisigResolutionSource = null,
  multisigSummary = null,
}: Props) {
  const router = useRouter();
  const { address } = useDecentWalletAccount();

  const [treasury, setTreasury] = React.useState(latestConfigSnapshot?.treasury ?? "");
  const [workerOperator, setWorkerOperator] = React.useState(
    latestConfigSnapshot?.workerOperator ?? ""
  );

  const [entriesFlowLive, setEntriesFlowLive] = React.useState(
    !(latestConfigSnapshot?.entriesPaused ?? false)
  );
  const [reservationsFlowLive, setReservationsFlowLive] = React.useState(
    !(latestConfigSnapshot?.reservationsPaused ?? false)
  );
  const [settlementsFlowLive, setSettlementsFlowLive] = React.useState(
    !(latestConfigSnapshot?.settlementsPaused ?? false)
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

  const [relicMinDiscountBps, setRelicMinDiscountBps] = React.useState(
    String(latestConfigSnapshot?.relicMinDiscountBps ?? 1000)
  );
  const [relicMaxDiscountBps, setRelicMaxDiscountBps] = React.useState(
    String(latestConfigSnapshot?.relicMaxDiscountBps ?? 4000)
  );
  const [discountSeatCap, setDiscountSeatCap] = React.useState(
    String(latestConfigSnapshot?.discountSeatCap ?? 2)
  );
  const [token11SeatCap, setToken11SeatCap] = React.useState(
    String(latestConfigSnapshot?.token11SeatCap ?? 1)
  );
  const [reservationTtlSeconds, setReservationTtlSeconds] = React.useState(
    String(latestConfigSnapshot?.reservationTtlSeconds ?? 300)
  );

  const [fatigueMaxConsecutive, setFatigueMaxConsecutive] = React.useState(
    String(latestConfigSnapshot?.fatigueMaxConsecutive ?? 1)
  );
  const [fatigueCooldownSeconds, setFatigueCooldownSeconds] = React.useState(
    String(latestConfigSnapshot?.fatigueCooldownSeconds ?? 0)
  );

  const [roundsPerMatch, setRoundsPerMatch] = React.useState(
    String(latestConfigSnapshot?.roundsPerMatch ?? 3)
  );
  const [traitPowerMin, setTraitPowerMin] = React.useState(
    String(latestConfigSnapshot?.traitPowerMin ?? 48)
  );
  const [traitPowerMax, setTraitPowerMax] = React.useState(
    String(latestConfigSnapshot?.traitPowerMax ?? 68)
  );
  const [roundVarianceMax, setRoundVarianceMax] = React.useState(
    String(latestConfigSnapshot?.roundVarianceMax ?? 12)
  );
  const [microMomentumMax, setMicroMomentumMax] = React.useState(
    String(latestConfigSnapshot?.microMomentumMax ?? 8)
  );

  const [queues, setQueues] = React.useState<QueueDraft[]>(() =>
    normalizeQueueCards(queueCards)
  );

  const [saveState, setSaveState] = React.useState<SaveState>({
    kind: "idle",
    message: null,
  });

  React.useEffect(() => {
    setTreasury(latestConfigSnapshot?.treasury ?? "");
    setWorkerOperator(latestConfigSnapshot?.workerOperator ?? "");
    setEntriesFlowLive(!(latestConfigSnapshot?.entriesPaused ?? false));
    setReservationsFlowLive(!(latestConfigSnapshot?.reservationsPaused ?? false));
    setSettlementsFlowLive(!(latestConfigSnapshot?.settlementsPaused ?? false));
    setRelicsEnabled(latestConfigSnapshot?.relicsEnabled ?? false);
    setFatigueEnabled(latestConfigSnapshot?.fatigueEnabled ?? false);
    setToken11FeeShareEnabled(latestConfigSnapshot?.token11FeeShareEnabled ?? false);
    setToken11FeeShareBps(String(latestConfigSnapshot?.token11FeeShareBps ?? 0));
    setRelicMinDiscountBps(String(latestConfigSnapshot?.relicMinDiscountBps ?? 1000));
    setRelicMaxDiscountBps(String(latestConfigSnapshot?.relicMaxDiscountBps ?? 4000));
    setDiscountSeatCap(String(latestConfigSnapshot?.discountSeatCap ?? 2));
    setToken11SeatCap(String(latestConfigSnapshot?.token11SeatCap ?? 1));
    setReservationTtlSeconds(String(latestConfigSnapshot?.reservationTtlSeconds ?? 300));
    setFatigueMaxConsecutive(String(latestConfigSnapshot?.fatigueMaxConsecutive ?? 1));
    setFatigueCooldownSeconds(String(latestConfigSnapshot?.fatigueCooldownSeconds ?? 0));
    setRoundsPerMatch(String(latestConfigSnapshot?.roundsPerMatch ?? 3));
    setTraitPowerMin(String(latestConfigSnapshot?.traitPowerMin ?? 48));
    setTraitPowerMax(String(latestConfigSnapshot?.traitPowerMax ?? 68));
    setRoundVarianceMax(String(latestConfigSnapshot?.roundVarianceMax ?? 12));
    setMicroMomentumMax(String(latestConfigSnapshot?.microMomentumMax ?? 8));
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
        relic: {
          minDiscountBps: latestConfigSnapshot.relicMinDiscountBps ?? 1000,
          maxDiscountBps: latestConfigSnapshot.relicMaxDiscountBps ?? 4000,
          discountSeatCap: latestConfigSnapshot.discountSeatCap ?? 2,
          token11SeatCap: latestConfigSnapshot.token11SeatCap ?? 1,
          reservationTtlSeconds: latestConfigSnapshot.reservationTtlSeconds ?? 300,
        },
        fatigue: {
          maxConsecutiveEntries: latestConfigSnapshot.fatigueMaxConsecutive ?? 1,
          cooldownSeconds: latestConfigSnapshot.fatigueCooldownSeconds ?? 0,
        },
        battle: {
          roundsPerMatch: latestConfigSnapshot.roundsPerMatch ?? 3,
          traitPowerMin: latestConfigSnapshot.traitPowerMin ?? 48,
          traitPowerMax: latestConfigSnapshot.traitPowerMax ?? 68,
          roundVarianceMax: latestConfigSnapshot.roundVarianceMax ?? 12,
          microMomentumMax: latestConfigSnapshot.microMomentumMax ?? 8,
        },
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
        entriesPaused: !entriesFlowLive,
        reservationsPaused: !reservationsFlowLive,
        settlementsPaused: !settlementsFlowLive,
        relicsEnabled,
        fatigueEnabled,
        token11FeeShareEnabled,
        token11FeeShareBps: Number(token11FeeShareBps || 0),
        relic: {
          minDiscountBps: Number(relicMinDiscountBps || 0),
          maxDiscountBps: Number(relicMaxDiscountBps || 0),
          discountSeatCap: Number(discountSeatCap || 0),
          token11SeatCap: Number(token11SeatCap || 0),
          reservationTtlSeconds: Number(reservationTtlSeconds || 0),
        },
        fatigue: {
          maxConsecutiveEntries: Number(fatigueMaxConsecutive || 0),
          cooldownSeconds: Number(fatigueCooldownSeconds || 0),
        },
        battle: {
          roundsPerMatch: Number(roundsPerMatch || 0),
          traitPowerMin: Number(traitPowerMin || 0),
          traitPowerMax: Number(traitPowerMax || 0),
          roundVarianceMax: Number(roundVarianceMax || 0),
          microMomentumMax: Number(microMomentumMax || 0),
        },
      },
      queues: queues.map((queue) => ({
        slug: queue.slug,
        enabled: queue.enabled,
        singleEntryPerWallet: queue.singleEntryPerWallet,
        targetSize: Number(queue.targetSize || 0),
        minStartSize: Number(queue.minStartSize || 0),
        openDurationSeconds: Number(queue.openDurationSeconds || 0),
        stakeAmountRaw: decimalStringToRaw(queue.stakeAmountDecimal || "0", 18),
        platformFeeBps: Number(queue.platformFeeBps || 0),
        firstPlaceBps: Number(queue.firstPlaceBps || 0),
        secondPlaceBps: Number(queue.secondPlaceBps || 0),
        thirdPlaceBps: Number(queue.thirdPlaceBps || 0),
      })),
    };
  }, [
    treasury,
    workerOperator,
    entriesFlowLive,
    reservationsFlowLive,
    settlementsFlowLive,
    relicsEnabled,
    fatigueEnabled,
    token11FeeShareEnabled,
    token11FeeShareBps,
    relicMinDiscountBps,
    relicMaxDiscountBps,
    discountSeatCap,
    token11SeatCap,
    reservationTtlSeconds,
    fatigueMaxConsecutive,
    fatigueCooldownSeconds,
    roundsPerMatch,
    traitPowerMin,
    traitPowerMax,
    roundVarianceMax,
    microMomentumMax,
    queues,
    latestConfigSnapshot?.configVersion,
  ]);

  const encodedPlan = React.useMemo(() => {
    if (!configAddress || !ethers.isAddress(configAddress)) {
      return {
        target: null,
        actions: [],
        warnings: ["Config contract address is missing or invalid."],
        summaryLines: [] as string[],
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
        target: ethers.isAddress(configAddress) ? ethers.getAddress(configAddress) : null,
        actions: [],
        warnings: [error instanceof Error ? error.message : "Failed to encode proposal."],
        summaryLines: [] as string[],
      };
    }
  }, [configAddress, currentDraft, proposal]);

  const summaryLines = React.useMemo(
    () =>
      diffSummaryLines({
        current: currentDraft,
        proposal,
        encodedSummaryLines: encodedPlan.summaryLines,
      }),
    [currentDraft, proposal, encodedPlan.summaryLines]
  );

  function updateQueue(slug: QueueDraft["slug"], patch: Partial<QueueDraft>) {
    setQueues((current) =>
      current.map((item) => (item.slug === slug ? { ...item, ...patch } : item))
    );
  }

  async function resolveCreatorAddress() {
    if (address) return address;
    try {
      const accounts = await dwGetAccounts();
      return accounts?.[0] ?? null;
    } catch {
      return null;
    }
  }

  async function saveProposal(status: "DRAFT" | "READY") {
    try {
      setSaveState({
        kind: "saving",
        message:
          status === "READY"
            ? "Saving proposal and marking it ready..."
            : "Saving draft proposal...",
      });

      const creatorAddress = await resolveCreatorAddress();
      if (!creatorAddress) {
        throw new Error("Connect admin wallet before saving a proposal.");
      }

      if (status === "READY" && encodedPlan.actions.length === 0) {
        throw new Error("No proposal actions detected yet.");
      }

      if (encodedPlan.warnings.length > 0) {
        throw new Error(encodedPlan.warnings[0]);
      }

      const res = await fetch(
        `/api/admin/warpool/proposals?adminSlug=${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-slug": slug,
            "x-admin-wallet": creatorAddress,
          },
          body: JSON.stringify({
            area: "WARPOOL",
            kind: "CONFIG",
            title: inferProposalTitle(proposal),
            summary:
              summaryLines.length > 0
                ? summaryLines.slice(0, 3).join(" • ")
                : "Warpool config proposal",
            description: summaryLines.length > 0 ? summaryLines.join("\n") : null,
            status,
            safeContract: defaultMultisigAddress,
            chainId: latestConfigSnapshot?.chainId ?? null,
            basedOnConfigVersion: proposal.basedOnConfigVersion,
            snapshotJson: toJsonSafe(proposal),
            createdByAddress: creatorAddress,
            actions: encodedPlan.actions.map((action, index) => ({
              orderIndex: index,
              label: action.functionName,
              summary: action.summary,
              target: action.target,
              valueWei: action.value,
              dataHex: action.data,
              functionName: action.functionName,
              argsJson: toJsonSafe(action.args),
            })),
          }),
        }
      );

      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        proposal?: { id?: string };
      };

      if (!res.ok || !json.ok || !json.proposal?.id) {
        throw new Error(json.error || "Failed to save proposal.");
      }

      setSaveState({
        kind: "success",
        message:
          status === "READY"
            ? "Proposal saved and marked ready."
            : "Draft proposal saved.",
      });

      router.push(`/admin/${slug}/warpool/proposals/${json.proposal.id}`);
      router.refresh();
    } catch (error) {
      setSaveState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Failed to save proposal.",
      });
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid gap-6">
        <SectionCard
          title="Execution context"
          description="This page composes config-only multisig actions against the live Warpool config contract."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Config contract
              </div>
              <div className="mt-2 break-all text-sm font-medium text-foreground">
                {configAddress ?? "—"}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Multisig resolution
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                {formatResolutionSource(multisigResolutionSource)}
              </div>
              <div className="mt-2 text-sm text-muted">
                {multisigSummary
                  ? `${multisigSummary.contract} · threshold ${multisigSummary.threshold} · ${multisigSummary.ownersCount} owners`
                  : defaultMultisigAddress ?? "No multisig found yet"}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Based on config version
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                {proposal.basedOnConfigVersion ?? "—"}
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Connected wallet
              </div>
              <div className="mt-2 break-all text-sm font-medium text-foreground">
                {address ?? "Not connected"}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Core addresses"
          description="Address-level config changes for future pools."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label hint="Required on-chain">Treasury</Label>
              <TextInput
                value={treasury}
                onChange={(e) => setTreasury(e.target.value)}
                placeholder="0x..."
                autoComplete="off"
              />
            </div>

            <div>
              <Label hint="Required on-chain">Worker operator</Label>
              <TextInput
                value={workerOperator}
                onChange={(e) => setWorkerOperator(e.target.value)}
                placeholder="0x..."
                autoComplete="off"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Pause & feature flags"
          description="These flags affect eligibility and operational behavior for future actions."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle
              checked={entriesFlowLive}
              onChange={setEntriesFlowLive}
              label="Entries flow live"
              description="When off, config submits entriesPaused=true."
            />
            <Toggle
              checked={reservationsFlowLive}
              onChange={setReservationsFlowLive}
              label="Reservations flow live"
              description="When off, config submits reservationsPaused=true."
            />
            <Toggle
              checked={settlementsFlowLive}
              onChange={setSettlementsFlowLive}
              label="Settlements flow live"
              description="When off, config submits settlementsPaused=true."
            />
            <Toggle
              checked={relicsEnabled}
              onChange={setRelicsEnabled}
              label="Relics enabled"
              description="Controls whether relic entry paths remain available."
            />
            <Toggle
              checked={fatigueEnabled}
              onChange={setFatigueEnabled}
              label="Fatigue enabled"
              description="Controls whether fighter cooldown / fatigue gating is enforced."
            />
            <Toggle
              checked={token11FeeShareEnabled}
              onChange={setToken11FeeShareEnabled}
              label="Token 11 fee share enabled"
              description="Controls the special fee-share path for relic token 11."
            />
          </div>

          <div className="mt-5 grid gap-5 md:max-w-sm">
            <div>
              <Label hint={formatBps(Number(token11FeeShareBps || 0))}>
                Token 11 fee share BPS
              </Label>
              <TextInput
                inputMode="numeric"
                value={token11FeeShareBps}
                onChange={(e) =>
                  setToken11FeeShareBps(normalizeIntegerInput(e.target.value))
                }
                placeholder="5000"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Relic config"
          description="Configures relic discount range, relic seat caps, and reservation TTL used by the Crown Vaultbound relic flow."
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <Label hint={formatBps(Number(relicMinDiscountBps || 0))}>
                Min discount BPS
              </Label>
              <TextInput
                inputMode="numeric"
                value={relicMinDiscountBps}
                onChange={(e) =>
                  setRelicMinDiscountBps(normalizeIntegerInput(e.target.value))
                }
                placeholder="1000"
              />
            </div>

            <div>
              <Label hint={formatBps(Number(relicMaxDiscountBps || 0))}>
                Max discount BPS
              </Label>
              <TextInput
                inputMode="numeric"
                value={relicMaxDiscountBps}
                onChange={(e) =>
                  setRelicMaxDiscountBps(normalizeIntegerInput(e.target.value))
                }
                placeholder="4000"
              />
            </div>

            <div>
              <Label>Discount seat cap</Label>
              <TextInput
                inputMode="numeric"
                value={discountSeatCap}
                onChange={(e) => setDiscountSeatCap(normalizeIntegerInput(e.target.value))}
                placeholder="2"
              />
            </div>

            <div>
              <Label>Token 11 seat cap</Label>
              <TextInput
                inputMode="numeric"
                value={token11SeatCap}
                onChange={(e) => setToken11SeatCap(normalizeIntegerInput(e.target.value))}
                placeholder="1"
              />
            </div>

            <div>
              <Label hint={formatDurationSeconds(Number(reservationTtlSeconds || 0))}>
                Reservation TTL seconds
              </Label>
              <TextInput
                inputMode="numeric"
                value={reservationTtlSeconds}
                onChange={(e) =>
                  setReservationTtlSeconds(normalizeIntegerInput(e.target.value))
                }
                placeholder="300"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Fatigue config"
          description="Controls consecutive-entry tolerance and cooldown applied when fatigue is enabled."
        >
          <div className="grid gap-5 md:grid-cols-2 xl:max-w-3xl">
            <div>
              <Label>Max consecutive entries</Label>
              <TextInput
                inputMode="numeric"
                value={fatigueMaxConsecutive}
                onChange={(e) =>
                  setFatigueMaxConsecutive(normalizeIntegerInput(e.target.value))
                }
                placeholder="1"
              />
            </div>

            <div>
              <Label hint={formatDurationSeconds(Number(fatigueCooldownSeconds || 0))}>
                Cooldown seconds
              </Label>
              <TextInput
                inputMode="numeric"
                value={fatigueCooldownSeconds}
                onChange={(e) =>
                  setFatigueCooldownSeconds(normalizeIntegerInput(e.target.value))
                }
                placeholder="0"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Battle config"
          description="These values shape battle simulation and outcome variability for future pools."
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <Label>Rounds per match</Label>
              <TextInput
                inputMode="numeric"
                value={roundsPerMatch}
                onChange={(e) => setRoundsPerMatch(normalizeIntegerInput(e.target.value))}
                placeholder="3"
              />
            </div>
            <div>
              <Label>Trait power min</Label>
              <TextInput
                inputMode="numeric"
                value={traitPowerMin}
                onChange={(e) => setTraitPowerMin(normalizeIntegerInput(e.target.value))}
                placeholder="48"
              />
            </div>
            <div>
              <Label>Trait power max</Label>
              <TextInput
                inputMode="numeric"
                value={traitPowerMax}
                onChange={(e) => setTraitPowerMax(normalizeIntegerInput(e.target.value))}
                placeholder="68"
              />
            </div>
            <div>
              <Label>Round variance max</Label>
              <TextInput
                inputMode="numeric"
                value={roundVarianceMax}
                onChange={(e) =>
                  setRoundVarianceMax(normalizeIntegerInput(e.target.value))
                }
                placeholder="12"
              />
            </div>
            <div>
              <Label>Micro momentum max</Label>
              <TextInput
                inputMode="numeric"
                value={microMomentumMax}
                onChange={(e) =>
                  setMicroMomentumMax(normalizeIntegerInput(e.target.value))
                }
                placeholder="8"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Queue config"
          description="These values affect new pools opened under each queue."
        >
          <div className="grid gap-4">
            {queues.map((queue) => {
              const meta = WARPOOL_QUEUE_META[queue.slug];
              return (
                <div
                  key={queue.slug}
                  className="rounded-[28px] border border-border bg-background/70 p-4 md:p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-foreground">
                        {meta.title}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-muted">
                        {meta.description}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Pill tone={queue.enabled ? "good" : "warn"}>
                        {queue.enabled ? "Enabled" : "Disabled"}
                      </Pill>
                      <Pill>{queueRuntimeStateText(runtimeQueues, queue.slug)}</Pill>
                    </div>
                  </div>

                  <div className="mb-4">
                    <Toggle
                      checked={queue.enabled}
                      onChange={(value) => updateQueue(queue.slug, { enabled: value })}
                      label="Queue enabled"
                      description="Controls whether new pools can be opened for this queue."
                    />
                  </div>

                  <div className="mb-4">
                    <Toggle
                      checked={queue.singleEntryPerWallet}
                      onChange={(value) =>
                        updateQueue(queue.slug, { singleEntryPerWallet: value })
                      }
                      label="Single entry per wallet"
                      description="Controls whether one wallet can enter the same pool more than once."
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <Label>Target size</Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.targetSize}
                        onChange={(e) =>
                          updateQueue(queue.slug, {
                            targetSize: normalizeIntegerInput(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label>Min start size</Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.minStartSize}
                        onChange={(e) =>
                          updateQueue(queue.slug, {
                            minStartSize: normalizeIntegerInput(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label hint={formatDurationSeconds(Number(queue.openDurationSeconds || 0))}>
                        Open duration
                      </Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.openDurationSeconds}
                        onChange={(e) =>
                          updateQueue(queue.slug, {
                            openDurationSeconds: normalizeIntegerInput(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label hint={formatTokenDisplay(queue.stakeAmountDecimal, "DCNT")}>
                        Stake amount
                      </Label>
                      <TextInput
                        inputMode="decimal"
                        value={queue.stakeAmountDecimal}
                        onChange={(e) =>
                          updateQueue(queue.slug, {
                            stakeAmountDecimal: normalizeTokenDecimalInput(e.target.value),
                          })
                        }
                        placeholder="10000"
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <Label hint={formatBps(Number(queue.platformFeeBps || 0))}>
                        Platform fee BPS
                      </Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.platformFeeBps}
                        onChange={(e) =>
                          updateQueue(queue.slug, {
                            platformFeeBps: normalizeIntegerInput(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label hint={formatBps(Number(queue.firstPlaceBps || 0))}>
                        First place BPS
                      </Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.firstPlaceBps}
                        onChange={(e) =>
                          updateQueue(queue.slug, {
                            firstPlaceBps: normalizeIntegerInput(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label hint={formatBps(Number(queue.secondPlaceBps || 0))}>
                        Second place BPS
                      </Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.secondPlaceBps}
                        onChange={(e) =>
                          updateQueue(queue.slug, {
                            secondPlaceBps: normalizeIntegerInput(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label hint={formatBps(Number(queue.thirdPlaceBps || 0))}>
                        Third place BPS
                      </Label>
                      <TextInput
                        inputMode="numeric"
                        value={queue.thirdPlaceBps}
                        onChange={(e) =>
                          updateQueue(queue.slug, {
                            thirdPlaceBps: normalizeIntegerInput(e.target.value),
                          })
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

      <div className="grid h-max gap-6 xl:sticky xl:top-6">
        <SectionCard
          title="Encoded proposal plan"
          description="Review what will actually be saved as multisig actions."
        >
          <div className="flex flex-wrap gap-2">
            <Pill tone={encodedPlan.actions.length > 0 ? "good" : "warn"}>
              {encodedPlan.actions.length} action{encodedPlan.actions.length === 1 ? "" : "s"}
            </Pill>
            <Pill>Target {encodedPlan.target ?? "—"}</Pill>
          </div>

          {encodedPlan.warnings.length > 0 ? (
            <div className="mt-4 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Review warnings
              </div>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-700 dark:text-amber-300">
                {encodedPlan.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {summaryLines.map((line) => (
              <div
                key={line}
                className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground"
              >
                {line}
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {encodedPlan.actions.map((action, index) => (
              <div
                key={action.id}
                className="rounded-3xl border border-border bg-background/70 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">
                    {index + 1}. {action.functionName}
                  </div>
                  <Pill>{action.value === "0" ? "0 value" : action.value}</Pill>
                </div>
                <div className="mt-2 text-sm leading-6 text-muted">{action.summary}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Save proposal"
          description="Persist this config plan into the shared admin workflow."
        >
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={saveState.kind === "saving"}
              onClick={() => saveProposal("DRAFT")}
            >
              Save draft
            </Button>
            <Button
              tone="primary"
              disabled={
                saveState.kind === "saving" ||
                encodedPlan.actions.length === 0 ||
                encodedPlan.warnings.length > 0
              }
              onClick={() => saveProposal("READY")}
            >
              Save as ready
            </Button>
          </div>

          {saveState.message ? (
            <div className="mt-4">
              <Pill
                tone={
                  saveState.kind === "success"
                    ? "good"
                    : saveState.kind === "error"
                      ? "danger"
                      : "default"
                }
              >
                {saveState.message}
              </Pill>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}