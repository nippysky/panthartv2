import { Eye } from "lucide-react";
import { barWidth } from "@/src/features/warpool/lib/helpers";
import type { WarpoolBattle } from "@/src/features/warpool/types";

type Props = {
  battle: WarpoolBattle;
};

export default function BattleArenaCard({ battle }: Props) {
  return (
    <div className="mt-6 rounded-[28px] border border-border bg-background/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Arena state</div>
          <div className="mt-1 text-sm text-foreground/55">{battle.arena}</div>
        </div>
        <Eye className="h-5 w-5 text-foreground/55" />
      </div>

      <div className="grid gap-4">
        {battle.fighters.map((fighter) => (
          <div
            key={`${fighter.side}-${fighter.wallet}`}
            className="rounded-[24px] border border-border bg-card p-4"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{fighter.side}</div>
                <div className="mt-1 text-sm text-foreground/55">
                  {fighter.wallet}
                </div>
              </div>

              <div className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground/68">
                {fighter.status}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-foreground/48">
              <span>Battle power</span>
              <span>{fighter.health}%</span>
            </div>

            <div className="mt-2 h-2.5 rounded-full bg-foreground/8">
              <div
                className="h-2.5 rounded-full bg-accent"
                style={{ width: `${barWidth(fighter.health)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}