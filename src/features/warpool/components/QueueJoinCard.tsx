/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Lock,
  Search,
  Shield,
  Sparkles,
  Swords,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { formatNumber } from "@/src/lib/utils";
import {
  fetchWarpoolLensPreview,
  fetchWarpoolQueueAssets,
} from "@/src/features/warpool/lib/api";
import {
  enterPoolTx,
  ensureErc20Approval,
  ensureErc721Approval,
  getActiveReservationIdOnChain,
  getBrowserSigner,
  getWarpoolComradesCollection,
  getWarpoolCoreAddress,
  getWarpoolDcntToken,
  getWarpoolRelicsCollection,
  reserveRelicBonusTx,
} from "@/src/features/warpool/lib/tx";
import type {
  WarpoolLensPreviewPayload,
  WarpoolOwnedAsset,
  WarpoolQueue,
  WarpoolQueueAssetsPayload,
  WarpoolQueueEligibility,
} from "@/src/features/warpool/types";
import {
  clampPercent,
  formatDateTime,
  formatRemaining,
  shortAddress,
} from "@/src/features/warpool/lib/helpers";
import CountdownChip from "@/src/features/warpool/components/CountdownChip";
import LiveCountdown from "@/src/features/warpool/components/LiveCountdown";
import WarpoolTxModal from "@/src/features/warpool/components/WarpoolTxModal";

type Props = {
  queue: WarpoolQueue;
  eligibility: WarpoolQueueEligibility | null;
  onRefresh?: () => void | Promise<void>;
};

type StepId = 0 | 1 | 2 | 3;

type LockableAsset = WarpoolOwnedAsset & {
  isLockedInWarpool?: boolean;
  lockReason?: string | null;
  lockPoolId?: string | null;
  lockQueueTitle?: string | null;
  fatigueUntil?: string | null;
  isFatigued?: boolean;
};

type QueueEntrantPreview = {
  id: string;
  wallet: string;
  username: string | null;
  comradeTokenId: string;
  comradeImageUrl: string | null;
};

type QueueWithPreview = WarpoolQueue & {
  entrantsPreview?: QueueEntrantPreview[];
};

type OptimisticReservationState = {
  relicTokenId: string;
  reservedAt: number;
  mode: "discount" | "god";
};

const STEPS = [
  { id: 0, label: "Overview" },
  { id: 1, label: "Select fighter" },
  { id: 2, label: "Select relic" },
  { id: 3, label: "Review & enter" },
] as const;

function formatRarity(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(1);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed.toFixed(1);
    }
  }

  return null;
}

function formatCompactAmount(value: string | number | null | undefined) {
  if (value == null) return "0";

  if (typeof value === "number") {
    return formatNumber(value, { min: 0, max: 2 });
  }

  const raw = String(value).trim();
  if (!raw) return "0";

  const match = raw.match(/^([+-]?\d[\d,]*\.?\d*)\s*(.*)$/);
  if (!match) return raw;

  const numeric = Number(match[1].replace(/,/g, ""));
  const suffix = match[2]?.trim();

  if (!Number.isFinite(numeric)) return raw;

  const compact = formatNumber(numeric, { min: 0, max: 2 });
  return suffix ? `${compact} ${suffix}` : compact;
}

function parseTokenLabelToRaw(
  value: string | null | undefined,
  decimals = 18
): bigint {
  if (!value) return BigInt(0);

  const cleaned = value
    .replace(/\s*DCNT$/i, "")
    .replace(/,/g, "")
    .trim();

  if (!cleaned) return BigInt(0);

  try {
    return ethers.parseUnits(cleaned, decimals);
  } catch {
    return BigInt(0);
  }
}

function decodeWarpoolError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unable to complete the Warpool action.";

  const lower = message.toLowerCase();

  if (lower.includes("invalid fixednumber string value")) {
    return "Stake formatting was invalid for this entry attempt. Refresh the queue and try again.";
  }

  if (lower.includes("token 11") && lower.includes("seat")) {
    return "The god Relic seat is no longer open for this live pool.";
  }

  if (lower.includes("seat full")) {
    return "That relic seat is already full in this pool.";
  }

  if (lower.includes("wallet already entered")) {
    return "This wallet already has a live entry in this pool.";
  }

  if (lower.includes("reservation")) {
    return "Your relic reservation is missing or expired. Refresh and try again.";
  }

  if (lower.includes("not open") || lower.includes("pool locked")) {
    return "This pool is no longer open for entry.";
  }

  if (lower.includes("insufficient allowance")) {
    return "Approval did not complete. Please approve and try again.";
  }

  if (lower.includes("owner query for nonexistent token")) {
    return "That token is no longer available to this wallet.";
  }

  if (lower.includes("call_exception") || lower.includes("execution reverted")) {
    return "The arena rejected this move. Refresh the live queue and try again.";
  }

  return message;
}

