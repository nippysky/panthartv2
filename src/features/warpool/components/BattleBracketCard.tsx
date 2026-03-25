"use client";

import { Swords, Trophy } from "lucide-react";
import type { WarpoolBattle, WarpoolBattleMatch } from "@/src/features/warpool/types";

type Props = {
  battle: WarpoolBattle;
};

function entryName(
  battle: WarpoolBattle,
  entryId: string | null | undefined
): string {
  if (!entryId) return "TBD";
  const found = battle.entries.find((entry) => entry.id === entryId);
  if (!found) return "TBD";
  return found.comradeName ?? `Comrade #${found.comradeTokenId}`;
}

function entryUser(
  battle: WarpoolBattle,
  entryId: string | null | undefined
): string {
  if (!entryId) return "Waiting";
  const found = battle.entries.find((entry) => entry.id === entryId);
  if (!found) return "Waiting";
  return found.username ?? found.wallet.slice(0, 6);
}

function formatScore(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(1).replace(/\.0$/, "");
}

function getEarlyFinishNote(match: WarpoolBattleMatch) {
  if (!Array.isArray(match.rounds) || match.rounds.length === 0) return null;

  const hasSuddenDeath = match.rounds.some((round) => round.suddenDeath);
  if (hasSuddenDeath) return null;

  if (match.rounds.length === 1) {
    return "Only one round is stored for this match.";
  }

  if (match.rounds.length === 2) {
    const aWins = match.rounds.filter(
      (round) => round.winner === match.slotAEntryId
    ).length;
    const bWins = match.rounds.filter(
      (round) => round.winner === match.slotBEntryId
    ).length;

    if (aWins === 2 || bWins === 2) {
      return "No Round 3 needed — match ended 2-0.";
    }
  }

  return null;
}

function MatchCard({
  battle,
  match,
}: {
  battle: WarpoolBattle;
  match: WarpoolBattleMatch;
}) {
  const aWon = match.winnerEntryId === match.slotAEntryId;
  const bWon = match.winnerEntryId === match.slotBEntryId;
  const earlyFinishNote = getEarlyFinishNote(match);

  return (
    <div className="min-w-0 rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
            {match.stage}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            Match {match.matchNumber}
          </div>
        </div>

        <div className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground/65">
          Round {match.roundNumber}
        </div>
      </div>

      <div className="space-y-3">
        <div
          className={[
            "min-w-0 rounded-2xl border px-3 py-3",
            aWon
              ? "border-accent/30 bg-accent/10"
              : "border-border bg-background/80",
          ].join(" ")}
        >
          <div className="truncate text-sm font-medium text-foreground">
            {entryName(battle, match.slotAEntryId)}
          </div>
          <div className="mt-1 truncate text-xs text-foreground/50">
            {entryUser(battle, match.slotAEntryId)}
          </div>
        </div>

        <div
          className={[
            "min-w-0 rounded-2xl border px-3 py-3",
            bWon
              ? "border-accent/30 bg-accent/10"
              : "border-border bg-background/80",
          ].join(" ")}
        >
          <div className="truncate text-sm font-medium text-foreground">
            {entryName(battle, match.slotBEntryId)}
          </div>
          <div className="mt-1 truncate text-xs text-foreground/50">
            {entryUser(battle, match.slotBEntryId)}
          </div>
        </div>
      </div>

      {match.rounds.length > 0 ? (
        <div className="mt-4 rounded-[20px] border border-border bg-background/70 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-foreground/38">
            Round simulation
          </div>

          <div className="space-y-2">
            {match.rounds.map((round) => (
              <div
                key={`${match.id}-${round.round}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-3 py-2 text-xs"
              >
                <div className="min-w-0 text-foreground/55">
                  Round {round.round}
                  {round.suddenDeath ? " · Sudden death" : ""}
                </div>

                <div className="shrink-0 font-medium text-foreground">
                  {formatScore(round.aScore)} - {formatScore(round.bScore)}
                </div>
              </div>
            ))}
          </div>

          {earlyFinishNote ? (
            <div className="mt-3 text-[11px] text-foreground/45">
              {earlyFinishNote}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-[20px] border border-border bg-background/70 px-3 py-3 text-xs text-foreground/55">
          Simulation not yet computed.
        </div>
      )}
    </div>
  );
}

export default function BattleBracketCard({ battle }: Props) {
  const rounds = Array.from(
    new Set(battle.matches.map((match) => match.roundNumber))
  ).sort((a, b) => a - b);

  const first = battle.entries.find(
    (entry) => entry.id === battle.placements.firstEntryId
  );

  return (
    <div className="mt-6 rounded-[28px] border border-border bg-background/80 p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">Battle simulation</div>
          <div className="mt-1 text-sm text-foreground/55">
            Live bracket, match rounds, and final outcome
          </div>
        </div>
        <Swords className="h-5 w-5 shrink-0 text-foreground/55" />
      </div>

      {battle.matches.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-4 text-sm text-foreground/60">
          The pool has not produced a computed bracket yet. Check back once battle
          processing is complete.
        </div>
      ) : (
        <div className="space-y-5">
          {first ? (
            <div className="rounded-[26px] border border-accent/25 bg-accent/10 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                    Leaderboard spotlight
                  </div>
                  <div className="mt-2 wrap-break-word text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {first.comradeName ?? `Comrade #${first.comradeTokenId}`}
                  </div>
                  <div className="mt-2 truncate text-sm text-foreground/62">
                    {first.username ?? first.wallet.slice(0, 6)}
                  </div>
                </div>

                <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-yellow-500/25 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-700 dark:text-yellow-200">
                  <Trophy className="h-4 w-4" />
                  Winner
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-6">
            {rounds.map((roundNumber) => {
              const roundMatches = battle.matches.filter(
                (match) => match.roundNumber === roundNumber
              );

              return (
                <section key={roundNumber} className="min-w-0 space-y-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                    Bracket round {roundNumber}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {roundMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        battle={battle}
                        match={match}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}