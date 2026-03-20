"use client";

import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { shortAddress } from "@/src/features/warpool/lib/helpers";
import ActionNotice from "@/src/features/warpool/components/ActionNotice";
import CountdownChip from "@/src/features/warpool/components/CountdownChip";
import type { WarpoolBattleEligibility } from "@/src/features/warpool/types";

type Props = {
  eligibility: WarpoolBattleEligibility | null;
  onConfirm: () => Promise<unknown> | unknown;
  onClaim: () => Promise<unknown> | unknown;
  isConfirming?: boolean;
  isClaiming?: boolean;
  actionMessage?: string | null;
};

export default function WalletGateCard({
  eligibility,
  onConfirm,
  onClaim,
  isConfirming = false,
  isClaiming = false,
  actionMessage,
}: Props) {
  const { isConnected, address } = useDecentWalletAccount();

  const confirmDisabled = !isConnected || !eligibility?.canConfirm || isConfirming;
  const claimDisabled = !isConnected || !eligibility?.canClaim || isClaiming;

  async function handleConfirm() {
    try {
      await onConfirm();
      toast.success("Participation confirmed.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to confirm participation."
      );
    }
  }

  async function handleClaim() {
    try {
      await onClaim();
      toast.success("Claim flow started.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to claim result."
      );
    }
  }

  return (
    <div className="rounded-[30px] border border-border bg-background/80 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70">
        <Wallet className="h-4 w-4 text-accent" />
        Gated actions
      </div>

      {isConnected ? (
        <div className="mb-4 rounded-[22px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
          Connected as {shortAddress(address)}
        </div>
      ) : (
        <div className="mb-4 rounded-[22px] border border-border bg-card p-4 text-sm text-foreground/70">
          Connect wallet from the global header to unlock confirm, claim, and
          other gated battle interactions.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <CountdownChip value={eligibility?.claimableAt} mode="claim" />
      </div>

      <div className="mt-4 space-y-3">
        <button
          disabled={confirmDisabled}
          onClick={() => void handleConfirm()}
          className="w-full rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-foreground/15 disabled:text-foreground/40"
        >
          {isConfirming ? "Confirming..." : "Confirm participation"}
        </button>

        <button
          disabled={claimDisabled}
          onClick={() => void handleClaim()}
          className="w-full rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:bg-card disabled:text-foreground/40"
        >
          {isClaiming ? "Claiming..." : "Claim result"}
        </button>
      </div>

      <div className="mt-4">
        <ActionNotice message={actionMessage} />
      </div>

      <p className="mt-4 text-xs leading-6 text-foreground/45">
        Battle actions now follow real eligibility state and show toast feedback
        through the app-level sonner toaster.
      </p>
    </div>
  );
}