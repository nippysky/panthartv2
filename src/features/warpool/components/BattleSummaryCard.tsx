import { Crown, Shield } from "lucide-react";
import type { WarpoolBattle } from "@/src/features/warpool/types";
import { shortAddress } from "@/src/features/warpool/lib/helpers";

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
          <span>Prize pool</span>
          <span className="text-foreground">{battle.prizePool}</span>
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-border bg-card p-4 text-xs leading-6 text-foreground/55">
        <div className="mb-2 inline-flex items-center gap-2 text-foreground/70">
          <Crown className="h-3.5 w-3.5 text-accent" />
          Podium
        </div>

        <div className="space-y-2">
          <div>1st: {battle.firstPlaceWallet ? shortAddress(battle.firstPlaceWallet) : "—"}</div>
          <div>2nd: {battle.secondPlaceWallet ? shortAddress(battle.secondPlaceWallet) : "—"}</div>
          <div>3rd: {battle.thirdPlaceWallet ? shortAddress(battle.thirdPlaceWallet) : "—"}</div>
        </div>
      </div>
    </div>
  );
}