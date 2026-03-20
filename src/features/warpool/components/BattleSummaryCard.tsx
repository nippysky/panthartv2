import { Crown, Lock, Shield } from "lucide-react";
import type { WarpoolBattle } from "@/src/features/warpool/types";

type Props = {
  battle: WarpoolBattle;
};

export default function BattleSummaryCard({ battle }: Props) {
  return (
    <div className="rounded-[30px] border border-border bg-background/80 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70">
        <Shield className="h-4 w-4 text-accent" />
        Pool facts
      </div>

      <div className="space-y-3 text-sm text-foreground/60">
        <div className="flex items-center justify-between">
          <span>Queue</span>
          <span className="text-foreground">{battle.queue}</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Status</span>
          <span className="text-foreground">{battle.state}</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Reward path</span>
          <span className="inline-flex items-center gap-1 text-foreground">
            <Crown className="h-4 w-4 text-accent" />
            Winner payout
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-border bg-card p-4 text-xs leading-6 text-foreground/45">
        <div className="mb-2 inline-flex items-center gap-2 text-foreground/65">
          <Lock className="h-3.5 w-3.5 text-accent" />
          Notes
        </div>
        Real battle events, reservation ownership, elimination state, relist
        outcome cards, and settlement receipts will come next when we wire the
        live frontend data layer from scratch.
      </div>
    </div>
  );
}