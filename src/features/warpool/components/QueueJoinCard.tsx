"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { reserveWarpoolQueueSlot } from "@/src/features/warpool/lib/api";
import { shortAddress } from "@/src/features/warpool/lib/helpers";
import ActionNotice from "@/src/features/warpool/components/ActionNotice";
import CountdownChip from "@/src/features/warpool/components/CountdownChip";
import type {
  WarpoolQueue,
  WarpoolQueueEligibility,
} from "@/src/features/warpool/types";

type Props = {
  queue: WarpoolQueue;
  eligibility: WarpoolQueueEligibility | null;
  onReserved?: () => void | Promise<void>;
};

export default function QueueJoinCard({
  queue,
  eligibility,
  onReserved,
}: Props) {
  const { isConnected, address } = useDecentWalletAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [optimisticReserved, setOptimisticReserved] = useState(false);
  const [optimisticExpiry, setOptimisticExpiry] = useState<string | null>(null);

  const canReserve = useMemo(() => {
    if (!isConnected) return false;
    if (optimisticReserved) return false;
    return !!eligibility?.canReserve;
  }, [eligibility?.canReserve, isConnected, optimisticReserved]);

  const expiryValue =
    optimisticExpiry ?? eligibility?.reservationExpiresAt ?? null;

  async function handleReserve() {
    if (!address) {
      toast.error("Connect your wallet to reserve a queue slot.");
      return;
    }

    setIsSubmitting(true);
    setActionMessage("Submitting reservation...");
    setOptimisticReserved(true);
    setOptimisticExpiry(
      eligibility?.reservationExpiresAt ??
        new Date(Date.now() + 8 * 60 * 1000).toISOString()
    );

    try {
      const result = await reserveWarpoolQueueSlot(queue.slug, address);
      setActionMessage(result.message);
      toast.success(result.message);
      await onReserved?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to reserve slot.";
      setOptimisticReserved(false);
      setOptimisticExpiry(null);
      setActionMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-[34px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)]">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-foreground/42">
          Reserve slot
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Join this queue</h2>
      </div>

      {isConnected ? (
        <div className="mb-4 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
          Wallet connected as{" "}
          <span className="font-medium">{shortAddress(address)}</span>
        </div>
      ) : (
        <div className="mb-4 rounded-[24px] border border-border bg-background/80 p-4 text-sm text-foreground/70">
          Connect your wallet from the global header to reserve a slot and
          access gated battle actions.
        </div>
      )}

      <div className="space-y-3 rounded-[28px] border border-border bg-background/80 p-4">
        <div className="flex items-center justify-between text-sm text-foreground/60">
          <span>Stake</span>
          <span className="font-medium text-foreground">{queue.stake}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-foreground/60">
          <span>Queue fee</span>
          <span className="font-medium text-foreground">{queue.fee}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-foreground/60">
          <span>Format</span>
          <span className="font-medium text-foreground">{queue.format}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <CountdownChip value={expiryValue} mode="reservation" />
      </div>

      <button
        type="button"
        disabled={!canReserve || isSubmitting}
        onClick={handleReserve}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-foreground/15 disabled:text-foreground/40"
      >
        {isSubmitting
          ? "Reserving..."
          : !isConnected
          ? "Connect wallet to enter"
          : optimisticReserved
          ? "Reserved"
          : eligibility?.canReserve
          ? "Reserve queue slot"
          : "Reservation unavailable"}
      </button>

      <div className="mt-4">
        <ActionNotice message={actionMessage} />
      </div>

      <p className="mt-3 text-xs leading-6 text-foreground/45">
        Queue actions now use app toasts, optimistic local state, and live
        eligibility.
      </p>
    </div>
  );
}