import Image from "next/image";
import { Eye, Shield, Trophy } from "lucide-react";
import type { WarpoolBattle } from "@/src/features/warpool/types";
import { shortAddress } from "@/src/features/warpool/lib/helpers";

type Props = {
  battle: WarpoolBattle;
};

export default function BattleArenaCard({ battle }: Props) {
  return (
    <div className="mt-6 rounded-[28px] border border-border bg-background/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Battle entries</div>
          <div className="mt-1 text-sm text-foreground/55">{battle.arena}</div>
        </div>
        <Eye className="h-5 w-5 text-foreground/55" />
      </div>

      {battle.entries.length === 0 ? (
        <div className="rounded-[24px] border border-border bg-card p-4 text-sm text-foreground/60">
          No indexed entries available for this pool yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {battle.entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-[24px] border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-border bg-background">
                    {entry.comradeImageUrl ? (
                      <Image
                        src={entry.comradeImageUrl}
                        alt={entry.comradeName ?? `Comrade #${entry.comradeTokenId}`}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-foreground/35">
                        <Shield className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-medium">
                      {entry.comradeName ?? `Comrade #${entry.comradeTokenId}`}
                    </div>
                    <div className="mt-1 text-sm text-foreground/55">
                      Owner {shortAddress(entry.wallet)}
                    </div>
                    <div className="mt-1 text-xs text-foreground/45">
                      Token #{entry.comradeTokenId}
                      {entry.relicTokenId ? ` · Relic #${entry.relicTokenId}` : ""}
                      {entry.relicType !== "NONE" ? ` · ${entry.relicType}` : ""}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {entry.placement ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-200">
                      <Trophy className="h-3.5 w-3.5" />
                      #{entry.placement}
                    </div>
                  ) : (
                    <div className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground/68">
                      {entry.status}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-foreground/45">
                    Stake {entry.paidStake}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}