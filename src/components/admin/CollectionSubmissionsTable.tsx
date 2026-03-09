/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/admin/CollectionSubmissionsTable.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { useActiveAccount } from "thirdweb/react";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { WalletPill } from "@/src/ui/WalletPill";

type AdminSubmissionsClientProps = {
  allowedWallets: string[];
};

type SubmissionRow = {
  id: string;
  logoUrl: string | null;
  coverUrl: string | null;
  name: string | null;
  contract: string;
  symbol: string | null;
  supply: number | null;
  ownerAddress: string | null;
  baseUri: string | null;
  description: string | null;
  website: string | null;
  x: string | null;
  instagram: string | null;
  telegram: string | null;
  createdAt: string;
};

function isAllowed(allowed: string[], addr?: string | null) {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return allowed.map((w) => w.toLowerCase()).includes(a);
}

function short(addr?: string | null) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-h-65 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-background/60 px-6 py-10 text-center">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-sm text-muted">{helper}</div>
    </div>
  );
}

export default function CollectionSubmissionsTable({
  allowedWallets,
}: AdminSubmissionsClientProps) {
  const dw = useDecentWalletAccount();
  const activeAccount = useActiveAccount();

  /**
   * Support both:
   * - Decent Wallet in-app browser
   * - regular browser thirdweb connection
   */
  const connectedAddress = React.useMemo(() => {
    if (dw?.isDecentWallet) {
      if (dw.ready && dw.isConnected && dw.address) return dw.address;
      return null;
    }

    return activeAccount?.address || null;
  }, [
    dw?.isDecentWallet,
    dw?.ready,
    dw?.isConnected,
    dw?.address,
    activeAccount?.address,
  ]);

  const connected = Boolean(connectedAddress);
  const permitted = isAllowed(allowedWallets, connectedAddress);

  const [rows, setRows] = React.useState<SubmissionRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const [filter, setFilter] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectIds, setRejectIds] = React.useState<string[]>([]);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewItem, setViewItem] = React.useState<SubmissionRow | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchRows = React.useCallback(async () => {
    if (!connected || !permitted || !connectedAddress) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/admin/collection-submissions?status=pending`, {
        headers: { "x-admin-wallet": connectedAddress },
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to load submissions");
      }

      const data = Array.isArray(json?.data) ? (json.data as SubmissionRow[]) : [];
      setRows(data);
    } catch (e: any) {
      const message = e?.message || "Failed to load submissions";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [connected, permitted, connectedAddress]);

  React.useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const approve = React.useCallback(
    async (ids: string[]) => {
      if (!connected || !permitted || !connectedAddress || ids.length === 0) return;

      try {
        setActing(true);
        setError(null);

        const res = await fetch(`/api/admin/collection-submissions/bulk`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-admin-wallet": connectedAddress,
          },
          body: JSON.stringify({ ids, action: "APPROVE" }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Approval failed");
        }

        toast.success(`Approved ${json.count} submission(s)`);
        setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));

        if (viewItem && ids.includes(viewItem.id)) {
          setViewOpen(false);
          setViewItem(null);
        }
      } catch (e: any) {
        const message = e?.message || "Approval failed";
        setError(message);
        toast.error(message);
      } finally {
        setActing(false);
      }
    },
    [connected, permitted, connectedAddress, viewItem]
  );

  const reject = React.useCallback(
    async (ids: string[], reason: string) => {
      if (!connected || !permitted || !connectedAddress || ids.length === 0) return;

      try {
        setActing(true);
        setError(null);

        const res = await fetch(`/api/admin/collection-submissions/bulk`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-admin-wallet": connectedAddress,
          },
          body: JSON.stringify({ ids, action: "REJECT", reason }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Rejection failed");
        }

        toast.success(`Rejected ${json.count} submission(s)`);
        setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));

        if (viewItem && ids.includes(viewItem.id)) {
          setViewOpen(false);
          setViewItem(null);
        }
      } catch (e: any) {
        const message = e?.message || "Rejection failed";
        setError(message);
        toast.error(message);
      } finally {
        setActing(false);
      }
    },
    [connected, permitted, connectedAddress, viewItem]
  );

  const copy = React.useCallback((text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      toast.success("Copied");
    });
  }, []);

  const filteredRows = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      return (
        r.contract.toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.symbol || "").toLowerCase().includes(q) ||
        (r.ownerAddress || "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter]);

  const stats = React.useMemo(() => {
    return {
      total: rows.length,
      withLogos: rows.filter((r) => Boolean(r.logoUrl)).length,
      withCovers: rows.filter((r) => Boolean(r.coverUrl)).length,
      withLinks: rows.filter(
        (r) => Boolean(r.website || r.x || r.instagram || r.telegram)
      ).length,
    };
  }, [rows]);

  const allVisibleSelected =
    filteredRows.length > 0 &&
    filteredRows.every((row) => selectedIds.includes(row.id));

  const someVisibleSelected =
    filteredRows.some((row) => selectedIds.includes(row.id)) && !allVisibleSelected;

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !filteredRows.some((row) => row.id === id))
      );
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of filteredRows) next.add(row.id);
      return Array.from(next);
    });
  }

  if (!connected) {
    return (
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
        <div className="flex flex-col items-center justify-center gap-5 py-10 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Connect your admin wallet
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted">
              Connect the wallet linked to Panth.art admin access to review
              pending collection submissions.
            </p>
          </div>

          <WalletPill />
        </div>
      </section>
    );
  }

  if (!permitted) {
    return (
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
        <div className="flex flex-col items-center justify-center gap-5 py-10 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background text-amber-600 dark:text-amber-300">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86l-7.5 13A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.71-3.14l-7.5-13a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Access denied
            </h2>
            <p className="max-w-lg text-sm leading-6 text-muted">
              The connected wallet{" "}
              <span className="font-mono text-foreground">
                {short(connectedAddress)}
              </span>{" "}
              is not on the allowed admin list for this dashboard.
            </p>
          </div>

          <WalletPill />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-[28px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pending"
            value={stats.total}
            helper="Current moderation queue"
          />
          <StatCard
            label="With logos"
            value={stats.withLogos}
            helper="Brand assets provided"
          />
          <StatCard
            label="With covers"
            value={stats.withCovers}
            helper="Hero imagery included"
          />
          <StatCard
            label="With links"
            value={stats.withLinks}
            helper="Social or website attached"
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Pending review queue
              </h2>
              <p className="mt-1 text-sm text-muted">
                Search, inspect and moderate submissions without changing the
                underlying API behavior.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-65">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search name, symbol, contract, owner..."
                  className="h-11 w-full rounded-full border border-border bg-background px-4 pr-10 text-sm outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchRows()}
                  disabled={loading || acting}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-all hover:bg-card disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>

                <button
                  type="button"
                  onClick={() => approve(selectedIds)}
                  disabled={selectedIds.length === 0 || acting}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
                >
                  {acting ? "Working..." : `Approve Selected (${selectedIds.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRejectIds(selectedIds);
                    setRejectReason("");
                    setRejectOpen(true);
                  }}
                  disabled={selectedIds.length === 0 || acting}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-4 text-sm font-medium text-red-700 transition-all hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300"
                >
                  Reject Selected
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-[22px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-22 animate-pulse rounded-[22px] border border-border bg-background/70"
                />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              title={rows.length === 0 ? "No pending submissions" : "No matches found"}
              body={
                rows.length === 0
                  ? "There are no pending collection submissions waiting for review right now."
                  : "Try a different search term. The admin gremlins may just be hiding the match."
              }
            />
          ) : (
            <div className="overflow-hidden rounded-3xl border border-border">
              <div className="hidden grid-cols-[46px_1.6fr_1fr_160px_150px] items-center gap-4 border-b border-border bg-background/80 px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-muted lg:grid">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                      allVisibleSelected
                        ? "border-foreground bg-foreground text-background"
                        : someVisibleSelected
                          ? "border-foreground bg-background text-foreground"
                          : "border-border bg-background text-transparent",
                    ].join(" ")}
                    aria-label="Select all visible"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                </div>
                <div>Submission</div>
                <div>Owner / Symbol</div>
                <div>Submitted</div>
                <div className="text-right">Action</div>
              </div>

              <div className="divide-y divide-border">
                {filteredRows.map((row) => {
                  const selected = selectedIds.includes(row.id);

                  return (
                    <div
                      key={row.id}
                      className="grid gap-4 px-4 py-4 transition-colors hover:bg-background/60 lg:grid-cols-[46px_1.6fr_1fr_160px_150px] lg:px-5"
                    >
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => toggleOne(row.id)}
                          className={[
                            "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                            selected
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-background text-transparent",
                          ].join(" ")}
                          aria-label={`Select ${row.name || row.contract}`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex min-w-0 items-center gap-4">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[18px] border border-border bg-background">
                          {row.logoUrl ? (
                            <Image
                              src={row.logoUrl}
                              alt={row.name || "Logo"}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="3" y="3" width="18" height="18" rx="4" />
                                <circle cx="9" cy="9" r="1.4" />
                                <path d="M21 15l-5-5L5 21" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground md:text-[15px]">
                            {row.name || "Untitled collection"}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span className="font-mono">{short(row.contract)}</span>
                            <button
                              type="button"
                              className="underline underline-offset-2"
                              onClick={() => copy(row.contract)}
                            >
                              Copy contract
                            </button>
                            {row.supply != null ? <span>{row.supply} supply</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {row.symbol || "—"}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted">
                          {row.ownerAddress ? short(row.ownerAddress) : "No owner"}
                        </div>
                      </div>

                      <div className="flex items-center text-sm text-muted">
                        {formatDate(row.createdAt)}
                      </div>

                      <div className="flex items-center justify-start gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setViewItem(row);
                            setViewOpen(true);
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-all hover:bg-card"
                        >
                          Review
                        </button>

                        <button
                          type="button"
                          onClick={() => approve([row.id])}
                          disabled={acting}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {rejectOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => {
              setRejectOpen(false);
              setRejectIds([]);
              setRejectReason("");
            }}
            aria-label="Close reject modal"
          />

          <div className="relative z-10 w-full max-w-lg rounded-[28px] border border-border bg-background p-5 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  Moderation Action
                </div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  Reject submission{rejectIds.length > 1 ? "s" : ""}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Provide a clear reason. The selected submission
                  {rejectIds.length > 1 ? "s" : ""} will be removed so the creator
                  can resubmit properly.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRejectOpen(false);
                  setRejectIds([]);
                  setRejectReason("");
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground"
                aria-label="Close"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Missing website and socials. Please add verifiable links and resubmit."
              className="mt-5 min-h-37.5 w-full rounded-[20px] border border-border bg-card p-4 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setRejectOpen(false);
                  setRejectIds([]);
                  setRejectReason("");
                }}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-medium text-foreground transition-all hover:bg-background"
              >
                Close
              </button>

              <button
                type="button"
                disabled={!rejectReason.trim() || acting}
                onClick={async () => {
                  const ids = [...rejectIds];
                  const reason = rejectReason.trim();
                  setRejectOpen(false);
                  setRejectIds([]);
                  setRejectReason("");
                  await reject(ids, reason);
                }}
                className="inline-flex h-11 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-5 text-sm font-medium text-red-700 transition-all hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300"
              >
                {acting ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewOpen && viewItem ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => {
              setViewOpen(false);
              setViewItem(null);
            }}
            aria-label="Close review drawer"
          />

          <div className="relative ml-auto flex h-full w-full max-w-190 flex-col border-l border-border bg-background shadow-2xl">
            <div className="border-b border-border px-5 py-4 md:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                    Submission Review
                  </div>
                  <h3 className="mt-2 truncate text-xl font-semibold tracking-tight text-foreground">
                    {viewItem.name || "Untitled collection"}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {viewItem.symbol ? (
                      <span className="rounded-full border border-border px-2.5 py-1">
                        {viewItem.symbol}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-border px-2.5 py-1">
                      Submitted {formatDate(viewItem.createdAt)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setViewOpen(false);
                    setViewItem(null);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground"
                  aria-label="Close"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
              <div className="grid gap-5">
                <section className="overflow-hidden rounded-3xl border border-border bg-card">
                  <div className="relative h-48 w-full bg-background sm:h-56">
                    {viewItem.coverUrl ? (
                      <Image
                        src={viewItem.coverUrl}
                        alt={viewItem.name || "Cover"}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-muted">
                        No cover image
                      </div>
                    )}

                    {viewItem.logoUrl ? (
                      <div className="absolute bottom-4 left-4 h-16 w-16 overflow-hidden rounded-[18px] border border-border bg-card shadow-lg">
                        <Image
                          src={viewItem.logoUrl}
                          alt={viewItem.name || "Logo"}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-3xl border border-border bg-card p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                    Collection details
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-border bg-background p-4">
                      <div className="text-xs text-muted">Name</div>
                      <div className="mt-1 text-sm font-medium text-foreground">
                        {viewItem.name || "—"}
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-border bg-background p-4">
                      <div className="text-xs text-muted">Symbol</div>
                      <div className="mt-1 text-sm font-medium text-foreground">
                        {viewItem.symbol || "—"}
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-border bg-background p-4 sm:col-span-2">
                      <div className="text-xs text-muted">Contract</div>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="min-w-0 flex-1 break-all text-xs text-foreground">
                          {viewItem.contract}
                        </code>
                        <button
                          type="button"
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
                          onClick={() => copy(viewItem.contract)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-border bg-background p-4 sm:col-span-2">
                      <div className="text-xs text-muted">Owner</div>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="min-w-0 flex-1 break-all text-xs text-foreground">
                          {viewItem.ownerAddress || "—"}
                        </code>
                        {viewItem.ownerAddress ? (
                          <button
                            type="button"
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
                            onClick={() => copy(viewItem.ownerAddress!)}
                          >
                            Copy
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-border bg-background p-4">
                      <div className="text-xs text-muted">Total supply</div>
                      <div className="mt-1 text-sm font-medium text-foreground">
                        {viewItem.supply ?? "—"}
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-border bg-background p-4">
                      <div className="text-xs text-muted">Submitted</div>
                      <div className="mt-1 text-sm font-medium text-foreground">
                        {formatDate(viewItem.createdAt)}
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-border bg-background p-4 sm:col-span-2">
                      <div className="text-xs text-muted">Base URI</div>
                      <code className="mt-1 block break-all text-xs text-foreground">
                        {viewItem.baseUri || "—"}
                      </code>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-border bg-card p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                    Description
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {viewItem.description || "No description provided."}
                  </p>
                </section>

                <section className="rounded-3xl border border-border bg-card p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                    Links
                  </div>

                  <div className="mt-3 grid gap-3">
                    {[
                      ["Website", viewItem.website],
                      ["X", viewItem.x],
                      ["Instagram", viewItem.instagram],
                      ["Telegram", viewItem.telegram],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-[18px] border border-border bg-background p-4"
                      >
                        <div className="text-xs text-muted">{label}</div>
                        <div className="mt-1 min-w-0">
                          {value ? (
                            <Link
                              href={value}
                              target="_blank"
                              className="break-all text-sm font-medium text-foreground underline underline-offset-4"
                            >
                              {value}
                            </Link>
                          ) : (
                            <span className="text-sm text-muted">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="border-t border-border px-5 py-4 md:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setRejectIds([viewItem.id]);
                    setRejectReason("");
                    setViewOpen(false);
                    setRejectOpen(true);
                  }}
                  disabled={acting}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-5 text-sm font-medium text-red-700 transition-all hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300"
                >
                  Reject
                </button>

                <button
                  type="button"
                  onClick={() => approve([viewItem.id])}
                  disabled={acting}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-5 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}