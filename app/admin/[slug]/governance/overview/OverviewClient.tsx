"use client";

import * as React from "react";
import Link from "next/link";
import { formatEther } from "viem";

import AddressChip from "@/src/ui/AddressChip";
import { useMultisig } from "@/src/lib/hooks/useMultisig";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import TxTable from "@/src/components/admin/governance/multisig/TxTable";

type OverviewClientProps = {
  allowedWallets: string[];
  baseHref: string;
};

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-[20px] border border-border bg-background p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
      {helper ? <div className="mt-1 text-xs text-muted">{helper}</div> : null}
    </div>
  );
}

export default function OverviewClient({
  allowedWallets,
  baseHref,
}: OverviewClientProps) {
  const {
    address,
    owners,
    required,
    balanceWei,
    txs,
    loading,
    error,
    refresh,
    hasConfirmed,
  } = useMultisig({ take: 5 });

  const [currentWallet, setCurrentWallet] = React.useState<`0x${string}` | undefined>(
    undefined
  );

  React.useEffect(() => {
    (async () => {
      try {
        const { signer } = await getBrowserSigner();
        setCurrentWallet((await signer.getAddress()) as `0x${string}`);
      } catch {
        setCurrentWallet(undefined);
      }
    })();
  }, []);

  const [mineConfirmed, setMineConfirmed] = React.useState<Record<number, boolean>>(
    {}
  );

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!currentWallet || !address || txs.length === 0) {
        if (!cancelled) setMineConfirmed({});
        return;
      }

      try {
        const checks = await Promise.all(
          txs.map((tx) => hasConfirmed(tx.index, currentWallet))
        );

        const map: Record<number, boolean> = {};
        checks.forEach((value, i) => {
          map[txs[i].index] = !!value;
        });

        if (!cancelled) setMineConfirmed(map);
      } catch {
        if (!cancelled) setMineConfirmed({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [txs, currentWallet, address, hasConfirmed]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Safe Summary</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              High-level overview of the governance safe, owner set, confirmation
              threshold, and available balance.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refresh}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card"
            >
              Refresh
            </button>

            <Link
              href={`${baseHref}/transactions`}
              className="inline-flex h-10 items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Open Transactions
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Safe Address"
            value={address ? <AddressChip address={address} showCopy /> : "—"}
          />
          <StatCard
            label="Owners"
            value={
              owners.length ? (
                <div className="flex flex-wrap gap-2">
                  {owners.map((owner) => (
                    <AddressChip key={owner} address={owner} />
                  ))}
                </div>
              ) : (
                "—"
              )
            }
            helper={owners.length ? `${owners.length} owner${owners.length > 1 ? "s" : ""}` : undefined}
          />
          <StatCard
            label="Required"
            value={<span className="text-lg font-semibold">{required}</span>}
            helper="Confirmations needed to execute"
          />
          <StatCard
            label="ETN Balance"
            value={`${formatEther(balanceWei)} ETN`}
            helper="Current safe balance"
          />
        </div>
      </section>

      {error ? (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-sm font-semibold text-foreground">Overview read error</div>
          <p className="mt-1 text-sm leading-6 text-muted">{error}</p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Latest Transactions
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Most recent multisig proposals, confirmations, and execution state.
            </p>
          </div>

          <Link
            href={`${baseHref}/transactions`}
            className="text-sm font-medium text-foreground underline underline-offset-4"
          >
            View all
          </Link>
        </div>

        <TxTable
          txs={txs}
          explorerUrl={
            process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
            process.env.NEXT_PUBLIC_BLOCK_EXPLORER
          }
          multisigAddress={address as `0x${string}`}
          allowedWallets={allowedWallets}
          owners={owners}
          currentWallet={currentWallet}
          mineConfirmed={mineConfirmed}
          hasConfirmed={hasConfirmed}
          onActionDone={refresh}
        />

        {loading ? (
          <div className="mt-3 text-sm text-muted">Loading latest transactions...</div>
        ) : null}
      </section>
    </div>
  );
}