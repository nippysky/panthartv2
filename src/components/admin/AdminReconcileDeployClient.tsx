/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/admin/AdminReconcileDeployClient.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useActiveAccount } from "thirdweb/react";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { WalletPill } from "@/src/ui/WalletPill";

type Props = {
  allowedWallets: string[];
};

type ApiPreviewOk = {
  ok: false;
  preview: true;
  kind?: "ERC1155_SINGLE" | "ERC721_SINGLE";
  derived?: Record<string, any>;
  missing?: string[];
  hint?: string;
};

type ApiWriteOk = {
  ok: true;
  kind: "ERC1155_SINGLE" | "ERC721_SINGLE";
  contract: string;
  singleId: string;
  nftId: string;
  tokenUri: string;
};

type ApiErr = {
  error: string;
  [k: string]: any;
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

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  } catch {
    toast.error("Copy failed");
  }
}

function JsonBlock({
  value,
}: {
  value: unknown;
}) {
  return (
    <pre className="overflow-x-auto rounded-[20px] border border-border bg-background p-4 text-xs leading-6 text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function KeyValueRow({
  label,
  value,
  mono = false,
  truncate = false,
  copyable = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  truncate?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-background p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 flex items-start gap-2">
        <div
          className={[
            "min-w-0 flex-1 text-sm font-medium text-foreground",
            mono ? "font-mono text-xs" : "",
            truncate ? "truncate" : "break-all",
          ].join(" ")}
        >
          {value || "—"}
        </div>

        {copyable && value ? (
          <button
            type="button"
            onClick={() => void copyText(value)}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
          >
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-sm text-muted">{helper}</div>
    </div>
  );
}

function GateCard({
  icon,
  title,
  body,
  wallet,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  wallet?: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
      <div className="flex flex-col items-center justify-center gap-5 py-10 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background">
          {icon}
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <div className="max-w-lg text-sm leading-6 text-muted">{body}</div>
        </div>

        {wallet ? <WalletPill /> : null}
      </div>
    </section>
  );
}

export default function AdminReconcileDeployClient({ allowedWallets }: Props) {
  const dw = useDecentWalletAccount();
  const activeAccount = useActiveAccount();

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

  const [txHash, setTxHash] = React.useState("");
  const [factory, setFactory] = React.useState("");
  const [loading, setLoading] = React.useState<"idle" | "preview" | "write">(
    "idle"
  );
  const [preview, setPreview] = React.useState<ApiPreviewOk | null>(null);
  const [result, setResult] = React.useState<ApiWriteOk | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const callApi = React.useCallback(
    async (body: any) => {
      const res = await fetch("/api/admin/reconcile-deploy", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(connectedAddress ? { "x-admin-wallet": connectedAddress } : {}),
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");
      return json;
    },
    [connectedAddress]
  );

  const doPreview = React.useCallback(async () => {
    setError(null);
    setResult(null);
    setPreview(null);

    if (!txHash.trim()) {
      setError("Please enter a transaction hash.");
      return;
    }

    setLoading("preview");

    try {
      const data: ApiPreviewOk | ApiErr = await callApi({
        txHash: txHash.trim(),
        preview: true,
        ...(factory.trim() ? { factoryAddress: factory.trim() } : {}),
      });

      if ("preview" in data && data.preview === true) {
        setPreview(data as ApiPreviewOk);
        toast.success("Preview ready");
      } else {
        setPreview({
          ok: false,
          preview: true,
          hint: "Looks good. You can proceed to write.",
        });
        toast.success("Preview ready");
      }
    } catch (e: any) {
      const message = e?.message || "Preview error";
      setError(message);
      toast.error(message);
    } finally {
      setLoading("idle");
    }
  }, [txHash, factory, callApi]);

  const doWrite = React.useCallback(async () => {
    setError(null);
    setResult(null);

    if (!txHash.trim()) {
      setError("Please enter a transaction hash.");
      return;
    }

    setLoading("write");

    try {
      const data: ApiWriteOk | ApiErr = await callApi({
        txHash: txHash.trim(),
        ...(factory.trim() ? { factoryAddress: factory.trim() } : {}),
      });

      if ("ok" in data && data.ok === true) {
        setResult(data as ApiWriteOk);
        toast.success("Reconcile write complete");
      } else {
        setPreview(data as any);
        toast.message("Preview returned, please review");
      }
    } catch (e: any) {
      const message = e?.message || "Write error";
      setError(message);
      toast.error(message);
    } finally {
      setLoading("idle");
    }
  }, [txHash, factory, callApi]);

  const hasFactory = Boolean(factory.trim());
  const previewKind = preview?.kind || result?.kind || "—";

  if (!connected) {
    return (
      <GateCard
        title="Connect your admin wallet"
        body="Connect the wallet linked to Panth.art admin access to use the reconciliation tool."
        wallet
        icon={
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
        }
      />
    );
  }

  if (!permitted) {
    return (
      <GateCard
        title="Access denied"
        body={
          <>
            The connected wallet{" "}
            <span className="font-mono text-foreground">
              {short(connectedAddress)}
            </span>{" "}
            is not on the allowed admin list for this tool.
          </>
        }
        wallet
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-amber-600 dark:text-amber-300"
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
        }
      />
    );
  }

  return (
    <>
      <section className="rounded-[28px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Mode"
            value={loading === "idle" ? "Ready" : loading === "preview" ? "Previewing" : "Writing"}
            helper="Current tool state"
          />
          <StatCard
            label="Factory hint"
            value={hasFactory ? "Provided" : "Optional"}
            helper="Used to speed detection"
          />
          <StatCard
            label="Detected kind"
            value={previewKind}
            helper="Derived after preview/write"
          />
          <StatCard
            label="Wallet"
            value={short(connectedAddress)}
            helper="Authorized admin session"
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="grid gap-5">
            <section className="rounded-3xl border border-border bg-background/50 p-4 md:p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Deployment input
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Enter the deployment transaction hash. Add the factory address
                  when you want faster or more explicit contract detection.
                </p>
              </div>

              <div className="grid gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">
                    Transaction hash
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-[18px] border border-border bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
                    placeholder="0x..."
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-foreground">
                    Factory address{" "}
                    <span className="text-xs text-muted">(optional)</span>
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-[18px] border border-border bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
                    placeholder="0x... (speeds up detection)"
                    value={factory}
                    onChange={(e) => setFactory(e.target.value)}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void doPreview()}
                  disabled={loading !== "idle"}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-medium text-foreground transition-all hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading === "preview" ? "Previewing..." : "Preview"}
                </button>

                <button
                  type="button"
                  onClick={() => void doWrite()}
                  disabled={loading !== "idle"}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading === "write" ? "Writing..." : "Write to DB"}
                </button>
              </div>
            </section>

            {error ? (
              <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="text-sm font-medium text-red-700 dark:text-red-300">
                  Request error
                </div>
                <div className="mt-1 text-sm leading-6 text-red-700 dark:text-red-300">
                  {error}
                </div>
              </section>
            ) : null}

            {preview ? (
              <section className="rounded-3xl border border-border bg-background/50 p-4 md:p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Preview
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      Review the chain-derived fields before writing to the database.
                    </p>
                  </div>

                  {preview.kind ? (
                    <div className="inline-flex h-9 items-center rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground">
                      {preview.kind}
                    </div>
                  ) : null}
                </div>

                {preview.derived ? (
                  <div className="grid gap-4">
                    <JsonBlock value={preview.derived} />
                  </div>
                ) : null}

                {preview.missing?.length ? (
                  <div className="mt-4 rounded-[20px] border border-border bg-card p-4">
                    <div className="text-sm font-medium text-foreground">
                      Missing fields
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {preview.missing.map((m) => (
                        <span
                          key={m}
                          className="rounded-full border border-border bg-background px-3 py-1 text-xs font-mono text-foreground"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {preview.hint ||
                        "Some fields could not be derived. The contract may not expose the expected getters."}
                    </p>
                  </div>
                ) : preview.hint ? (
                  <div className="mt-4 rounded-[20px] border border-border bg-card p-4 text-sm leading-6 text-muted">
                    {preview.hint}
                  </div>
                ) : null}
              </section>
            ) : null}

            {result ? (
              <section className="rounded-3xl border border-border bg-background/50 p-4 md:p-5">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Write result
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Reconciliation completed and records were written successfully.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <KeyValueRow label="Kind" value={result.kind} />
                  <KeyValueRow
                    label="Contract"
                    value={result.contract}
                    mono
                    copyable
                  />
                  <KeyValueRow
                    label="Single ID"
                    value={result.singleId}
                    mono
                    copyable
                  />
                  <KeyValueRow
                    label="NFT ID"
                    value={result.nftId}
                    mono
                    copyable
                  />
                  <div className="sm:col-span-2">
                    <KeyValueRow
                      label="Token URI"
                      value={result.tokenUri}
                      mono
                      copyable
                    />
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <div className="grid gap-5">
            <section className="rounded-3xl border border-border bg-background/50 p-4 md:p-5">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground">
                  Workflow notes
                </h3>
                <p className="mt-1 text-sm text-muted">
                  A calm little checklist so the chain gremlins stay in their box.
                </p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[18px] border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">
                    Step 1
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    Paste the deployment transaction hash
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Use the factory deployment transaction for the clone you want
                    to reconcile.
                  </p>
                </div>

                <div className="rounded-[18px] border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">
                    Step 2
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    Preview derived data
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Confirm contract kind, metadata fields and any missing values
                    before writing.
                  </p>
                </div>

                <div className="rounded-[18px] border border-border bg-card p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">
                    Step 3
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    Write reconciliation to DB
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    This upserts the contract, single record and NFT record based
                    on the chain-derived data.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-background/50 p-4 md:p-5">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground">
                  Current input summary
                </h3>
              </div>

              <div className="grid gap-3">
                <KeyValueRow
                  label="Admin wallet"
                  value={connectedAddress}
                  mono
                  copyable
                />
                <KeyValueRow
                  label="Transaction hash"
                  value={txHash || "Waiting for input"}
                  mono
                  truncate={!txHash}
                  copyable={Boolean(txHash)}
                />
                <KeyValueRow
                  label="Factory address"
                  value={factory || "Not provided"}
                  mono
                  truncate={!factory}
                  copyable={Boolean(factory)}
                />
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}