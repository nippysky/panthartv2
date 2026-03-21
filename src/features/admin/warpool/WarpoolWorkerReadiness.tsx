"use client";

import type {
  WarpoolRuntimePrefill,
  WarpoolWorkerReadinessData,
} from "@/src/features/admin/warpool/types";

type Props = {
  data: WarpoolWorkerReadinessData;
  onPrefillAction?: (prefill: WarpoolRuntimePrefill) => void;
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

function SmallStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/60 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
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
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[70%] break-all text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-background/50 p-5 text-sm text-muted">
      {text}
    </div>
  );
}

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortenAddress(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export default function WarpoolWorkerReadiness({
  data,
  onPrefillAction,
}: Props) {
  const hasItems =
    data.expiredOpenPools.length > 0 ||
    data.battleReadyCandidates.length > 0 ||
    data.settlementCandidates.length > 0 ||
    data.expiredReservations.length > 0;

  return (
    <SectionCard
      title="Automation and recovery"
      description="This view highlights items the worker is processing or items an operator may need to recover manually if automation stalls."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SmallStat
          label="Expired Open Pools"
          value={data.expiredOpenPools.length}
          hint="Recovery candidates"
        />
        <SmallStat
          label="Battle Ready"
          value={data.battleReadyCandidates.length}
          hint="Usually worker-driven"
        />
        <SmallStat
          label="Awaiting Settlement"
          value={data.settlementCandidates.length}
          hint="Usually worker-driven"
        />
        <SmallStat
          label="Expired Reservations"
          value={data.expiredReservations.length}
          hint="Recovery candidates"
        />
      </div>

      {!hasItems ? (
        <div className="mt-6">
          <EmptyState text="Everything looks calm right now. No obvious runtime recovery items are waiting in this view." />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">
            Expired open pools
          </div>
          {data.expiredOpenPools.length > 0 ? (
            data.expiredOpenPools.map((item) => (
              <div
                key={item.poolId}
                className="rounded-3xl border border-border bg-background/60 p-4"
              >
                <Kvp label="Pool" value={item.poolId} />
                <Kvp label="Queue" value={item.queueSlug ?? "—"} />
                <Kvp label="Expired At" value={formatDate(item.expiresAt)} />
                <Kvp
                  label="Entrants / Min Start"
                  value={`${item.entrantCount} / ${item.minStartSize}`}
                />

                <div className="mt-4">
                  <ActionButton
                    label="Prefill process expired"
                    onClick={() =>
                      onPrefillAction?.({
                        type: "PROCESS_EXPIRED_POOL",
                        poolId: item.poolId,
                      })
                    }
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No open pools are currently past expiry." />
          )}
        </div>

        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">
            Locked pools awaiting battle-ready
          </div>
          {data.battleReadyCandidates.length > 0 ? (
            data.battleReadyCandidates.map((item) => (
              <div
                key={item.poolId}
                className="rounded-3xl border border-border bg-background/60 p-4"
              >
                <Kvp label="Pool" value={item.poolId} />
                <Kvp label="Queue" value={item.queueSlug ?? "—"} />
                <Kvp label="Locked At" value={formatDate(item.lockedAt)} />
                <Kvp
                  label="Entrants / Runnable"
                  value={`${item.entrantCount} / ${item.runnableSize}`}
                />
                <Kvp label="Seed Block" value={item.seedBlockNumber ?? "—"} />

                <div className="mt-4">
                  <ActionButton
                    label="Prefill battle ready"
                    onClick={() =>
                      onPrefillAction?.({
                        type: "MARK_BATTLE_READY",
                        poolId: item.poolId,
                      })
                    }
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No locked pools are currently waiting in this view." />
          )}
        </div>

        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">
            Battle-ready pools awaiting settlement
          </div>
          {data.settlementCandidates.length > 0 ? (
            data.settlementCandidates.map((item) => (
              <div
                key={item.poolId}
                className="rounded-3xl border border-border bg-background/60 p-4"
              >
                <Kvp label="Pool" value={item.poolId} />
                <Kvp label="Queue" value={item.queueSlug ?? "—"} />
                <Kvp label="Battle Ready At" value={formatDate(item.battleReadyAt)} />
                <Kvp label="Runnable Size" value={item.runnableSize} />

                <div className="mt-4">
                  <ActionButton
                    label="Prefill settle pool"
                    onClick={() =>
                      onPrefillAction?.({
                        type: "SETTLE_POOL",
                        poolId: item.poolId,
                      })
                    }
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No battle-ready pools are awaiting settlement in this view." />
          )}
        </div>

        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">
            Expired active reservations
          </div>
          {data.expiredReservations.length > 0 ? (
            data.expiredReservations.map((item) => (
              <div
                key={item.reservationId}
                className="rounded-3xl border border-border bg-background/60 p-4"
              >
                <Kvp label="Reservation" value={item.reservationId} />
                <Kvp label="Pool" value={item.poolId} />
                <Kvp label="Queue" value={item.queueSlug ?? "—"} />
                <Kvp label="User" value={shortenAddress(item.userAddress)} />
                <Kvp label="Expired At" value={formatDate(item.expiresAtOnChain)} />

                <div className="mt-4">
                  <ActionButton
                    label="Prefill expire reservation"
                    onClick={() =>
                      onPrefillAction?.({
                        type: "EXPIRE_RESERVATION",
                        reservationId: item.reservationId,
                      })
                    }
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No active reservations are currently past expiry." />
          )}
        </div>
      </div>
    </SectionCard>
  );
}