"use client";

import { Crown, Trophy } from "lucide-react";
import type { WarpoolBattle } from "@/src/features/warpool/types";
import { shortAddress } from "@/src/features/warpool/lib/helpers";

type Props = {
  battle: WarpoolBattle;
};

function displayName(username: string | null, wallet: string | null) {
  if (username) return username;
  if (wallet) return shortAddress(wallet);
  return "—";
}

export default function BattleSummaryCard({ battle }: Props) {
  const first = displayName(
    battle.placements.firstPlaceUsername,
    battle.placements.firstPlaceWallet
  );

  const second = displayName(
    battle.placements.secondPlaceUsername,
    battle.placements.secondPlaceWallet
  );

  const third = displayName(
    battle.placements.thirdPlaceUsername,
    battle.placements.thirdPlaceWallet
  );

  return (
    <div className="rounded-[28px] border border-border bg-background/80 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
        <Crown className="h-4 w-4 text-accent" />
        Pool facts
      </div>

      <div className="space-y-3 text-sm text-foreground/62">
        <div className="flex items-center justify-between gap-4">
          <span>Queue</span>
          <span className="text-right font-medium text-foreground">{battle.queue}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span>Status</span>
          <span className="text-right font-medium text-foreground">{battle.state}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span>Prize pool</span>
          <span className="text-right font-medium text-foreground">
            {battle.prizePool}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-4">
        <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <Trophy className="h-4 w-4 text-accent" />
          Podium
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground/55">1st</span>
            <span className="truncate font-medium text-foreground">{first}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground/55">2nd</span>
            <span className="truncate font-medium text-foreground">{second}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground/55">3rd</span>
            <span className="truncate font-medium text-foreground">{third}</span>
          </div>
        </div>
      </div>
    </div>
  );
}