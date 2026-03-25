import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CircleDot,
  Gem,
  Settings2,
  Swords,
  TimerReset,
} from "lucide-react";

import { getWarpoolAdminProposalForDetailPage } from "@/src/features/admin/warpool/proposal-queries";
import WarpoolProposalWorkflowPanel from "@/src/features/admin/warpool/WarpoolProposalWorkflowPanel";
import WarpoolProposalMultisigPanel from "@/src/features/admin/warpool/WarpoolProposalMultisigPanel";

type Props = {
  params: Promise<{
    slug: string;
    proposalId: string;
  }>;
};

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === "bigint") return currentValue.toString();
      return currentValue;
    })
  ) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Kvp({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function SmallPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?:
    | "default"
    | "battle"
    | "config"
    | "relic"
    | "fatigue";
}) {
  const className =
    tone === "battle"
      ? "border-accent/20 bg-accent/10 text-accent"
      : tone === "config"
        ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
        : tone === "relic"
          ? "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400"
          : tone === "fatigue"
            ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-border bg-background text-muted";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {children}
    </span>
  );
}

function getFunctionNames(actions: Array<{ functionName?: string | null }>) {
  return actions
    .map((action) => action.functionName ?? null)
    .filter((value): value is string => !!value);
}

function getBattlePreview(snapshotJson: unknown) {
  if (!isPlainObject(snapshotJson)) return null;
  const global = isPlainObject(snapshotJson.global) ? snapshotJson.global : null;
  const battle = global && isPlainObject(global.battle) ? global.battle : null;
  if (!battle) return null;

  return {
    roundsPerMatch:
      typeof battle.roundsPerMatch === "number" ? battle.roundsPerMatch : null,
    traitPowerMin:
      typeof battle.traitPowerMin === "number" ? battle.traitPowerMin : null,
    traitPowerMax:
      typeof battle.traitPowerMax === "number" ? battle.traitPowerMax : null,
    roundVarianceMax:
      typeof battle.roundVarianceMax === "number" ? battle.roundVarianceMax : null,
    microMomentumMax:
      typeof battle.microMomentumMax === "number" ? battle.microMomentumMax : null,
  };
}

function getRelicPreview(snapshotJson: unknown) {
  if (!isPlainObject(snapshotJson)) return null;
  const global = isPlainObject(snapshotJson.global) ? snapshotJson.global : null;
  const relic = global && isPlainObject(global.relic) ? global.relic : null;
  if (!relic) return null;

  return {
    minDiscountBps:
      typeof relic.minDiscountBps === "number" ? relic.minDiscountBps : null,
    maxDiscountBps:
      typeof relic.maxDiscountBps === "number" ? relic.maxDiscountBps : null,
    discountSeatCap:
      typeof relic.discountSeatCap === "number" ? relic.discountSeatCap : null,
    token11SeatCap:
      typeof relic.token11SeatCap === "number" ? relic.token11SeatCap : null,
    reservationTtlSeconds:
      typeof relic.reservationTtlSeconds === "number"
        ? relic.reservationTtlSeconds
        : null,
  };
}

function getFatiguePreview(snapshotJson: unknown) {
  if (!isPlainObject(snapshotJson)) return null;
  const global = isPlainObject(snapshotJson.global) ? snapshotJson.global : null;
  const fatigue = global && isPlainObject(global.fatigue) ? global.fatigue : null;
  if (!fatigue) return null;

  return {
    maxConsecutiveEntries:
      typeof fatigue.maxConsecutiveEntries === "number"
        ? fatigue.maxConsecutiveEntries
        : null,
    cooldownSeconds:
      typeof fatigue.cooldownSeconds === "number" ? fatigue.cooldownSeconds : null,
  };
}