function StepperHeader({
  step,
  onChange,
}: {
  step: StepId;
  onChange: (step: StepId) => void;
}) {
  return (
    <div className="mb-8">
      <div className="grid gap-3 sm:grid-cols-4">
        {STEPS.map((item, index) => {
          const active = step === item.id;
          const done = step > item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className="text-left"
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition",
                    active || done
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-background text-foreground/50",
                  ].join(" ")}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>

                {index < STEPS.length - 1 ? (
                  <div className="h-px flex-1 bg-border" />
                ) : null}
              </div>

              <div className="text-sm font-medium text-foreground">
                {item.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-border bg-background/80 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card text-accent">
        {icon}
      </div>
      <div className="mt-4 text-base font-medium text-foreground">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-foreground/58">
        {body}
      </p>
    </div>
  );
}

function AssetCard({
  asset,
  selected,
  onClick,
  accent,
  disabled = false,
  disabledLabel,
  footerLabel,
}: {
  asset: LockableAsset;
  selected: boolean;
  onClick: () => void;
  accent?: "comrade" | "relic";
  disabled?: boolean;
  disabledLabel?: string;
  footerLabel?: string | null;
}) {
  const rarity = formatRarity(asset.rarityScore);

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        "group rounded-3xl border p-3 text-left transition",
        selected
          ? "border-accent bg-accent/8"
          : "border-border bg-card/80 hover:bg-card",
        disabled ? "cursor-not-allowed opacity-55 hover:bg-card/80" : "",
      ].join(" ")}
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-[22px] border border-border bg-background">
        {asset.imageUrl ? (
          <Image
            src={asset.imageUrl}
            alt={asset.name ?? `Token #${asset.tokenId}`}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-foreground/35">
            {accent === "relic" ? (
              <Sparkles className="h-5 w-5" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
          </div>
        )}

        {disabledLabel ? (
          <div className="absolute left-2 top-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-200">
            {disabledLabel}
          </div>
        ) : null}
      </div>

      <div className="truncate text-sm font-medium text-foreground">
        {asset.name ??
          `${accent === "relic" ? "Relic" : "Comrade"} #${asset.tokenId}`}
      </div>

      <div className="mt-1 text-xs text-foreground/50">Token #{asset.tokenId}</div>

      {rarity ? (
        <div className="mt-1 text-xs text-foreground/42">
          Rarity {rarity}
        </div>
      ) : null}

      {footerLabel ? (
        <div className="mt-2 text-xs text-foreground/55">{footerLabel}</div>
      ) : null}
    </button>
  );
}

function InfoPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn" | "accent";
}) {
  const className =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "accent"
          ? "border-accent/20 bg-accent/10 text-foreground"
          : "border-border bg-card text-foreground/72";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${className}`}
    >
      {children}
    </span>
  );
}

function OverviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-[26px] border border-border bg-background/80 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-foreground/52">{hint}</div>
      ) : null}
    </div>
  );
}

function parseStakeNumeric(label: string | null | undefined) {
  if (!label) return null;
  const cleaned = label.replace(/\s*DCNT$/i, "").replace(/,/g, "").trim();
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function formatDcntAmount(value: number) {
  return `${formatNumber(value, { min: 0, max: 2 })} DCNT`;
}

function isPoolLockedStatus(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();
  return (
    normalized.includes("locked") ||
    normalized.includes("battle ready") ||
    normalized.includes("settling") ||
    normalized.includes("settled") ||
    normalized.includes("closed") ||
    normalized.includes("expired")
  );
}

function getFatigueLabel(asset: LockableAsset, now: number) {
  const fatigueUntil = asset.fatigueUntil;
  if (!fatigueUntil) return null;

  const diff = new Date(fatigueUntil).getTime() - now;
  if (diff <= 0) return null;

  return `Fatigued · ${formatRemaining(diff)}`;
}

function isFatigueActive(asset: LockableAsset, now = Date.now()) {
  if (!asset.fatigueUntil) return false;
  const diff = new Date(asset.fatigueUntil).getTime() - now;
  return diff > 0;
}

function playBattleFeedback(kind: "tick" | "confirm") {
  if (typeof window === "undefined") return;

  try {
    if (navigator?.vibrate) {
      navigator.vibrate(kind === "confirm" ? [24, 14, 24] : 18);
    }
  } catch {
    // noop
  }
}

export default function QueueJoinCard({
  queue,
  eligibility: _eligibility,
  onRefresh,
}: Props) {
  const router = useRouter();
  const { isConnected, address } = useDecentWalletAccount();

  const [step, setStep] = useState<StepId>(0);

  const [assets, setAssets] = useState<WarpoolQueueAssetsPayload>({
    comrades: [],
    relics: [],
  });
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [selectedComrade, setSelectedComrade] =
    useState<LockableAsset | null>(null);
  const [selectedRelic, setSelectedRelic] =
    useState<LockableAsset | null>(null);

  const [preview, setPreview] = useState<WarpoolLensPreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRequestId = useRef(0);

  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Preparing battle");
  const [modalStatus, setModalStatus] = useState("Sharpening blades...");
  const [modalTxHash, setModalTxHash] = useState<string | null>(null);

  const [fighterSearch, setFighterSearch] = useState("");
  const [optimisticReservation, setOptimisticReservation] =
    useState<OptimisticReservationState | null>(null);
  const [displayedEntrants, setDisplayedEntrants] = useState(queue.entrants);
  const [introFlash, setIntroFlash] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const stepTopRef = useRef<HTMLDivElement | null>(null);
  const redirectTimerRef = useRef<number | null>(null);

  const queueWithPreview = queue as QueueWithPreview;
  const entrantsPreview = queueWithPreview.entrantsPreview ?? [];

  const animatedProgress = clampPercent(displayedEntrants, queue.maxEntrants);
  const hasLivePool = !!queue.poolId && !!queue.poolIdOnChain;
  const poolHardLocked = isPoolLockedStatus(queue.status) || !hasLivePool;

  const scrollToStepTop = useCallback(() => {
    const el = stepTopRef.current;
    if (!el) return;

    const top = el.getBoundingClientRect().top + window.scrollY - 104;

    window.scrollTo({
      top,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      scrollToStepTop();
    }, 40);

    return () => window.clearTimeout(id);
  }, [step, scrollToStepTop]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (displayedEntrants === queue.entrants) return;

    const interval = window.setInterval(() => {
      setDisplayedEntrants((current) => {
        if (current === queue.entrants) return current;
        return current < queue.entrants ? current + 1 : current - 1;
      });
    }, 90);

    return () => window.clearInterval(interval);
  }, [displayedEntrants, queue.entrants]);

  const loadAssets = useCallback(async () => {
    if (!address) return;

    setAssetsLoading(true);

    try {
      const data = await fetchWarpoolQueueAssets(queue.slug, address);
      setAssets(data);

      setSelectedComrade((current) => {
        if (!current) return null;
        const next = data.comrades.find((item) => item.nftId === current.nftId) as
          | LockableAsset
          | undefined;

        if (!next) return null;
        if (next.isLockedInWarpool) return null;
        if (isFatigueActive(next)) return null;

        return next;
      });

      setSelectedRelic((current) => {
        if (!current) return null;
        const next = data.relics.find((item) => item.nftId === current.nftId) as
          | LockableAsset
          | undefined;

        return next ?? null;
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load owned assets."
      );
    } finally {
      setAssetsLoading(false);
    }
  }, [address, queue.slug]);

  useEffect(() => {
    if (!isConnected || !address) {
      setAssets({ comrades: [], relics: [] });
      setSelectedComrade(null);
      setSelectedRelic(null);
      setPreview(null);
      setOptimisticReservation(null);
      return;
    }

    void loadAssets();
  }, [isConnected, address, queue.slug, loadAssets]);

  useEffect(() => {
    if (!address || !selectedComrade || !hasLivePool) {
      setPreview(null);
      return;
    }

    const requestId = ++previewRequestId.current;

    const id = window.setTimeout(async () => {
      setPreviewLoading(true);

      try {
        const data = await fetchWarpoolLensPreview({
          queueSlug: queue.slug,
          walletAddress: address,
          comradeTokenId: selectedComrade.tokenId,
          relicTokenId: selectedRelic?.tokenId ?? null,
        });

        if (previewRequestId.current === requestId) {
          setPreview(data);

          if (data.activeReservationIdOnChain || data.activeReservationExpiresAt) {
            setOptimisticReservation(null);
          }
        }
      } catch {
        if (previewRequestId.current === requestId) {
          setPreview(null);
        }
      } finally {
        if (previewRequestId.current === requestId) {
          setPreviewLoading(false);
        }
      }
    }, 220);

    return () => window.clearTimeout(id);
  }, [address, selectedComrade, selectedRelic, queue.slug, hasLivePool]);

  const filteredComrades = useMemo(() => {
    const q = fighterSearch.trim().toLowerCase();
    const comrades = assets.comrades as LockableAsset[];

    if (!q) return comrades;

    return comrades.filter((asset) => {
      const name = (asset.name ?? "").toLowerCase();
      const tokenId = asset.tokenId.toLowerCase();
      return name.includes(q) || tokenId.includes(q);
    });
  }, [assets.comrades, fighterSearch]);

  const filteredRelics = useMemo(() => {
    return (assets.relics as LockableAsset[]).slice().sort((a, b) => {
      const aId = Number(a.tokenId);
      const bId = Number(b.tokenId);
      return aId - bId;
    });
  }, [assets.relics]);

  const requiresReservation =
    !!selectedRelic &&
    selectedRelic.tokenId !== "11" &&
    queue.acceptsRelics;

  const hasActiveReservation =
    !!preview?.activeReservationIdOnChain ||
    !!preview?.activeReservationExpiresAt ||
    (!!optimisticReservation &&
      selectedRelic?.tokenId === optimisticReservation.relicTokenId);

  const canGoNextFromStep = useMemo(() => {
    if (poolHardLocked) return false;
    if (step === 0) return true;
    if (step === 1) return !!selectedComrade;
    if (step === 2) return true;
    return false;
  }, [selectedComrade, step, poolHardLocked]);

  const canReserveRelic = useMemo(() => {
    return (
      !!selectedComrade &&
      !!selectedRelic &&
      selectedRelic.tokenId !== "11" &&
      !!preview?.canReserveRelic &&
      !busy &&
      hasLivePool &&
      !poolHardLocked
    );
  }, [
    selectedComrade,
    selectedRelic,
    preview?.canReserveRelic,
    busy,
    hasLivePool,
    poolHardLocked,
  ]);

  const canEnter = useMemo(() => {
    if (!selectedComrade || !hasLivePool || busy || poolHardLocked) return false;
    if (!preview) return false;
    return !!preview.canEnter;
  }, [selectedComrade, hasLivePool, busy, preview, poolHardLocked]);

  async function refreshAfterWrite() {
    await onRefresh?.();
    window.setTimeout(() => {
      void onRefresh?.();
    }, 4500);
  }

  async function refreshPreview(
    nextComradeTokenId: string,
    nextRelicTokenId?: string | null
  ) {
    if (!address) return;

    const refreshed = await fetchWarpoolLensPreview({
      queueSlug: queue.slug,
      walletAddress: address,
      comradeTokenId: nextComradeTokenId,
      relicTokenId: nextRelicTokenId ?? null,
    });

    setPreview(refreshed);

    if (refreshed.activeReservationIdOnChain || refreshed.activeReservationExpiresAt) {
      setOptimisticReservation(null);
    }
  }

  const selectedRelicIsGod = selectedRelic?.tokenId === "11";
  const baseStakeNumber = parseStakeNumeric(queue.stake);
  const previewStakeNumber = parseStakeNumeric(preview?.expectedStake ?? null);

  const displayedStakeLabel = useMemo(() => {
    if (selectedRelicIsGod) return "0 DCNT";

    if (preview?.expectedStake && previewStakeNumber !== null) {
      return formatCompactAmount(preview.expectedStake);
    }

    if (
      optimisticReservation &&
      optimisticReservation.mode === "discount" &&
      selectedRelic?.tokenId === optimisticReservation.relicTokenId
    ) {
      return "Syncing discounted stake...";
    }

    return formatCompactAmount(queue.stake);
  }, [
    selectedRelicIsGod,
    preview?.expectedStake,
    previewStakeNumber,
    optimisticReservation,
    selectedRelic?.tokenId,
    queue.stake,
  ]);

  const pricingSummary = useMemo(() => {
    const rows: Array<{
      label: string;
      value: string;
      tone?: "default" | "good" | "warn";
    }> = [];

    if (queue.stake) {
      rows.push({
        label: "Base stake",
        value: formatCompactAmount(queue.stake),
      });
    }

    if (selectedRelicIsGod) {
      rows.push({
        label: "god Relic bonus",
        value: "-100% · free stake",
        tone: "good",
      });

      rows.push({
        label: "Due now",
        value: "0 DCNT",
        tone: "good",
      });

      return rows;
    }

    if (selectedRelic && selectedRelic.tokenId !== "11") {
      rows.push({
        label: "Relic path",
        value: "Random 10%–40% discount",
        tone: "good",
      });

      if (previewStakeNumber !== null && baseStakeNumber !== null) {
        const saved = Math.max(0, baseStakeNumber - previewStakeNumber);
        rows.push({
          label: "Discount applied",
          value: `-${formatDcntAmount(saved)}`,
          tone: "good",
        });
        rows.push({
          label: "Due now",
          value: formatDcntAmount(previewStakeNumber),
          tone: "good",
        });
      } else if (
        optimisticReservation &&
        optimisticReservation.mode === "discount" &&
        selectedRelic?.tokenId === optimisticReservation.relicTokenId
      ) {
        rows.push({
          label: "Reservation active",
          value: "Discount locked on-chain · syncing exact amount",
          tone: "warn",
        });
        rows.push({
          label: "Due now",
          value: "Syncing discounted stake...",
          tone: "warn",
        });
      } else {
        rows.push({
          label: "Due now",
          value: displayedStakeLabel,
        });
      }

      return rows;
    }

    rows.push({
      label: "Due now",
      value: displayedStakeLabel,
    });

    return rows;
  }, [
    queue.stake,
    selectedRelicIsGod,
    selectedRelic,
    previewStakeNumber,
    baseStakeNumber,
    optimisticReservation,
    displayedStakeLabel,
  ]);

  async function handleReserveOnly() {
    if (!address || !selectedComrade || !selectedRelic || !queue.poolIdOnChain) {
      return;
    }

    try {
      setBusy(true);
      setModalOpen(true);
      setModalTitle("Claiming relic advantage");
      setModalTxHash(null);
      setModalStatus(
        "Summoning your relic power...\nChecking relic custody and battle seat availability."
      );

      playBattleFeedback("tick");

      const { signer, signerAddress } = await getBrowserSigner(address);
      const coreAddress = getWarpoolCoreAddress();
      const relicCollection = getWarpoolRelicsCollection();

      await ensureErc721Approval({
        signer,
        ownerAddress: signerAddress,
        collection: relicCollection,
        tokenId: selectedRelic.tokenId,
        operator: coreAddress,
        onStatus: (next) =>
          setModalStatus(
            `${next || "Granting the arena custody over your relic..."}\nRelic channel stabilizing.`
          ),
      });

      setModalStatus(
        "Locking your relic bonus seat in the arena...\nHolding the discount seat before entry."
      );
      const result = await reserveRelicBonusTx({
        signer,
        poolIdOnChain: queue.poolIdOnChain,
        comradeTokenId: selectedComrade.tokenId,
        relicTokenId: selectedRelic.tokenId,
      });

      setModalTxHash(result.txHash);
      setModalStatus(
        "Relic bonus secured.\nSyncing your battle cart with the live arena state..."
      );

      setOptimisticReservation({
        relicTokenId: selectedRelic.tokenId,
        reservedAt: Date.now(),
        mode: "discount",
      });

      await refreshAfterWrite();
      await loadAssets();
      await refreshPreview(selectedComrade.tokenId, selectedRelic.tokenId);

      toast.success("Relic reservation secured.");

      window.setTimeout(() => {
        setBusy(false);
        setModalOpen(false);
      }, 500);
      return;
    } catch (err) {
      const message = decodeWarpoolError(err);
      setModalStatus(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleEnterPool() {
    if (!address || !selectedComrade || !queue.poolIdOnChain) return;

    try {
      setBusy(true);
      setIntroFlash(true);
      setModalOpen(true);
      setModalTitle("Entering battlefield");
      setModalTxHash(null);
      setModalStatus(
        "Calling your fighter to the arena...\nPreparing weapons, relic flow, and stake path."
      );

      playBattleFeedback("confirm");

      const { provider, signer, signerAddress } = await getBrowserSigner(address);
      const coreAddress = getWarpoolCoreAddress();
      const comradesCollection = getWarpoolComradesCollection();
      const dcntToken = getWarpoolDcntToken();

      await ensureErc721Approval({
        signer,
        ownerAddress: signerAddress,
        collection: comradesCollection,
        tokenId: selectedComrade.tokenId,
        operator: coreAddress,
        onStatus: (next) =>
          setModalStatus(
            `${next || "Granting arena custody over your fighter..."}\nYour comrade is stepping into the arena.`
          ),
      });

      let reservationIdOnChain = preview?.activeReservationIdOnChain ?? null;

      if (selectedRelic) {
        const relicCollection = getWarpoolRelicsCollection();

        await ensureErc721Approval({
          signer,
          ownerAddress: signerAddress,
          collection: relicCollection,
          tokenId: selectedRelic.tokenId,
          operator: coreAddress,
          onStatus: (next) =>
            setModalStatus(
              `${next || "Granting arena custody over your relic..."}\nRelic path synchronizing with battlefield entry.`
            ),
        });
      }

      if (
        selectedRelic &&
        selectedRelic.tokenId !== "11" &&
        !reservationIdOnChain
      ) {
        setModalStatus(
          "Locking your relic bonus before the fight...\nReserving the discount lane ahead of entry."
        );
        const reserveResult = await reserveRelicBonusTx({
          signer,
          poolIdOnChain: queue.poolIdOnChain,
          comradeTokenId: selectedComrade.tokenId,
          relicTokenId: selectedRelic.tokenId,
        });

        setModalTxHash(reserveResult.txHash);
        setOptimisticReservation({
          relicTokenId: selectedRelic.tokenId,
          reservedAt: Date.now(),
          mode: "discount",
        });

        setModalStatus(
          "Reading your active reservation from the chain...\nConfirming the locked discount seat."
        );
        reservationIdOnChain = await getActiveReservationIdOnChain({
          provider,
          poolIdOnChain: queue.poolIdOnChain,
          walletAddress: signerAddress,
        });
      }

      const expectedStakeRaw =
        selectedRelic?.tokenId === "11"
          ? BigInt(0)
          : parseTokenLabelToRaw(preview?.expectedStake, 18);

      if (expectedStakeRaw > BigInt(0)) {
        await ensureErc20Approval({
          signer,
          ownerAddress: signerAddress,
          token: dcntToken,
          spender: coreAddress,
          requiredAmountRaw: expectedStakeRaw,
          onStatus: (next) =>
            setModalStatus(
              `${next || "Arming your DCNT stake for the fight..."}\nFunding the live arena entry.`
            ),
        });
      }

      setModalStatus(
        selectedRelic?.tokenId === "11"
          ? "Unleashing the god Relic into battle...\nThe special seat is now being claimed."
          : "Submitting your entry to the live arena...\nFinal battle write in progress."
      );

      const result = await enterPoolTx({
        signer,
        poolIdOnChain: queue.poolIdOnChain,
        comradeTokenId: selectedComrade.tokenId,
        relicTokenId: selectedRelic?.tokenId ?? null,
        reservationIdOnChain,
      });

      setModalTxHash(result.txHash);
      setModalStatus("Entry confirmed.\nRouting you back to Warpool...");

      await refreshAfterWrite();
      await loadAssets();
      await refreshPreview(selectedComrade.tokenId, selectedRelic?.tokenId ?? null);

      toast.success("You entered the pool successfully.");

      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }

      redirectTimerRef.current = window.setTimeout(() => {
        router.push("/comrades-warpool");
        router.refresh();
        setModalOpen(false);
        setIntroFlash(false);
      }, 1400);
    } catch (err) {
      const message = decodeWarpoolError(err);
      setModalStatus(message);
      setIntroFlash(false);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const reserveActionLabel = useMemo(() => {
    if (!selectedRelic) return "Reserve bonus seat";
    if (selectedRelic.tokenId === "11") return "god Relic enters directly";
    return "Reserve bonus seat only";
  }, [selectedRelic]);

  const reserveActionHint = useMemo(() => {
    if (!selectedRelic) return null;
    if (selectedRelic.tokenId === "11") {
      return "Token 11 skips reservation and enters with 0 DCNT stake after relic approval.";
    }
    return "Discount relics 1–10 reserve one of the limited bonus seats before entry.";
  }, [selectedRelic]);

  const reviewReason = useMemo(() => {
    const reason = (preview?.enterReason || "").toLowerCase();

    if (poolHardLocked) return "Pool locked";
    if (previewLoading) return "Refreshing live conditions...";
    if (reason.includes("expired")) return "Refreshing live pool...";
    if (reason.includes("not open")) return "Pool processing";
    if (reason.includes("wallet already entered")) return "Already entered";
    if (reason.includes("token 11 seat full")) return "Token 11 seat full";
    if (reason.includes("reservation")) return "Reservation required";

    return preview?.enterReason || "Unavailable";
  }, [poolHardLocked, previewLoading, preview?.enterReason]);

  const selectedRelicDisabledReason = useMemo(() => {
    if (!selectedRelic) return null;
    if (selectedRelic.tokenId === "11") {
      if ((preview?.token11SeatsRemaining ?? 1) <= 0) return "god seat full";
      return null;
    }

    if ((preview?.discountSeatsRemaining ?? 1) <= 0 && !hasActiveReservation) {
      return "Discount seats full";
    }

    return null;
  }, [
    selectedRelic,
    preview?.token11SeatsRemaining,
    preview?.discountSeatsRemaining,
    hasActiveReservation,
  ]);

  return (
    <>
      <div
        ref={stepTopRef}
        className="relative rounded-[34px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7"
      >
        {poolHardLocked ? (
          <div className="pointer-events-none absolute inset-0 z-20 rounded-[34px] bg-background/78 backdrop-blur-[2px]" />
        ) : null}

        {introFlash ? (
          <div className="pointer-events-none absolute inset-0 z-30 rounded-[34px] bg-linear-to-br from-accent/18 via-transparent to-accent/8 animate-pulse" />
        ) : null}

        <div className="relative z-10 mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/42">
              Live queue entry
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Join {queue.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/62">
              Clean step-by-step entry flow. Review the queue, choose your
              fighter, optionally add a relic, then confirm the on-chain entry.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {hasLivePool && queue.expiresAt ? (
              <LiveCountdown
                target={queue.expiresAt}
                label="Pool closes in"
                expiredLabel="Processing expiry"
              />
            ) : (
              <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground/70">
                Waiting for next pool
              </span>
            )}

            {preview?.activeReservationExpiresAt ? (
              <CountdownChip
                value={preview.activeReservationExpiresAt}
                mode="reservation"
              />
            ) : optimisticReservation ? (
              <InfoPill tone="warn">Reservation syncing…</InfoPill>
            ) : null}
          </div>
        </div>

        {poolHardLocked ? (
          <div className="relative z-10 mb-6 rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-300" />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Pool locked or closed
                </div>
                <div className="mt-1 text-sm leading-6 text-foreground/68">
                  This arena is no longer accepting new actions. All entry controls are paused until a new live pool opens.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative z-10">
          <StepperHeader
            step={step}
            onChange={(nextStep) => {
              if (nextStep !== step) playBattleFeedback("tick");
              setStep(nextStep);
            }}
          />

          {step === 0 ? (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <OverviewStat label="Status" value={queue.status} />
                    <OverviewStat label="Stake" value={formatCompactAmount(queue.stake)} />
                    <OverviewStat
                      label="Entrants"
                      value={`${displayedEntrants}/${queue.maxEntrants}`}
                    />
                    <OverviewStat
                      label="Progress"
                      value={`${Math.round(animatedProgress)}%`}
                    />
                  </div>

                  <div className="rounded-[28px] border border-border bg-background/80 p-5">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div className="text-sm font-semibold text-foreground">
                        Live fill progress
                      </div>
                      <div className="text-xs text-foreground/50">
                        {displayedEntrants}/{queue.maxEntrants}
                      </div>
                    </div>
                    <div className="relative h-3 overflow-hidden rounded-full bg-card">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-300"
                        style={{ width: `${animatedProgress}%` }}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.18),transparent)] animate-pulse" />
                    </div>
                  </div>

                  {entrantsPreview.length > 0 ? (
                    <div className="rounded-[28px] border border-border bg-background/80 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-foreground">
                          Fighters already in the arena
                        </div>
                        <div className="text-xs text-foreground/48">
                          {entrantsPreview.length} visible
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {entrantsPreview.map((entrant) => (
                          <div
                            key={entrant.id}
                            className="rounded-2xl border border-border bg-card p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-border bg-background">
                                {entrant.comradeImageUrl ? (
                                  <Image
                                    src={entrant.comradeImageUrl}
                                    alt={entrant.username ?? entrant.wallet}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-foreground/30">
                                    <Shield className="h-4 w-4" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-foreground">
                                  {entrant.username ?? shortAddress(entrant.wallet)}
                                </div>
                                <div className="mt-1 text-xs text-foreground/52">
                                  Fighter #{entrant.comradeTokenId}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <aside className="space-y-4">
                  <div className="rounded-[28px] border border-border bg-background/80 p-5">
                    <div className="text-sm font-semibold text-foreground">
                      How relics work
                    </div>

                    <div className="mt-4 space-y-3 text-sm leading-6 text-foreground/60">
                      <div className="rounded-2xl border border-border bg-card px-4 py-3">
                        Relics <span className="font-medium text-foreground">1–10</span> can reserve one of the limited discount seats and apply a random 10%–40% cut to stake.
                      </div>

                      <div className="rounded-2xl border border-border bg-card px-4 py-3">
                        <span className="font-medium text-foreground">god Relic #11</span> skips reservation and enters with a free stake when the special seat is open.
                      </div>
                    </div>
                  </div>

                  {!isConnected ? (
                    <EmptyState
                      icon={<Wallet className="h-5 w-5" />}
                      title="Connect wallet to enter"
                      body="Connect your wallet to load owned fighters and relics for this queue."
                    />
                  ) : null}
                </aside>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    Select your fighter
                  </div>
                  <div className="mt-1 text-sm text-foreground/58">
                    Fighters already active in Warpool or currently fatigued stay disabled here.
                  </div>
                </div>

                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/34" />
                  <input
                    value={fighterSearch}
                    onChange={(e) => setFighterSearch(e.target.value)}
                    placeholder="Search fighter name or token"
                    className="h-11 w-full rounded-full border border-border bg-background pl-11 pr-4 text-sm outline-none transition focus:border-foreground/15 focus:ring-2 focus:ring-foreground/5"
                  />
                </div>
              </div>

              {assetsLoading ? (
                <EmptyState
                  icon={<Clock3 className="h-5 w-5" />}
                  title="Loading your fighters"
                  body="Checking your indexed inventory and current battle readiness."
                />
              ) : filteredComrades.length === 0 ? (
                <EmptyState
                  icon={<Shield className="h-5 w-5" />}
                  title="No eligible fighters found"
                  body="We could not find any fighter matching this queue and wallet state."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredComrades.map((asset) => {
                    const fatigueLabel = getFatigueLabel(asset, now);
                    const disabled =
                      !!asset.isLockedInWarpool || !!fatigueLabel || poolHardLocked;
                    const disabledLabel = poolHardLocked
                      ? "Pool locked"
                      : asset.lockReason || fatigueLabel || undefined;

                    return (
                      <AssetCard
                        key={asset.nftId}
                        asset={asset}
                        accent="comrade"
                        selected={selectedComrade?.nftId === asset.nftId}
                        onClick={() => {
                          playBattleFeedback("tick");
                          setSelectedComrade(asset);
                          setSelectedRelic(null);
                          setOptimisticReservation(null);
                        }}
                        disabled={disabled}
                        disabledLabel={disabledLabel}
                        footerLabel={fatigueLabel}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    Select a relic
                  </div>
                  <div className="mt-1 text-sm text-foreground/58">
                    Relics are optional. Discount relics use limited reserved seats. Token 11 enters directly.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <InfoPill>
                    Discount seats: {preview?.discountSeatsRemaining ?? "—"}
                  </InfoPill>
                  <InfoPill>
                    Token 11 seats: {preview?.token11SeatsRemaining ?? "—"}
                  </InfoPill>
                </div>
              </div>

              {!queue.acceptsRelics ? (
                <EmptyState
                  icon={<Sparkles className="h-5 w-5" />}
                  title="Relics are disabled for this queue"
                  body="This queue currently uses a fighter-only entry flow."
                />
              ) : assetsLoading ? (
                <EmptyState
                  icon={<Clock3 className="h-5 w-5" />}
                  title="Loading your relics"
                  body="Checking your relic inventory and battle availability."
                />
              ) : filteredRelics.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-5 w-5" />}
                  title="No relics found"
                  body="Your connected wallet does not currently show any relics for use in this queue."
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      playBattleFeedback("tick");
                      setSelectedRelic(null);
                      setOptimisticReservation(null);
                    }}
                    className={[
                      "rounded-3xl border p-4 text-left transition",
                      selectedRelic === null
                        ? "border-accent bg-accent/8"
                        : "border-border bg-card/80 hover:bg-card",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold text-foreground">
                      Enter without relic
                    </div>
                    <div className="mt-1 text-sm leading-6 text-foreground/58">
                      Standard queue entry using your selected fighter only.
                    </div>
                  </button>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredRelics.map((asset) => {
                      const isGod = asset.tokenId === "11";
                      const discountSeatsRemaining = preview?.discountSeatsRemaining ?? 0;
                      const token11SeatsRemaining = preview?.token11SeatsRemaining ?? 0;

                      let disabled = poolHardLocked;
                      let disabledLabel: string | undefined = poolHardLocked
                        ? "Pool locked"
                        : undefined;

                      if (!disabled && asset.isLockedInWarpool) {
                        disabled = true;
                        disabledLabel = asset.lockReason || "Already in use";
                      }

                      if (!disabled && !selectedComrade) {
                        disabled = true;
                        disabledLabel = "Select fighter first";
                      }

                      if (!disabled && isGod && token11SeatsRemaining <= 0) {
                        disabled = true;
                        disabledLabel = "god seat full";
                      }

                      if (
                        !disabled &&
                        !isGod &&
                        discountSeatsRemaining <= 0 &&
                        !(
                          hasActiveReservation &&
                          selectedRelic?.nftId === asset.nftId
                        )
                      ) {
                        disabled = true;
                        disabledLabel = "Discount seats full";
                      }

                      const footerLabel = isGod
                        ? "Special seat · free stake"
                        : "Relic power: random 10%–40%";

                      return (
                        <AssetCard
                          key={asset.nftId}
                          asset={asset}
                          accent="relic"
                          selected={selectedRelic?.nftId === asset.nftId}
                          onClick={() => {
                            playBattleFeedback("tick");
                            setSelectedRelic(asset);
                          }}
                          disabled={disabled}
                          disabledLabel={disabledLabel}
                          footerLabel={footerLabel}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="space-y-4">
                  <div className="rounded-[28px] border border-border bg-background/80 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold text-foreground">
                          Battle cart
                        </div>
                        <div className="mt-1 text-sm text-foreground/58">
                          Final arena review before the on-chain write.
                        </div>
                      </div>

                      {selectedRelic ? (
                        <InfoPill tone="accent">
                          {selectedRelic.tokenId === "11"
                            ? "god Relic selected"
                            : "Discount relic selected"}
                        </InfoPill>
                      ) : (
                        <InfoPill>No relic</InfoPill>
                      )}
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border border-border bg-card p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                          Fighter
                        </div>
                        <div className="mt-2 text-base font-semibold text-foreground">
                          {selectedComrade?.name ?? "No fighter selected"}
                        </div>
                        {selectedComrade ? (
                          <div className="mt-1 text-sm text-foreground/56">
                            Token #{selectedComrade.tokenId}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-3xl border border-border bg-card p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                          Relic
                        </div>
                        <div className="mt-2 text-base font-semibold text-foreground">
                          {selectedRelic?.name ??
                            (selectedRelic
                              ? `Relic #${selectedRelic.tokenId}`
                              : "No relic selected")}
                        </div>
                        {selectedRelic ? (
                          <div className="mt-1 text-sm text-foreground/56">
                            Token #{selectedRelic.tokenId}
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-foreground/56">
                            Standard entry flow
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 rounded-3xl border border-border bg-card p-4">
                      <div className="text-sm font-semibold text-foreground">
                        Pricing
                      </div>

                      <div className="mt-4 space-y-3">
                        {pricingSummary.map((row) => (
                          <div
                            key={row.label}
                            className="flex items-start justify-between gap-4 text-sm"
                          >
                            <span className="text-foreground/58">{row.label}</span>
                            <span
                              className={[
                                "text-right font-medium",
                                row.tone === "good"
                                  ? "text-emerald-600 dark:text-emerald-300"
                                  : row.tone === "warn"
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-foreground",
                              ].join(" ")}
                            >
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedRelic && selectedRelic.tokenId !== "11" ? (
                      <div className="mt-4 rounded-3xl border border-accent/15 bg-accent/6 p-4 text-sm leading-6 text-foreground/70">
                        Your relic can cut the stake by a random <span className="font-medium text-foreground">10%–40%</span>. Once reserved, the exact discount locks on-chain and your battle cart refreshes.
                      </div>
                    ) : null}

                    {selectedRelic && selectedRelic.tokenId === "11" ? (
                      <div className="mt-4 rounded-3xl border border-accent/15 bg-accent/6 p-4 text-sm leading-6 text-foreground/70">
                        <span className="font-medium text-foreground">god Relic #11</span> bypasses the normal discount-seat flow and enters with <span className="font-medium text-foreground">0 DCNT stake</span> when the special seat is available.
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[28px] border border-border bg-background/80 p-5">
                    <div className="text-sm font-semibold text-foreground">
                      Live battle checks
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <InfoPill tone={preview?.canEnter ? "good" : "warn"}>
                        {preview?.canEnter ? "Ready to enter" : reviewReason}
                      </InfoPill>

                      {requiresReservation ? (
                        <InfoPill tone={hasActiveReservation ? "good" : "warn"}>
                          {hasActiveReservation
                            ? "Reservation active"
                            : "Reservation needed"}
                        </InfoPill>
                      ) : null}

                      {selectedRelicDisabledReason ? (
                        <InfoPill tone="warn">{selectedRelicDisabledReason}</InfoPill>
                      ) : null}
                    </div>

                    {preview?.activeReservationExpiresAt ? (
                      <div className="mt-4 text-sm text-foreground/58">
                        Active reservation expires {formatDateTime(preview.activeReservationExpiresAt)}.
                      </div>
                    ) : optimisticReservation ? (
                      <div className="mt-4 text-sm text-foreground/58">
                        Reservation submitted. Live pricing is syncing now.
                      </div>
                    ) : null}
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-[28px] border border-border bg-background/80 p-5">
                    <div className="text-sm font-semibold text-foreground">
                      Action bay
                    </div>

                    <div className="mt-4 space-y-3">
                      {selectedRelic && selectedRelic.tokenId !== "11" ? (
                        <button
                          type="button"
                          disabled={!canReserveRelic}
                          onClick={() => void handleReserveOnly()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:bg-card disabled:text-foreground/40"
                        >
                          {busy ? "Processing..." : reserveActionLabel}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        disabled={!canEnter}
                        onClick={() => void handleEnterPool()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-foreground/15 disabled:text-foreground/40"
                      >
                        {busy ? "Processing..." : "Enter battlefield"}
                        <Swords className="h-4 w-4" />
                      </button>
                    </div>

                    {reserveActionHint ? (
                      <div className="mt-4 text-xs leading-6 text-foreground/50">
                        {reserveActionHint}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[28px] border border-border bg-background/80 p-5 text-xs leading-6 text-foreground/50">
                    This flow reads your indexed inventory, checks live queue readiness, applies relic rules where allowed, then writes the real approvals and entry transactions on-chain with premium live feedback.
                  </div>
                </aside>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => {
                if (step > 0) playBattleFeedback("tick");
                setStep((prev) => Math.max(0, prev - 1) as StepId);
              }}
              disabled={step === 0}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (canGoNextFromStep) playBattleFeedback("tick");
                  setStep((prev) => Math.min(3, prev + 1) as StepId);
                }}
                disabled={!canGoNextFromStep}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-foreground/15 disabled:text-foreground/40"
              >
                {step === 0
                  ? "Next: select fighter"
                  : step === 1
                    ? "Next: select relic"
                    : "Next: review and enter"}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="text-sm text-foreground/50">
                Final step reached
              </div>
            )}
          </div>
        </div>
      </div>

      <WarpoolTxModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        status={modalStatus}
        txHash={modalTxHash}
        busy={busy}
      />
    </>
  );
}