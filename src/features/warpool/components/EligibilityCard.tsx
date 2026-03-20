import {
  CheckCircle2,
  Clock3,
  Lock,
  ShieldAlert,
  Trophy,
  UserCheck,
} from "lucide-react";
import type {
  WarpoolBattleEligibility,
  WarpoolQueueEligibility,
} from "@/src/features/warpool/types";
import CountdownChip from "@/src/features/warpool/components/CountdownChip";

type Props =
  | {
      type: "queue";
      eligibility: WarpoolQueueEligibility | null;
    }
  | {
      type: "battle";
      eligibility: WarpoolBattleEligibility | null;
    };

function reasonLabel(reason?: string | null) {
  switch (reason) {
    case "ok":
      return "Eligible";
    case "wallet_required":
      return "Wallet required";
    case "queue_full":
      return "Queue full";
    case "already_reserved":
      return "Already reserved";
    case "queue_locked":
      return "Queue locked";
    case "not_participant":
      return "Not a participant";
    case "already_confirmed":
      return "Already confirmed";
    case "not_claimable_yet":
      return "Claim not ready";
    case "already_claimed":
      return "Already claimed";
    case "battle_not_settled":
      return "Battle not settled";
    default:
      return "Unavailable";
  }
}

function toneClass(reason?: string | null) {
  switch (reason) {
    case "ok":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    case "wallet_required":
    case "not_claimable_yet":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200";
    default:
      return "border-border bg-background text-foreground/70";
  }
}

export default function EligibilityCard(props: Props) {
  if (props.type === "queue") {
    const eligibility = props.eligibility;

    return (
      <div className="rounded-[30px] border border-border bg-card/85 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)]">
        <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70">
          <ShieldAlert className="h-4 w-4 text-accent" />
          Eligibility
        </div>

        {!eligibility ? (
          <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm text-foreground/60">
            Eligibility data is not available yet.
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className={`rounded-[22px] border p-4 text-sm ${toneClass(
                eligibility.reason
              )}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>Reserve status</span>
                <span className="font-medium">
                  {reasonLabel(eligibility.reason)}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 text-foreground/70">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Can reserve
                </div>
                <div className="font-medium">
                  {eligibility.canReserve ? "Yes" : "No"}
                </div>
              </div>

              <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 text-foreground/70">
                  <Lock className="h-4 w-4 text-accent" />
                  Reserved by you
                </div>
                <div className="font-medium">
                  {eligibility.isReservedByViewer ? "Yes" : "No"}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm">
              <div className="mb-3 flex items-center gap-2 text-foreground/70">
                <Clock3 className="h-4 w-4 text-accent" />
                Reservation expiry
              </div>
              <CountdownChip
                value={eligibility.reservationExpiresAt}
                mode="reservation"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  const eligibility = props.eligibility;

  return (
    <div className="rounded-[30px] border border-border bg-card/85 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)]">
      <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70">
        <ShieldAlert className="h-4 w-4 text-accent" />
        Eligibility
      </div>

      {!eligibility ? (
        <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm text-foreground/60">
          Eligibility data is not available yet.
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`rounded-[22px] border p-4 text-sm ${toneClass(
              eligibility.reason
            )}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span>Battle status</span>
              <span className="font-medium">
                {reasonLabel(eligibility.reason)}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 text-foreground/70">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                Can confirm
              </div>
              <div className="font-medium">
                {eligibility.canConfirm ? "Yes" : "No"}
              </div>
            </div>

            <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 text-foreground/70">
                <Trophy className="h-4 w-4 text-accent" />
                Can claim
              </div>
              <div className="font-medium">
                {eligibility.canClaim ? "Yes" : "No"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 text-foreground/70">
                <UserCheck className="h-4 w-4 text-accent" />
                Participant
              </div>
              <div className="font-medium">
                {eligibility.isParticipant ? "Yes" : "No"}
              </div>
            </div>

            <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 text-foreground/70">
                <Trophy className="h-4 w-4 text-accent" />
                Winner
              </div>
              <div className="font-medium">
                {eligibility.isWinner ? "Yes" : "No"}
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-border bg-background/80 p-4 text-sm">
            <div className="mb-3 flex items-center gap-2 text-foreground/70">
              <Clock3 className="h-4 w-4 text-accent" />
              Claimable at
            </div>
            <CountdownChip value={eligibility.claimableAt} mode="claim" />
          </div>
        </div>
      )}
    </div>
  );
}