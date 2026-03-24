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
};

const STEPS = [
  { id: 0, label: "Overview" },
  { id: 1, label: "Select fighter" },
  { id: 2, label: "Select relic" },
  { id: 3, label: "Review & enter" },
] as const;

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
}: {
  asset: LockableAsset;
  selected: boolean;
  onClick: () => void;
  accent?: "comrade" | "relic";
  disabled?: boolean;
  disabledLabel?: string;
}) {
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

      {asset.rarityScore ? (
        <div className="mt-1 text-xs text-foreground/42">
          Rarity {asset.rarityScore}
        </div>
      ) : null}

      {disabledLabel ? (
        <div className="mt-2 text-xs text-foreground/55">{disabledLabel}</div>
      ) : null}
    </button>
  );
}

export default function QueueJoinCard({
  queue,
  eligibility,
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
  const [modalTitle, setModalTitle] = useState("Preparing action");
  const [modalStatus, setModalStatus] = useState("Starting...");
  const [modalTxHash, setModalTxHash] = useState<string | null>(null);

  const [fighterSearch, setFighterSearch] = useState("");

  const stepTopRef = useRef<HTMLDivElement | null>(null);
  const redirectTimerRef = useRef<number | null>(null);

  const progress = clampPercent(queue.entrants, queue.maxEntrants);
  const hasLivePool = !!queue.poolId && !!queue.poolIdOnChain;

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

  const requiresReservation =
    !!selectedRelic &&
    selectedRelic.tokenId !== "11" &&
    queue.acceptsRelics;

  const canGoNextFromStep = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return !!selectedComrade;
    if (step === 2) return true;
    return false;
  }, [selectedComrade, step]);

  const canReserveRelic = useMemo(() => {
    return (
      !!selectedComrade &&
      !!selectedRelic &&
      selectedRelic.tokenId !== "11" &&
      !!preview?.canReserveRelic &&
      !busy &&
      hasLivePool
    );
  }, [selectedComrade, selectedRelic, preview?.canReserveRelic, busy, hasLivePool]);

  const canEnter = useMemo(() => {
    if (!selectedComrade || !hasLivePool || busy) return false;
    if (!preview) return false;
    return !!preview.canEnter;
  }, [selectedComrade, hasLivePool, busy, preview]);

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
  }

  async function handleReserveOnly() {
    if (!address || !selectedComrade || !selectedRelic || !queue.poolIdOnChain) {
      return;
    }

    try {
      setBusy(true);
      setModalOpen(true);
      setModalTitle("Reserving relic bonus");
      setModalTxHash(null);
      setModalStatus("Connecting wallet...");

      const { signer, signerAddress } = await getBrowserSigner(address);
      const coreAddress = getWarpoolCoreAddress();
      const relicCollection = getWarpoolRelicsCollection();

      await ensureErc721Approval({
        signer,
        ownerAddress: signerAddress,
        collection: relicCollection,
        tokenId: selectedRelic.tokenId,
        operator: coreAddress,
        onStatus: setModalStatus,
      });

      setModalStatus("Submitting reserve transaction...");
      const result = await reserveRelicBonusTx({
        signer,
        poolIdOnChain: queue.poolIdOnChain,
        comradeTokenId: selectedComrade.tokenId,
        relicTokenId: selectedRelic.tokenId,
      });

      setModalTxHash(result.txHash);
      setModalStatus("Reservation confirmed on-chain. Refreshing live state...");

      await refreshAfterWrite();
      await loadAssets();
      await refreshPreview(selectedComrade.tokenId, selectedRelic.tokenId);

      toast.success("Relic reservation submitted successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to reserve relic bonus.";
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
      setModalOpen(true);
      setModalTitle("Entering Battlefield");
      setModalTxHash(null);
      setModalStatus("Connecting wallet...");

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
        onStatus: setModalStatus,
      });

      let reservationIdOnChain = preview?.activeReservationIdOnChain ?? null;

      if (
        selectedRelic &&
        selectedRelic.tokenId !== "11" &&
        !reservationIdOnChain
      ) {
        const relicCollection = getWarpoolRelicsCollection();

        await ensureErc721Approval({
          signer,
          ownerAddress: signerAddress,
          collection: relicCollection,
          tokenId: selectedRelic.tokenId,
          operator: coreAddress,
          onStatus: setModalStatus,
        });

        setModalStatus("Creating relic reservation...");
        const reserveResult = await reserveRelicBonusTx({
          signer,
          poolIdOnChain: queue.poolIdOnChain,
          comradeTokenId: selectedComrade.tokenId,
          relicTokenId: selectedRelic.tokenId,
        });

        setModalTxHash(reserveResult.txHash);
        setModalStatus("Reading active reservation from chain...");

        reservationIdOnChain = await getActiveReservationIdOnChain({
          provider,
          poolIdOnChain: queue.poolIdOnChain,
          walletAddress: signerAddress,
        });
      }

      const expectedStakeRaw = preview?.expectedStake
        ? ethers.parseUnits(
            preview.expectedStake.replace(/\s*DCNT$/i, "").trim(),
            18
          )
        : BigInt(0);

      if (expectedStakeRaw > BigInt(0)) {
        await ensureErc20Approval({
          signer,
          ownerAddress: signerAddress,
          token: dcntToken,
          spender: coreAddress,
          requiredAmountRaw: expectedStakeRaw,
          onStatus: setModalStatus,
        });
      }

      setModalStatus("Submitting enterPool transaction...");
      const enterResult = await enterPoolTx({
        signer,
        poolIdOnChain: queue.poolIdOnChain,
        comradeTokenId: selectedComrade.tokenId,
        relicTokenId: selectedRelic?.tokenId ?? null,
        reservationIdOnChain,
      });

      setModalTxHash(enterResult.txHash);
      setModalStatus("Entry confirmed on-chain. Returning to Warpool...");

      await refreshAfterWrite();
      await loadAssets();

      redirectTimerRef.current = window.setTimeout(() => {
        setModalOpen(false);
        router.push("/comrades-warpool");
        router.refresh();
      }, 1000);

      toast.success("Pool entry submitted successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to enter live pool.";
      setModalStatus(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const actionSummary = useMemo(() => {
    if (!preview) {
      return {
        dueNow: queue.stake,
        reserveText: "Select assets to preview the exact live entry state.",
      };
    }

    return {
      dueNow: preview.expectedStake,
      reserveText: preview.canReserveRelic
        ? "Discount seat available."
        : preview.reserveReason || "No reservation available.",
    };
  }, [preview, queue.stake]);

  const primaryActionLabel = useMemo(() => {
    if (!hasLivePool) return "Waiting for next pool";
    if (!selectedComrade) return "Select fighter first";
    if (previewLoading) return "Checking live state...";
    if (!preview) return "Checking live state...";
    if (preview.canEnter) return "Stake and enter pool";

    const reason = (preview.enterReason || "").toLowerCase();

    if (reason.includes("expired")) return "Refreshing live pool...";
    if (reason.includes("not open")) return "Pool processing";
    if (reason.includes("wallet already entered")) return "Already entered";
    if (reason.includes("token 11 seat full")) return "Token 11 seat full";
    if (reason.includes("reservation")) return "Reservation required";

    return preview.enterReason || "Unavailable";
  }, [hasLivePool, selectedComrade, previewLoading, preview]);

  return (
    <>
      <div
        ref={stepTopRef}
        className="rounded-[34px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7"
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
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
            ) : null}
          </div>
        </div>

        <StepperHeader step={step} onChange={setStep} />

        {step === 0 ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[26px] border border-border bg-background/80 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                      Status
                    </div>
                    <div className="mt-2 text-lg font-semibold">{queue.status}</div>
                  </div>

                  <div className="rounded-[26px] border border-border bg-background/80 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                      Stake
                    </div>
                    <div className="mt-2 text-lg font-semibold">{queue.stake}</div>
                  </div>

                  <div className="rounded-[26px] border border-border bg-background/80 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                      Fee
                    </div>
                    <div className="mt-2 text-lg font-semibold">{queue.fee}</div>
                  </div>

                  <div className="rounded-[26px] border border-border bg-background/80 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                      Format
                    </div>
                    <div className="mt-2 text-lg font-semibold">{queue.format}</div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-border bg-background/80 p-5">
                  <div className="mb-3 flex items-center justify-between text-sm text-foreground/65">
                    <span className="inline-flex items-center gap-2">
                      <Swords className="h-4 w-4 text-accent" />
                      Queue fill
                    </span>
                    <span>
                      {queue.entrants}/{queue.maxEntrants}
                    </span>
                  </div>

                  <div className="h-2.5 rounded-full bg-foreground/8">
                    <div
                      className="h-2.5 rounded-full bg-accent transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-foreground/55">
                    <span>
                      {hasLivePool
                        ? queue.remainingSpots > 0
                          ? `${queue.remainingSpots} spot${
                              queue.remainingSpots === 1 ? "" : "s"
                            } left`
                          : "Pool is filled"
                        : "Waiting for the next automatic pool open"}
                    </span>

                    <span>
                      {queue.openedAt
                        ? `Opened ${formatDateTime(queue.openedAt)}`
                        : "No active live pool yet"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[28px] border border-border bg-background/80 p-5">
                    <div className="mb-3 inline-flex items-center gap-2 text-sm text-foreground/70">
                      <Sparkles className="h-4 w-4 text-accent" />
                      Relic seats
                    </div>
                    <div className="space-y-2 text-sm text-foreground/62">
                      <div className="flex items-center justify-between">
                        <span>Queue accepts relics</span>
                        <span className="font-medium text-foreground">
                          {queue.acceptsRelics ? "Yes" : "No"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Discount relic seats</span>
                        <span className="font-medium text-foreground">
                          {queue.acceptsRelics
                            ? queue.discountSeatsRemaining ?? 0
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Token 11 seats</span>
                        <span className="font-medium text-foreground">
                          {queue.acceptsRelics
                            ? queue.token11SeatsRemaining ?? 0
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-border bg-background/80 p-5">
                    <div className="mb-3 inline-flex items-center gap-2 text-sm text-foreground/70">
                      <Lock className="h-4 w-4 text-accent" />
                      Queue rules
                    </div>
                    <div className="space-y-2 text-sm leading-6 text-foreground/62">
                      {queue.rules.map((rule) => (
                        <div key={rule} className="rounded-2xl bg-card px-3 py-2">
                          {rule}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-[28px] border border-border bg-background/80 p-5">
                  <div className="mb-3 inline-flex items-center gap-2 text-sm text-foreground/70">
                    <Wallet className="h-4 w-4 text-accent" />
                    Wallet status
                  </div>

                  {isConnected ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700 dark:text-emerald-200">
                      Connected as{" "}
                      <span className="font-medium">{shortAddress(address)}</span>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-card px-3 py-3 text-sm text-foreground/65">
                      Connect your wallet from the global header before joining.
                    </div>
                  )}

                  <div className="mt-4 space-y-3 text-sm text-foreground/62">
                    <div className="flex items-center justify-between">
                      <span>Entry mode</span>
                      <span className="font-medium text-foreground">
                        {queue.singleEntryPerWallet
                          ? "One per wallet"
                          : "Multi-entry"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Reserve status</span>
                      <span className="font-medium text-foreground">
                        {eligibility?.isReservedByViewer
                          ? "Reserved"
                          : eligibility?.reason === "wallet_required"
                          ? "Wallet required"
                          : hasLivePool
                          ? "Ready"
                          : "No live pool"}
                      </span>
                    </div>
                  </div>
                </div>

                {!hasLivePool ? (
                  <EmptyState
                    icon={<Clock3 className="h-5 w-5" />}
                    title="This queue is not open right now"
                    body="The config is live, but there is no active open pool at the moment. Once the worker opens the next pool, the countdown and entry flow will become available automatically."
                  />
                ) : null}
              </aside>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Select your fighter</h3>
                <p className="mt-2 text-sm leading-7 text-foreground/60">
                  Choose one Comrade from the connected wallet to stake into this
                  queue.
                </p>
              </div>

              {selectedComrade ? (
                <div className="rounded-full border border-accent/30 bg-accent/8 px-4 py-2 text-sm text-foreground">
                  Selected: {selectedComrade.name ?? `Comrade #${selectedComrade.tokenId}`}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-border bg-background/80 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <input
                  value={fighterSearch}
                  onChange={(e) => setFighterSearch(e.target.value)}
                  placeholder="Search fighters by name or token id..."
                  className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-foreground/20"
                />
              </div>
            </div>

            {!isConnected ? (
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="Connect your wallet first"
                body="Your owned Comrades are loaded directly from the indexed collection data for the connected wallet."
              />
            ) : assetsLoading ? (
              <div className="rounded-[28px] border border-border bg-background/80 p-8 text-sm text-foreground/60">
                Loading owned fighters...
              </div>
            ) : assets.comrades.length === 0 ? (
              <EmptyState
                icon={<Shield className="h-5 w-5" />}
                title="No fighters found"
                body="This wallet does not currently own any indexed Comrades from the configured Warpool collection."
              />
            ) : filteredComrades.length === 0 ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No fighters match your search"
                body="Try a fighter name or token id."
              />
            ) : (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {filteredComrades.map((asset) => {
                  const disabled = !!asset.isLockedInWarpool;
                  const disabledLabel = disabled
                    ? asset.lockQueueTitle
                      ? `Already in pool · ${asset.lockQueueTitle}`
                      : asset.lockReason || "Fighter already in pool"
                    : undefined;

                  return (
                    <AssetCard
                      key={asset.nftId}
                      asset={asset}
                      selected={selectedComrade?.nftId === asset.nftId}
                      onClick={() => setSelectedComrade(asset)}
                      accent="comrade"
                      disabled={disabled}
                      disabledLabel={disabledLabel}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Select relic</h3>
                <p className="mt-2 text-sm leading-7 text-foreground/60">
                  Relics only apply in Crown Vaultbound. Discount relics use the
                  2-seat bonus system for tokens 1–10, while token 11 uses the
                  separate 1-seat god slot.
                </p>
              </div>

              {queue.acceptsRelics ? (
                <div className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground/70">
                  Seats left: discount {queue.discountSeatsRemaining ?? 0} · token 11{" "}
                  {queue.token11SeatsRemaining ?? 0}
                </div>
              ) : null}
            </div>

            {!queue.acceptsRelics ? (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="No relic needed for this queue"
                body="This queue does not use relic mechanics. You can continue directly to the review step."
              />
            ) : !isConnected ? (
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="Connect your wallet first"
                body="Relics are loaded directly from your connected wallet inventory."
              />
            ) : assetsLoading ? (
              <div className="rounded-[28px] border border-border bg-background/80 p-8 text-sm text-foreground/60">
                Loading owned relics...
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRelic(null)}
                    className={[
                      "rounded-full border px-4 py-2 text-sm transition",
                      !selectedRelic
                        ? "border-accent bg-accent/8 text-foreground"
                        : "border-border bg-background text-foreground/70",
                    ].join(" ")}
                  >
                    Continue without relic
                  </button>
                </div>

                {assets.relics.length === 0 ? (
                  <EmptyState
                    icon={<Sparkles className="h-5 w-5" />}
                    title="No relics found"
                    body="This wallet does not currently own any indexed relics from the configured collection."
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {(assets.relics as LockableAsset[]).map((asset) => (
                      <AssetCard
                        key={asset.nftId}
                        asset={asset}
                        selected={selectedRelic?.nftId === asset.nftId}
                        onClick={() => setSelectedRelic(asset)}
                        accent="relic"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-semibold">Review and enter</h3>
              <p className="mt-2 text-sm leading-7 text-foreground/60">
                Final live check before the on-chain transaction. This reflects
                the current active pool state, entry rules, and reservation status.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <div className="rounded-[28px] border border-border bg-background/80 p-5">
                  <div className="mb-4 text-sm font-medium text-foreground">
                    Loadout summary
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-border bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                        Fighter
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {selectedComrade
                          ? selectedComrade.name ??
                            `Comrade #${selectedComrade.tokenId}`
                          : "Not selected"}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-border bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                        Relic
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {selectedRelic
                          ? selectedRelic.name ?? `Relic #${selectedRelic.tokenId}`
                          : queue.acceptsRelics
                          ? "No relic"
                          : "Not used in this queue"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-border bg-background/80 p-5">
                  <div className="mb-4 text-sm font-medium text-foreground">
                    Live queue check
                  </div>

                  {!isConnected ? (
                    <div className="rounded-[22px] border border-border bg-card p-4 text-sm text-foreground/60">
                      Connect wallet to run the live entry preview.
                    </div>
                  ) : !selectedComrade ? (
                    <div className="rounded-[22px] border border-border bg-card p-4 text-sm text-foreground/60">
                      Select a fighter first.
                    </div>
                  ) : previewLoading ? (
                    <div className="rounded-[22px] border border-border bg-card p-4 text-sm text-foreground/60">
                      Checking live lens state...
                    </div>
                  ) : preview ? (
                    <div className="space-y-3">
                      <div className="rounded-[22px] border border-border bg-card p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-foreground/60">Enter pool</span>
                            <span className="font-medium text-foreground">
                              {preview.canEnter
                                ? "Allowed"
                                : preview.enterReason || "Unavailable"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-foreground/60">
                              Reserve relic bonus
                            </span>
                            <span className="font-medium text-foreground">
                              {selectedRelic && selectedRelic.tokenId !== "11"
                                ? preview.canReserveRelic
                                  ? "Allowed"
                                  : preview.reserveReason || "Unavailable"
                                : selectedRelic?.tokenId === "11"
                                ? "Not required"
                                : "No relic selected"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-foreground/60">Due now</span>
                            <span className="font-medium text-foreground">
                              {preview.expectedStake}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-foreground/60">Discount</span>
                            <span className="font-medium text-foreground">
                              {preview.discountBps
                                ? `${(preview.discountBps / 100).toFixed(2)}%`
                                : "None"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-foreground/60">
                              Active reservation
                            </span>
                            <span className="font-medium text-foreground">
                              {preview.activeReservationIdOnChain ?? "None"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-foreground/60">Seats left</span>
                            <span className="font-medium text-foreground">
                              Discount {preview.discountSeatsRemaining ?? 0} · Token 11{" "}
                              {preview.token11SeatsRemaining ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {preview.activeReservationExpiresAt ? (
                        <div className="flex flex-wrap gap-2">
                          <CountdownChip
                            value={preview.activeReservationExpiresAt}
                            mode="reservation"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-border bg-card p-4 text-sm text-foreground/60">
                      Live preview not available yet.
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-[28px] border border-border bg-background/80 p-5">
                  <div className="mb-4 text-sm font-medium text-foreground">
                    Action summary
                  </div>

                  <div className="space-y-3 text-sm text-foreground/62">
                    <div className="flex items-center justify-between">
                      <span>Base stake</span>
                      <span className="font-medium text-foreground">{queue.stake}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Due now</span>
                      <span className="font-medium text-foreground">
                        {actionSummary.dueNow}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Queue status</span>
                      <span className="font-medium text-foreground">
                        {queue.status}
                      </span>
                    </div>

                    <div className="rounded-[22px] border border-border bg-card p-4 text-xs leading-6 text-foreground/55">
                      {requiresReservation
                        ? actionSummary.reserveText
                        : selectedRelic?.tokenId === "11"
                        ? "Token 11 uses the dedicated god seat and enters without the discount reservation flow."
                        : "No relic reservation needed for this entry path."}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <button
                      type="button"
                      disabled={!canEnter}
                      onClick={() => void handleEnterPool()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-foreground/15 disabled:text-foreground/40"
                    >
                      {busy ? "Processing..." : primaryActionLabel}
                    </button>

                    {selectedRelic && selectedRelic.tokenId !== "11" ? (
                      <button
                        type="button"
                        disabled={!canReserveRelic}
                        onClick={() => void handleReserveOnly()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:bg-card disabled:text-foreground/40"
                      >
                        {busy ? "Processing..." : "Reserve bonus seat only"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[28px] border border-border bg-background/80 p-5 text-xs leading-6 text-foreground/50">
                  This flow reads your indexed inventory, checks live queue
                  readiness, applies relic rules where allowed, and then writes
                  the actual approvals and entry transactions on-chain.
                </div>
              </aside>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(0, prev - 1) as StepId)}
            disabled={step === 0}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.min(3, prev + 1) as StepId)}
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