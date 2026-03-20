/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { WarpoolWorkerOpsData } from "./types";


type Props = {
  data: WarpoolWorkerOpsData;
};

type ActionState = {
  kind: "idle" | "loading" | "success" | "error";
  message: string | null;
  key: string | null;
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

function shortenAddress(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusPill(status: string) {
  return (
    <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
      {status}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  loading = false,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Working..." : label}
    </button>
  );
}

export default function WarpoolWorkerOps({ data }: Props) {
  const [actionState, setActionState] = React.useState<ActionState>({
    kind: "idle",
    message: null,
    key: null,
  });

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      ok: boolean;
      error?: string;
      item?: unknown;
    };

    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Request failed.");
    }

    return json;
  }

  async function runAction(
    key: string,
    action: () => Promise<void>,
    successMessage: string
  ) {
    try {
      setActionState({
        kind: "loading",
        message: null,
        key,
      });

      await action();

      setActionState({
        kind: "success",
        message: successMessage,
        key,
      });

      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (error) {
      setActionState({
        kind: "error",
        message: error instanceof Error ? error.message : "Action failed.",
        key,
      });
    }
  }

  return (
    <SectionCard
      title="Worker Ops"
      description="Backend-facing Warpool operations surface for battle compute, capture relist flow, and queued or failed worker actions."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SmallStat
          label="Battle Compute"
          value={data.battleComputeCandidates.length}
          hint="Battle-ready pools"
        />
        <SmallStat
          label="Relist Candidates"
          value={data.relistCandidates.length}
          hint="Captured NFTs needing relist attention"
        />
        <SmallStat
          label="Pending Actions"
          value={data.pendingActions.length}
          hint="Queued worker-related chain actions"
        />
        <SmallStat
          label="Failed Actions"
          value={data.failedActions.length}
          hint="Needs operator inspection"
        />
      </div>

      {actionState.message ? (
        <div
          className={[
            "mt-6 rounded-3xl border p-4 text-sm",
            actionState.kind === "error"
              ? "border-border bg-background text-foreground"
              : "border-border bg-background text-foreground",
          ].join(" ")}
        >
          {actionState.message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">
            Battle Compute Candidates
          </div>
          {data.battleComputeCandidates.length > 0 ? (
            data.battleComputeCandidates.map((item:any) => {
              const actionKey = `battle:${item.poolId}`;

              return (
                <div
                  key={item.battleId}
                  className="rounded-3xl border border-border bg-background/60 p-4"
                >
                  <Kvp label="Pool" value={item.poolId} />
                  <Kvp label="Queue" value={item.queueSlug ?? "—"} />
                  <Kvp label="Battle Row" value={item.battleId} />
                  <Kvp label="Status" value={statusPill(item.status)} />
                  <Kvp label="Runnable Size" value={item.runnableSize} />
                  <Kvp label="Battle Ready At" value={formatDate(item.battleReadyAt)} />
                  <Kvp label="Created" value={formatDate(item.createdAt)} />

                  <div className="mt-4">
                    <ActionButton
                      label="Queue Battle Compute"
                      loading={
                        actionState.kind === "loading" && actionState.key === actionKey
                      }
                      onClick={() =>
                        runAction(
                          actionKey,
                          async () => {
                            await postJson("/api/admin/warpool/worker/battle/queue", {
                              poolId: item.poolId,
                            });
                          },
                          `Battle compute queued for pool ${item.poolId}.`
                        )
                      }
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState text="No battle-ready pools currently waiting in this view." />
          )}
        </div>

        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">
            Capture Relist Candidates
          </div>
          {data.relistCandidates.length > 0 ? (
            data.relistCandidates.map((item:any) => {
              const actionKey = `relist:${item.captureId}`;

              return (
                <div
                  key={item.captureId}
                  className="rounded-3xl border border-border bg-background/60 p-4"
                >
                  <Kvp label="Capture" value={item.captureId} />
                  <Kvp label="Entry" value={item.entryId} />
                  <Kvp
                    label="Asset"
                    value={`${shortenAddress(item.contract)} · #${item.tokenId}`}
                  />
                  <Kvp
                    label="Original Owner"
                    value={shortenAddress(item.originalOwnerAddress)}
                  />
                  <Kvp label="Status" value={statusPill(item.status)} />
                  <Kvp label="Relist" value={statusPill(item.relistStatus)} />
                  <Kvp label="Captured At" value={formatDate(item.capturedAt)} />
                  <Kvp label="Created" value={formatDate(item.createdAt)} />

                  <div className="mt-4">
                    <ActionButton
                      label="Queue Relist"
                      loading={
                        actionState.kind === "loading" && actionState.key === actionKey
                      }
                      onClick={() =>
                        runAction(
                          actionKey,
                          async () => {
                            await postJson("/api/admin/warpool/worker/relist/queue", {
                              captureId: item.captureId,
                            });
                          },
                          `Relist queued for capture ${item.captureId}.`
                        )
                      }
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState text="No relist candidates currently need worker attention." />
          )}
        </div>

        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">
            Pending Chain Actions
          </div>
          {data.pendingActions.length > 0 ? (
            data.pendingActions.map((item:any) => (
              <div
                key={item.id}
                className="rounded-3xl border border-border bg-background/60 p-4"
              >
                <Kvp label="Action" value={statusPill(item.type)} />
                <Kvp label="Chain" value={item.chainId} />
                <Kvp label="From" value={shortenAddress(item.from)} />
                <Kvp label="Related ID" value={item.relatedId ?? "—"} />
                <Kvp label="Tx Hash" value={shortenAddress(item.txHash)} />
                <Kvp label="Created" value={formatDate(item.createdAt)} />
                <Kvp label="Updated" value={formatDate(item.updatedAt)} />
                <Kvp label="Status" value={statusPill(item.status)} />
              </div>
            ))
          ) : (
            <EmptyState text="No pending Warpool worker actions are currently queued." />
          )}
        </div>

        <div className="space-y-4">
          <div className="text-sm font-semibold text-foreground">
            Failed Chain Actions
          </div>
          {data.failedActions.length > 0 ? (
            data.failedActions.map((item:any) => {
              const actionKey = `retry:${item.id}`;

              return (
                <div
                  key={item.id}
                  className="rounded-3xl border border-border bg-background/60 p-4"
                >
                  <Kvp label="Action" value={statusPill(item.type)} />
                  <Kvp label="Chain" value={item.chainId} />
                  <Kvp label="From" value={shortenAddress(item.from)} />
                  <Kvp label="Related ID" value={item.relatedId ?? "—"} />
                  <Kvp label="Tx Hash" value={shortenAddress(item.txHash)} />
                  <Kvp label="Created" value={formatDate(item.createdAt)} />
                  <Kvp label="Updated" value={formatDate(item.updatedAt)} />
                  <Kvp label="Status" value={statusPill(item.status)} />

                  <div className="mt-4">
                    <ActionButton
                      label="Retry Action"
                      loading={
                        actionState.kind === "loading" && actionState.key === actionKey
                      }
                      onClick={() =>
                        runAction(
                          actionKey,
                          async () => {
                            await postJson("/api/admin/warpool/worker/pending/retry", {
                              actionId: item.id,
                            });
                          },
                          `Retry queued for failed action ${item.id}.`
                        )
                      }
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState text="No failed Warpool worker actions in the current view." />
          )}
        </div>
      </div>
    </SectionCard>
  );
}