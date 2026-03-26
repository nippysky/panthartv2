"use client";

import { Crown, Trophy } from "lucide-react";
import type { WarpoolBattle } from "@/src/features/warpool/types";
import { shortAddress } from "@/src/features/warpool/lib/helpers";
import { formatNumber } from "@/src/lib/utils";

type Props = {
  battle: WarpoolBattle;
};

function displayName(username: string | null, wallet: string | null) {
  if (username) return username;
  if (wallet) return shortAddress(wallet);
  return "—";
}

function formatCompactAmount(value: string | null | undefined) {
  if (!value) return "0";
  const match = value.trim().match(/^([+-]?\d*\.?\d+)\s*(.*)$/);
  if (!match) return value;

  const numeric = Number(match[1]);
  const suffix = match[2]?.trim();

  if (!Number.isFinite(numeric)) return value;

  const compact = formatNumber(numeric, { min: 0, max: 2 });
  return suffix ? `${compact} ${suffix}` : compact;
}

function findPrize(battle: WarpoolBattle, placement: 1 | 2 | 3): string {
  const match = battle.entries.find((entry) => entry.placement === placement);
  return formatCompactAmount(match?.prizeAmount ?? "—");
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

  const firstPrize = findPrize(battle, 1);
  const secondPrize = findPrize(battle, 2);
  const thirdPrize = findPrize(battle, 3);

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
            {formatCompactAmount(battle.prizePool)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span>On-chain pool id</span>
          <span className="text-right font-medium text-foreground">
            {battle.poolIdOnChain ?? "—"}
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-4">
        <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <Trophy className="h-4 w-4 text-accent" />
          Podium
        </div>

        <div className="space-y-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-foreground/55">1st</div>
              <div className="truncate font-medium text-foreground">{first}</div>
            </div>
            <div className="shrink-0 text-right font-medium text-foreground">
              {firstPrize}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-foreground/55">2nd</div>
              <div className="truncate font-medium text-foreground">{second}</div>
            </div>
            <div className="shrink-0 text-right font-medium text-foreground">
              {secondPrize}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-foreground/55">3rd</div>
              <div className="truncate font-medium text-foreground">{third}</div>
            </div>
            <div className="shrink-0 text-right font-medium text-foreground">
              {thirdPrize}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}