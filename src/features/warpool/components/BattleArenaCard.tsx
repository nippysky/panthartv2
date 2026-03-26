"use client";

import Image from "next/image";
import { ChevronDown, Eye, Shield, Sparkles, Trophy } from "lucide-react";
import type { WarpoolBattle } from "@/src/features/warpool/types";
import { shortAddress } from "@/src/features/warpool/lib/helpers";
import { formatNumber } from "@/src/lib/utils";

type Props = {
  battle: WarpoolBattle;
};

function placeTone(placement: number | null) {
  if (placement === 1) {
    return "border-yellow-500/25 bg-yellow-500/10 text-yellow-700 dark:text-yellow-200";
  }
  if (placement === 2) {
    return "border-slate-400/25 bg-slate-400/10 text-slate-700 dark:text-slate-200";
  }
  if (placement === 3) {
    return "border-amber-700/25 bg-amber-700/10 text-amber-700 dark:text-amber-200";
  }
  return "border-border bg-background text-foreground/70";
}

function displayName(username: string | null, wallet: string) {
  return username ?? shortAddress(wallet);
}

function placementLabel(placement: number | null) {
  if (placement === 1) return "Winner";
  if (placement === 2) return "Runner-up";
  if (placement === 3) return "Third";
  return null;
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

function prizeLabel(placement: number | null, prizeAmount: string | null) {
  if (!placement || !prizeAmount) return null;
  const formatted = formatCompactAmount(prizeAmount);
  if (placement === 1) return `1st prize · ${formatted}`;
  if (placement === 2) return `2nd prize · ${formatted}`;
  if (placement === 3) return `3rd prize · ${formatted}`;
  return null;
}

function RosterGrid({ battle }: { battle: WarpoolBattle }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {battle.entries.map((entry) => {
        const winnerPrize = prizeLabel(entry.placement, entry.prizeAmount);

        return (
          <div
            key={entry.id}
            className="group min-w-0 rounded-[26px] border border-border bg-card p-4 transition hover:bg-card/90"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[20px] border border-border bg-background">
                {entry.comradeImageUrl ? (
                  <Image
                    src={entry.comradeImageUrl}
                    alt={entry.comradeName ?? `Comrade #${entry.comradeTokenId}`}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-foreground/35">
                    <Shield className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                {entry.placement ? (
                  <div
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${placeTone(
                      entry.placement
                    )}`}
                  >
                    {placementLabel(entry.placement)}
                  </div>
                ) : (
                  <div className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground/60">
                    {entry.selectedForBattle ? "Selected" : entry.status}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 min-w-0">
              <div className="truncate text-base font-semibold text-foreground">
                {entry.comradeName ?? `Comrade #${entry.comradeTokenId}`}
              </div>

              <div className="mt-1 truncate text-sm text-foreground/58">
                {displayName(entry.username, entry.wallet)}
              </div>

              <div className="mt-2 text-xs text-foreground/45">
                Token #{entry.comradeTokenId}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-border bg-background px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                  Stake
                </div>
                <div className="mt-2 wrap-break-word text-sm font-medium text-foreground">
                  {formatCompactAmount(entry.paidStake)}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                  Loadout
                </div>
                <div className="mt-2 wrap-break-word text-sm font-medium text-foreground">
                  {entry.relicTokenId ? `Relic #${entry.relicTokenId}` : "No relic"}
                </div>
                {entry.relicType !== "NONE" ? (
                  <div className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-foreground/55">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="truncate">{entry.relicType}</span>
                  </div>
                ) : null}
              </div>

              {winnerPrize ? (
                <div className="rounded-2xl border border-accent/15 bg-accent/6 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/38">
                    Prize won
                  </div>
                  <div className="mt-2 wrap-break-word text-sm font-medium text-foreground">
                    {winnerPrize}
                  </div>
                </div>
              ) : null}
            </div>

            {entry.placement === 1 ? (
              <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-200">
                <Trophy className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Final winner</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function BattleArenaCard({ battle }: Props) {
  if (battle.entries.length === 0) {
    return (
      <div className="mt-6 rounded-[28px] border border-border bg-background/80 p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium">Arena roster</div>
            <div className="mt-1 text-sm text-foreground/55">{battle.arena}</div>
          </div>
          <Eye className="h-5 w-5 shrink-0 text-foreground/55" />
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 text-sm text-foreground/60">
          No indexed entries available for this pool yet.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-[28px] border border-border bg-background/80 p-4 sm:p-5">
      <details open className="group">
        <summary className="mb-5 flex cursor-pointer list-none items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium">Arena roster</div>
            <div className="mt-1 text-sm text-foreground/55">{battle.arena}</div>
          </div>

          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 shrink-0 text-foreground/55" />
            <ChevronDown className="h-4 w-4 shrink-0 text-foreground/45 transition group-open:rotate-180" />
          </div>
        </summary>

        <RosterGrid battle={battle} />
      </details>
    </div>
  );
}