// app/admin/[slug]/warpool/page.tsx
import { notFound } from "next/navigation";

import { getWarpoolAdminOverviewData } from "@/src/features/admin/warpool/queries";
import { getWarpoolRuntimeOverviewData } from "@/src/features/admin/warpool/runtime-queries";
import {
  WARPOOL_QUEUE_META,
  formatBps,
  formatBool,
  formatDurationSeconds,
  formatInteger,
  formatTokenAmount,
  shortenAddress,
} from "@/src/features/admin/warpool/constants";
import { getWarpoolWorkerReadinessData } from "@/src/features/admin/warpool/worker-readiness-queries";
import WarpoolAdminConsole from "@/src/features/admin/warpool/WarpoolAdminConsole";
import { getWarpoolWorkerOpsData } from "@/src/features/admin/warpool/worker-ops-queries";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground md:text-base">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/60 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

function Kvp({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function EmptyPanel({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-background/50 p-6 text-center">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}

export default async function WarpoolAdminPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

const [data, runtimeData, workerReadiness, workerOps] = await Promise.all([
  getWarpoolAdminOverviewData(),
  getWarpoolRuntimeOverviewData(),
  getWarpoolWorkerReadinessData(),
  getWarpoolWorkerOpsData(),
]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-4xl border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Warpool Admin
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Comrades Warpool
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
              Operational control surface for Warpool contracts, queues, pools,
              sync health, and multisig-ready configuration drafting inside the
              Panth.art admin panel.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:min-w-[320px]">
            <StatCard label="Contracts" value={data.contracts.length} />
            <StatCard label="Queues" value={data.queueCards.length} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Pools" value={formatInteger(data.stats.totalPools)} />
        <StatCard label="Open Pools" value={formatInteger(data.stats.openPools)} />
        <StatCard
          label="Battle Ready"
          value={formatInteger(data.stats.battleReadyPools)}
        />
        <StatCard label="Captures" value={formatInteger(data.stats.totalCaptures)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Registered Contracts"
          description="Canonical on-chain contract registry used by admin, indexers, and future worker tooling."
        >
          {data.contracts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {data.contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="rounded-3xl border border-border bg-background/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">
                      {contract.label || contract.kind}
                    </div>
                    <div className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {contract.kind}
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    <Kvp label="Address" value={contract.address} />
                    <Kvp label="Chain ID" value={contract.chainId} />
                    <Kvp label="Status" value={contract.active ? "Active" : "Inactive"} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="No contracts registered yet"
              text="Bootstrap has not yet inserted the Config, Core, and Lens contract records into WarpoolContract."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Global Snapshot"
          description="Latest indexed config state from the Warpool config contract."
        >
          {data.latestConfigSnapshot ? (
            <div className="space-y-1">
              <Kvp
                label="Config Version"
                value={data.latestConfigSnapshot.configVersion.toString()}
              />
              <Kvp
                label="Entries"
                value={formatBool(data.latestConfigSnapshot.entriesPaused)}
              />
              <Kvp
                label="Reservations"
                value={formatBool(data.latestConfigSnapshot.reservationsPaused)}
              />
              <Kvp
                label="Settlements"
                value={formatBool(data.latestConfigSnapshot.settlementsPaused)}
              />
              <Kvp
                label="Relics"
                value={formatBool(data.latestConfigSnapshot.relicsEnabled)}
              />
              <Kvp
                label="Fatigue"
                value={formatBool(data.latestConfigSnapshot.fatigueEnabled)}
              />
              <Kvp
                label="Token11 Fee Share"
                value={`${formatBool(
                  data.latestConfigSnapshot.token11FeeShareEnabled
                )} · ${formatBps(data.latestConfigSnapshot.token11FeeShareBps)}`}
              />
              <Kvp
                label="Treasury"
                value={shortenAddress(data.latestConfigSnapshot.treasury)}
              />
              <Kvp
                label="Worker"
                value={shortenAddress(data.latestConfigSnapshot.workerOperator)}
              />
            </div>
          ) : (
            <EmptyPanel
              title="No config snapshot indexed yet"
              text="The config contract has been registered, but no snapshot has been written into WarpoolGlobalConfigSnapshot yet."
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Queues"
        description="Latest stored queue snapshots by queue slug, including stake, bracket sizing, and fee structure."
      >
        {data.queueCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
{data.queueCards.map((queue) => {
  const meta = WARPOOL_QUEUE_META[queue.slug];

              return (
                <div
                  key={queue.id}
                  className="rounded-3xl border border-border bg-background/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {meta.title}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {meta.description}
                      </p>
                    </div>

                    <div className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {queue.enabled ? meta.badge : "Off"}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[18px] border border-border bg-card p-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">
                        Stake
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {formatTokenAmount(queue.stakeAmountRaw)}
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-border bg-card p-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">
                        Window
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {formatDurationSeconds(queue.openDurationSeconds)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    <Kvp label="Target Size" value={formatInteger(queue.targetSize)} />
                    <Kvp label="Min Start" value={formatInteger(queue.minStartSize)} />
                    <Kvp
                      label="Single Entry"
                      value={queue.singleEntryPerWallet ? "Yes" : "No"}
                    />
                    <Kvp label="Platform Fee" value={formatBps(queue.platformFeeBps)} />
                    <Kvp
                      label="Payout Split"
                      value={`${formatBps(queue.firstPlaceBps)} / ${formatBps(
                        queue.secondPlaceBps
                      )} / ${formatBps(queue.thirdPlaceBps)}`}
                    />
                    <Kvp
                      label="Config Version"
                      value={queue.configVersion.toString()}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyPanel
            title="No queue snapshots yet"
            text="Queue configuration has not been projected into WarpoolQueueConfig yet. Once the config sync/indexer runs, queue cards will appear here."
          />
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Pool Totals"
          description="High-level Warpool system counts from the local database projection."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Locked" value={formatInteger(data.stats.lockedPools)} />
            <StatCard label="Settled" value={formatInteger(data.stats.settledPools)} />
            <StatCard
              label="Expired Refunded"
              value={formatInteger(data.stats.expiredRefundedPools)}
            />
            <StatCard label="Entries" value={formatInteger(data.stats.totalEntries)} />
            <StatCard
              label="Reservations"
              value={formatInteger(data.stats.totalReservations)}
            />
            <StatCard label="Captures" value={formatInteger(data.stats.totalCaptures)} />
          </div>
        </SectionCard>

        <SectionCard
          title="Chain Cursors"
          description="Latest indexed block position by contract from shared ChainState."
        >
          {data.cursors.length > 0 ? (
            <div className="space-y-1">
              {data.cursors.map((cursor) => (
                <Kvp
                  key={cursor.contract}
                  label={shortenAddress(cursor.contract)}
                  value={formatInteger(cursor.lastBlockNumber)}
                />
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="No Warpool cursor rows yet"
              text="ChainState does not yet have cursor positions for registered Warpool contracts."
            />
          )}
        </SectionCard>
      </div>

<WarpoolAdminConsole
  configAddress={
    data.contracts.find((contract) => contract.kind === "CONFIG")?.address ?? null
  }
  coreAddress={runtimeData.coreAddress}
  lensAddress={runtimeData.lensAddress}
  latestConfigSnapshot={data.latestConfigSnapshot}
  queueCards={data.queueCards}
  runtimeQueues={runtimeData.queues}
  runtimeWarnings={runtimeData.warnings}
  workerReadiness={workerReadiness}
  workerOps={workerOps}
  defaultMultisigAddress={data.multisigAddress}
  multisigResolutionSource={data.multisigResolutionSource}
  multisigSummary={data.multisigSummary}
  recentMultisigTxs={data.recentMultisigTxs}
/>
    </div>
  );
}