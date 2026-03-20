"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import {
  fetchWarpoolLensPreview,
  fetchWarpoolQueueAssets,
} from "@/src/features/warpool/lib/api";
import {
  enterPoolTx,
  ensureErc721Approval,
  getActiveReservationIdOnChain,
  getBrowserSigner,
  getWarpoolComradesCollection,
  getWarpoolCoreAddress,
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
import { shortAddress } from "@/src/features/warpool/lib/helpers";
import CountdownChip from "@/src/features/warpool/components/CountdownChip";
import WarpoolTxModal from "@/src/features/warpool/components/WarpoolTxModal";

type Props = {
  queue: WarpoolQueue;
  eligibility: WarpoolQueueEligibility | null;
  onRefresh?: () => void | Promise<void>;
};

function AssetCard({
  asset,
  selected,
  onClick,
  accent,
}: {
  asset: WarpoolOwnedAsset;
  selected: boolean;
  onClick: () => void;
  accent?: "comrade" | "relic";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group rounded-[24px] border p-3 text-left transition",
        selected
          ? "border-accent bg-accent/8"
          : "border-border bg-background/80 hover:bg-card",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-border bg-card">
          {asset.imageUrl ? (
            <Image
              src={asset.imageUrl}
              alt={asset.name ?? `Token #${asset.tokenId}`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-foreground/35">
              {accent === "relic" ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {asset.name ??
              `${accent === "relic" ? "Relic" : "Comrade"} #${asset.tokenId}`}
          </div>
          <div className="mt-1 text-xs text-foreground/50">
            Token #{asset.tokenId}
          </div>
          {asset.rarityScore ? (
            <div className="mt-1 text-xs text-foreground/42">
              Rarity {asset.rarityScore}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function QueueJoinCard({
  queue,
  eligibility,
  onRefresh,
}: Props) {
  const { isConnected, address } = useDecentWalletAccount();

  const [assets, setAssets] = useState<WarpoolQueueAssetsPayload>({
    comrades: [],
    relics: [],
  });
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [selectedComrade, setSelectedComrade] =
    useState<WarpoolOwnedAsset | null>(null);
  const [selectedRelic, setSelectedRelic] =
    useState<WarpoolOwnedAsset | null>(null);

  const [preview, setPreview] = useState<WarpoolLensPreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRequestId = useRef(0);

  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Preparing action");
  const [modalStatus, setModalStatus] = useState("Starting...");
  const [modalTxHash, setModalTxHash] = useState<string | null>(null);

  async function loadAssets() {
    if (!address) return;
    setAssetsLoading(true);

    try {
      const data = await fetchWarpoolQueueAssets(queue.slug, address);
      setAssets(data);

      setSelectedComrade((current) => {
        if (
          current &&
          data.comrades.some((item) => item.nftId === current.nftId)
        ) {
          return current;
        }
        return data.comrades[0] ?? null;
      });

      setSelectedRelic((current) => {
        if (
          current &&
          data.relics.some((item) => item.nftId === current.nftId)
        ) {
          return current;
        }
        return null;
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load owned assets."
      );
    } finally {
      setAssetsLoading(false);
    }
  }

  useEffect(() => {
    if (!isConnected || !address) {
      setAssets({ comrades: [], relics: [] });
      setSelectedComrade(null);
      setSelectedRelic(null);
      setPreview(null);
      return;
    }

    void loadAssets();
  }, [isConnected, address, queue.slug]);

  useEffect(() => {
    if (!address || !selectedComrade || !queue.poolId) {
      setPreview(null);
      return;
    }

    const currentRequestId = ++previewRequestId.current;

    const id = window.setTimeout(async () => {
      setPreviewLoading(true);

      try {
        const data = await fetchWarpoolLensPreview({
          queueSlug: queue.slug,
          walletAddress: address,
          comradeTokenId: selectedComrade.tokenId,
          relicTokenId: selectedRelic?.tokenId ?? null,
        });

        if (previewRequestId.current === currentRequestId) {
          setPreview(data);
        }
      } catch {
        if (previewRequestId.current === currentRequestId) {
          setPreview(null);
        }
      } finally {
        if (previewRequestId.current === currentRequestId) {
          setPreviewLoading(false);
        }
      }
    }, 220);

    return () => window.clearTimeout(id);
  }, [address, queue.slug, queue.poolId, selectedComrade, selectedRelic]);

  const hasLivePool = !!queue.poolId && !!preview?.poolIdOnChain;

  const canReserveRelic = useMemo(() => {
    return (
      !!selectedComrade &&
      !!selectedRelic &&
      !!preview?.canReserveRelic &&
      !busy &&
      hasLivePool
    );
  }, [selectedComrade, selectedRelic, preview?.canReserveRelic, busy, hasLivePool]);

  const canEnter = useMemo(() => {
    if (!selectedComrade || !hasLivePool || busy) return false;
    if (!preview) return true;
    return !!preview.canEnter;
  }, [selectedComrade, hasLivePool, busy, preview]);

  async function refreshAfterWrite() {
    await onRefresh?.();
    window.setTimeout(() => {
      void onRefresh?.();
    }, 5000);
  }

  async function refreshPreview(nextComradeTokenId: string, nextRelicTokenId?: string | null) {
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
    if (!address || !selectedComrade || !selectedRelic || !preview?.poolIdOnChain) {
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
        poolIdOnChain: preview.poolIdOnChain,
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
    if (!address || !selectedComrade || !preview?.poolIdOnChain) return;

    try {
      setBusy(true);
      setModalOpen(true);
      setModalTitle("Entering live pool");
      setModalTxHash(null);
      setModalStatus("Connecting wallet...");

      const { provider, signer, signerAddress } = await getBrowserSigner(address);
      const coreAddress = getWarpoolCoreAddress();
      const comradesCollection = getWarpoolComradesCollection();

      await ensureErc721Approval({
        signer,
        ownerAddress: signerAddress,
        collection: comradesCollection,
        tokenId: selectedComrade.tokenId,
        operator: coreAddress,
        onStatus: setModalStatus,
      });

      let reservationIdOnChain = preview.activeReservationIdOnChain;

      if (selectedRelic && !reservationIdOnChain) {
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
          poolIdOnChain: preview.poolIdOnChain,
          comradeTokenId: selectedComrade.tokenId,
          relicTokenId: selectedRelic.tokenId,
        });

        setModalTxHash(reserveResult.txHash);
        setModalStatus("Reading active reservation from lens...");

        reservationIdOnChain = await getActiveReservationIdOnChain({
          provider,
          poolIdOnChain: preview.poolIdOnChain,
          walletAddress: signerAddress,
        });
      }

      setModalStatus("Submitting enterPool transaction...");
      const enterResult = await enterPoolTx({
        signer,
        poolIdOnChain: preview.poolIdOnChain,
        comradeTokenId: selectedComrade.tokenId,
        relicTokenId: selectedRelic?.tokenId ?? null,
        reservationIdOnChain,
      });

      setModalTxHash(enterResult.txHash);
      setModalStatus("Entry confirmed on-chain. Refreshing queue state...");

      await refreshAfterWrite();
      await loadAssets();
      await refreshPreview(
        selectedComrade.tokenId,
        selectedRelic?.tokenId ?? null
      );

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

  return (
    <>
      <div className="rounded-[34px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)]">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/42">
            Enter live pool
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Select your loadout</h2>
        </div>

        {isConnected ? (
          <div className="mb-4 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
            Wallet connected as{" "}
            <span className="font-medium">{shortAddress(address)}</span>
          </div>
        ) : (
          <div className="mb-4 rounded-[24px] border border-border bg-background/80 p-4 text-sm text-foreground/70">
            Connect your wallet from the global header to load your comrades and relics.
          </div>
        )}

        <div className="space-y-3 rounded-[28px] border border-border bg-background/80 p-4">
          <div className="flex items-center justify-between text-sm text-foreground/60">
            <span>Stake</span>
            <span className="font-medium text-foreground">{queue.stake}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-foreground/60">
            <span>Platform fee</span>
            <span className="font-medium text-foreground">{queue.fee}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-foreground/60">
            <span>Format</span>
            <span className="font-medium text-foreground">{queue.format}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <CountdownChip value={queue.expiresAt} mode="reservation" />
          {eligibility?.reservationExpiresAt ? (
            <CountdownChip
              value={eligibility.reservationExpiresAt}
              mode="reservation"
            />
          ) : null}
        </div>

        <div className="mt-6">
          <div className="mb-3 text-sm font-medium text-foreground">
            Choose comrade
          </div>

          {assetsLoading ? (
            <div className="rounded-[24px] border border-border bg-background/80 p-4 text-sm text-foreground/60">
              Loading owned comrades...
            </div>
          ) : assets.comrades.length === 0 ? (
            <div className="rounded-[24px] border border-border bg-background/80 p-4 text-sm text-foreground/60">
              No owned comrades found for this wallet under the configured collection.
            </div>
          ) : (
            <div className="grid gap-3">
              {assets.comrades.map((asset) => (
                <AssetCard
                  key={asset.nftId}
                  asset={asset}
                  selected={selectedComrade?.nftId === asset.nftId}
                  onClick={() => setSelectedComrade(asset)}
                  accent="comrade"
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-3 text-sm font-medium text-foreground">
            Choose relic <span className="text-foreground/45">(optional)</span>
          </div>

          <div className="mb-3">
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
              No relic
            </button>
          </div>

          {assetsLoading ? (
            <div className="rounded-[24px] border border-border bg-background/80 p-4 text-sm text-foreground/60">
              Loading owned relics...
            </div>
          ) : assets.relics.length === 0 ? (
            <div className="rounded-[24px] border border-border bg-background/80 p-4 text-sm text-foreground/60">
              No owned relics found for this wallet under the configured collection.
            </div>
          ) : (
            <div className="grid gap-3">
              {assets.relics.map((asset) => (
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
        </div>

        <div className="mt-6 rounded-[24px] border border-border bg-background/80 p-4">
          <div className="text-sm font-medium text-foreground">Live lens check</div>

          {!isConnected ? (
            <p className="mt-2 text-sm text-foreground/60">
              Connect your wallet to run live queue eligibility checks.
            </p>
          ) : !selectedComrade ? (
            <p className="mt-2 text-sm text-foreground/60">
              Select a comrade to preview live eligibility.
            </p>
          ) : previewLoading ? (
            <p className="mt-2 text-sm text-foreground/60">
              Checking lens rules...
            </p>
          ) : preview ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-foreground/60">Reserve relic</span>
                <span className="font-medium text-foreground">
                  {selectedRelic
                    ? preview.canReserveRelic
                      ? "Allowed"
                      : preview.reserveReason || "Unavailable"
                    : "No relic selected"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-foreground/60">Enter pool</span>
                <span className="font-medium text-foreground">
                  {preview.canEnter
                    ? "Allowed"
                    : preview.enterReason || "Unavailable"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-foreground/60">Active reservation</span>
                <span className="font-medium text-foreground">
                  {preview.activeReservationIdOnChain ?? "None"}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-foreground/60">
              Live eligibility preview is not available yet.
            </p>
          )}
        </div>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            disabled={!canEnter}
            onClick={() => void handleEnterPool()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-foreground/15 disabled:text-foreground/40"
          >
            {busy ? "Processing..." : "Enter live pool"}
          </button>

          {selectedRelic ? (
            <button
              type="button"
              disabled={!canReserveRelic}
              onClick={() => void handleReserveOnly()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:bg-card disabled:text-foreground/40"
            >
              {busy ? "Processing..." : "Reserve relic bonus"}
            </button>
          ) : null}
        </div>

        <p className="mt-4 text-xs leading-6 text-foreground/45">
          This flow reads owned assets from the indexed DB, checks rules through
          the live lens contract, writes approvals and pool entry on-chain, and
          refreshes the indexed Warpool UI.
        </p>
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