function getQueuePreview(snapshotJson: unknown) {
  if (!isPlainObject(snapshotJson)) return [];
  const queues = snapshotJson.queues;
  if (!Array.isArray(queues)) return [];

  return queues
    .map((queue) => {
      if (!isPlainObject(queue)) return null;

      return {
        slug: typeof queue.slug === "string" ? queue.slug : null,
        enabled: typeof queue.enabled === "boolean" ? queue.enabled : null,
        targetSize:
          typeof queue.targetSize === "number" ? queue.targetSize : null,
        minStartSize:
          typeof queue.minStartSize === "number" ? queue.minStartSize : null,
        openDurationSeconds:
          typeof queue.openDurationSeconds === "number"
            ? queue.openDurationSeconds
            : null,
      };
    })
    .filter(
      (
        value
      ): value is {
        slug: string | null;
        enabled: boolean | null;
        targetSize: number | null;
        minStartSize: number | null;
        openDurationSeconds: number | null;
      } => !!value
    );
}

export default async function WarpoolProposalDetailPage({ params }: Props) {
  const { slug, proposalId } = await params;
  if (!slug || !proposalId) notFound();

  const proposal = await getWarpoolAdminProposalForDetailPage(proposalId);
  if (!proposal) notFound();

  const functionNames = getFunctionNames(proposal.actions);
  const hasBattleAction = functionNames.includes("setBattleConfig");
  const hasQueueAction = functionNames.includes("setQueueConfig");
  const hasRelicAction = functionNames.includes("setRelicConfig");
  const hasFatigueAction = functionNames.includes("setFatigueConfig");
  const hasGlobalAction =
    functionNames.includes("setGlobalFlags") ||
    functionNames.includes("setPauseFlags") ||
    functionNames.includes("setTreasury") ||
    functionNames.includes("setWorkerOperator");

  const battlePreview = getBattlePreview(proposal.snapshotJson);
  const relicPreview = getRelicPreview(proposal.snapshotJson);
  const fatiguePreview = getFatiguePreview(proposal.snapshotJson);
  const queuePreview = getQueuePreview(proposal.snapshotJson);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-[28px] border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Warpool Proposal
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {proposal.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              {proposal.summary ||
                "Review, track, and execute this stored Warpool governance proposal."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <SmallPill>{proposal.kind}</SmallPill>
              {hasBattleAction ? <SmallPill tone="battle">Battle Config</SmallPill> : null}
              {hasQueueAction ? <SmallPill tone="config">Queue Config</SmallPill> : null}
              {hasRelicAction ? <SmallPill tone="relic">Relic Config</SmallPill> : null}
              {hasFatigueAction ? <SmallPill tone="fatigue">Fatigue Config</SmallPill> : null}
              {hasGlobalAction ? <SmallPill tone="config">Global Config</SmallPill> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/${slug}/warpool/proposals`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:bg-card"
            >
              Back to proposals
            </Link>
            <Link
              href={`/admin/${slug}/warpool/config`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:bg-card"
            >
              Config page
            </Link>
          </div>
        </div>
      </div>

      {(hasBattleAction ||
        hasQueueAction ||
        hasRelicAction ||
        hasFatigueAction ||
        hasGlobalAction) && (
        <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
          <div className="mb-5">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
              Config change preview
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              A quick human-readable view of what this proposal is changing.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {hasBattleAction && battlePreview ? (
              <div className="rounded-3xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Swords className="h-4 w-4 text-accent" />
                  Battle simulation
                </div>

                <div className="space-y-2 text-sm text-muted">
                  <div className="flex items-start justify-between gap-4">
                    <span>Rounds per match</span>
                    <span className="font-medium text-foreground">
                      {battlePreview.roundsPerMatch ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Trait power min</span>
                    <span className="font-medium text-foreground">
                      {battlePreview.traitPowerMin ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Trait power max</span>
                    <span className="font-medium text-foreground">
                      {battlePreview.traitPowerMax ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Variance max</span>
                    <span className="font-medium text-foreground">
                      {battlePreview.roundVarianceMax ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Momentum max</span>
                    <span className="font-medium text-foreground">
                      {battlePreview.microMomentumMax ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {hasRelicAction && relicPreview ? (
              <div className="rounded-3xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Gem className="h-4 w-4 text-fuchsia-500" />
                  Relic controls
                </div>

                <div className="space-y-2 text-sm text-muted">
                  <div className="flex items-start justify-between gap-4">
                    <span>Min discount BPS</span>
                    <span className="font-medium text-foreground">
                      {relicPreview.minDiscountBps ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Max discount BPS</span>
                    <span className="font-medium text-foreground">
                      {relicPreview.maxDiscountBps ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Discount seat cap</span>
                    <span className="font-medium text-foreground">
                      {relicPreview.discountSeatCap ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Token 11 seat cap</span>
                    <span className="font-medium text-foreground">
                      {relicPreview.token11SeatCap ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Reservation TTL</span>
                    <span className="font-medium text-foreground">
                      {relicPreview.reservationTtlSeconds ?? "—"}s
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {hasFatigueAction && fatiguePreview ? (
              <div className="rounded-3xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <TimerReset className="h-4 w-4 text-amber-500" />
                  Fatigue controls
                </div>

                <div className="space-y-2 text-sm text-muted">
                  <div className="flex items-start justify-between gap-4">
                    <span>Max consecutive entries</span>
                    <span className="font-medium text-foreground">
                      {fatiguePreview.maxConsecutiveEntries ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span>Cooldown seconds</span>
                    <span className="font-medium text-foreground">
                      {fatiguePreview.cooldownSeconds ?? "—"}s
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {hasGlobalAction ? (
              <div className="rounded-3xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Settings2 className="h-4 w-4 text-sky-500" />
                  Global controls
                </div>

                <div className="space-y-2 text-sm text-muted">
                  {proposal.actions
                    .filter((action) =>
                      [
                        "setGlobalFlags",
                        "setPauseFlags",
                        "setTreasury",
                        "setWorkerOperator",
                      ].includes(action.functionName ?? "")
                    )
                    .map((action) => (
                      <div
                        key={action.id}
                        className="rounded-2xl border border-border bg-card px-3 py-2"
                      >
                        <div className="font-medium text-foreground">
                          {action.functionName ?? "Config action"}
                        </div>
                        {action.summary ? (
                          <div className="mt-1 text-xs leading-5 text-muted">
                            {action.summary}
                          </div>
                        ) : null}
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {hasQueueAction ? (
              <div className="rounded-3xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CircleDot className="h-4 w-4 text-sky-500" />
                  Queue updates
                </div>

                <div className="space-y-2 text-sm text-muted">
                  {queuePreview.slice(0, 4).map((queue, index) => (
                    <div
                      key={`${queue.slug ?? "queue"}-${index}`}
                      className="rounded-2xl border border-border bg-card px-3 py-2"
                    >
                      <div className="font-medium text-foreground">
                        {queue.slug ?? "Queue"}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-muted">
                        enabled={String(queue.enabled)} · target={queue.targetSize ?? "—"} ·
                        min={queue.minStartSize ?? "—"} · duration={queue.openDurationSeconds ?? "—"}s
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
                Proposal details
              </h2>
            </div>

            <div className="space-y-1">
              <Kvp label="Area" value={proposal.area} />
              <Kvp label="Kind" value={proposal.kind} />
              <Kvp label="Status" value={proposal.status} />
              <Kvp label="Safe" value={proposal.safeContract ?? "—"} />
              <Kvp label="Chain" value={proposal.chainId ?? "—"} />
              <Kvp label="Based on config" value={proposal.basedOnConfigVersion ?? "—"} />
              <Kvp label="Created by" value={proposal.createdByAddress ?? "—"} />
              <Kvp label="Last edited by" value={proposal.lastEditedByAddress ?? "—"} />
              <Kvp label="Created" value={formatDateTime(proposal.createdAt)} />
              <Kvp label="Updated" value={formatDateTime(proposal.updatedAt)} />
            </div>
          </section>

          <WarpoolProposalWorkflowPanel
            adminSlug={slug}
            proposalId={proposal.id}
            proposalStatus={proposal.status}
            submittedMultisigTxId={proposal.submittedMultisigTxId}
            actionCount={proposal.actions.length}
            submittedActionCount={proposal.submittedActionCount}
            approvedActionCount={proposal.approvedActionCount}
            executedActionCount={proposal.executedActionCount}
            createdByAddress={proposal.createdByAddress}
            snapshotJson={proposal.snapshotJson}
            actions={proposal.actions.map((action) => ({
              functionName: action.functionName,
            }))}
          />

          <WarpoolProposalMultisigPanel
            adminSlug={slug}
            proposalId={proposal.id}
            proposalStatus={proposal.status}
            safeAddress={proposal.safeContract}
            submittedMultisigTxId={proposal.submittedMultisigTxId}
            submittedMultisigNonce={proposal.submittedMultisigNonce}
            metadataJson={proposal.metadataJson}
            safeThreshold={proposal.safe?.threshold ?? null}
            safeOwnerAddresses={proposal.safe?.ownerAddresses ?? []}
            actions={proposal.actions.map((action) => ({
              id: action.id,
              orderIndex: action.orderIndex,
              label: action.label,
              summary: action.summary,
              target: action.target,
              valueWei: action.valueWei,
              tokenAddress: action.tokenAddress,
              dataHex: action.dataHex,
              functionName: action.functionName,
              argsJson: action.argsJson,
              status: action.status,
              submittedAt: action.submittedAt,
              executedAt: action.executedAt,
            }))}
          />
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
                Action progress
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Each stored action is tracked separately so admins can understand real progress quickly.
              </p>
            </div>

            <div className="space-y-3">
              {proposal.actions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-3xl border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {action.label || action.functionName || `Action ${action.orderIndex + 1}`}
                      </div>
                      {action.summary ? (
                        <p className="mt-1 text-sm leading-6 text-muted">{action.summary}</p>
                      ) : null}
                    </div>

                    <div className="inline-flex rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {action.status}
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    <Kvp label="Order" value={action.orderIndex + 1} />
                    <Kvp label="Target" value={action.target} />
                    <Kvp label="Value" value={action.valueWei} />
                    <Kvp label="Method" value={action.functionName ?? "—"} />
                    <Kvp label="Submitted" value={formatDateTime(action.submittedAt)} />
                    <Kvp label="Executed" value={formatDateTime(action.executedAt)} />
                  </div>

                  {action.argsJson ? (
                    <details className="mt-4 rounded-2xl border border-border bg-card p-3">
                      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        Stored args
                      </summary>
                      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-foreground">
                        {JSON.stringify(toJsonSafe(action.argsJson), null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <details className="rounded-[28px] border border-border bg-card p-5 md:p-6">
            <summary className="cursor-pointer list-none text-[15px] font-semibold tracking-tight text-foreground">
              Advanced stored payload
            </summary>

            <div className="mt-5 space-y-6">
              <div>
                <div className="mb-2 text-sm font-semibold text-foreground">Snapshot JSON</div>
                <pre className="max-h-120 overflow-auto whitespace-pre-wrap break-all rounded-3xl border border-border bg-background/70 p-4 text-xs leading-6 text-foreground">
                  {JSON.stringify(toJsonSafe(proposal.snapshotJson), null, 2)}
                </pre>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-foreground">Metadata JSON</div>
                <pre className="max-h-120 overflow-auto whitespace-pre-wrap break-all rounded-3xl border border-border bg-background/70 p-4 text-xs leading-6 text-foreground">
                  {JSON.stringify(toJsonSafe(proposal.metadataJson), null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}