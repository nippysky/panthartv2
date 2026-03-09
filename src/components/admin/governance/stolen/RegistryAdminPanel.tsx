"use client";

import * as React from "react";

import AddressChip from "@/src/ui/AddressChip";


import { useStolenRegistryAdmin } from "@/src/lib/hooks/useStolenRegistryAdmin";
import { useMultisig } from "@/src/lib/hooks/useMultisig";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";

import RoleGuardCard from "./RoleGuardCard";
import PauseControls from "./PauseControls";
import FlagClearForms from "./FlagClearForms";
import ReportedQueue from "./ReportedQueue";
import CollectionReportedQueue from "./CollectionReportedQueue";
import StaffRoleManager from "./StaffRoleManager";
import TxTable from "../multisig/TxTable";

function PanelCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
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
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-border bg-background p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export default function RegistryAdminPanel({
  allowedWallets,
}: {
  allowedWallets: string[];
}) {
  const reg = useStolenRegistryAdmin();
  const {
    address: safe,
    owners,
    txs,
    refresh: refreshMs,
    hasConfirmed,
  } = useMultisig({ take: 50 });

  const related = React.useMemo(
    () =>
      reg.address
        ? txs.filter((t) => t.to.toLowerCase() === reg.address!.toLowerCase())
        : [],
    [txs, reg.address]
  );

  const [currentWallet, setCurrentWallet] = React.useState<`0x${string}` | undefined>();
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
      if (!currentWallet || !safe || related.length === 0) {
        if (!cancelled) setMineConfirmed({});
        return;
      }

      try {
        const checks = await Promise.all(
          related.map((t) => hasConfirmed(t.index, currentWallet))
        );
        const map: Record<number, boolean> = {};
        checks.forEach((value, i) => {
          map[related[i].index] = !!value;
        });

        if (!cancelled) setMineConfirmed(map);
      } catch {
        if (!cancelled) setMineConfirmed({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [related, currentWallet, safe, hasConfirmed]);

  return (
    <div className="space-y-6">
      <PanelCard
        title="Stolen Registry Overview"
        description="Overview of the stolen registry contract, network state, and pause status."
      >
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={reg.refresh}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card"
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            label="Registry"
            value={reg.address ? <AddressChip address={reg.address} showCopy /> : "—"}
          />
          <StatCard label="Network" value={`Chain ID ${reg.chainId ?? "-"}`} />
          <StatCard
            label="Paused"
            value={
              <span
                className={[
                  "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                  reg.paused
                    ? "border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
                    : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                ].join(" ")}
              >
                {reg.paused ? "Yes" : "No"}
              </span>
            }
          />
        </div>
      </PanelCard>

      <RoleGuardCard allowedWallets={allowedWallets} />
      <StaffRoleManager allowedWallets={allowedWallets} />
      <PauseControls allowedWallets={allowedWallets} />
      <ReportedQueue allowedWallets={allowedWallets} />
      <CollectionReportedQueue allowedWallets={allowedWallets} />
      <FlagClearForms allowedWallets={allowedWallets} />

      <PanelCard
        title="Related Transactions"
        description="Recent multisig transactions targeting the stolen registry."
      >
        <TxTable
          txs={related}
          explorerUrl={
            process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
            process.env.NEXT_PUBLIC_BLOCK_EXPLORER
          }
          multisigAddress={safe as `0x${string}`}
          allowedWallets={allowedWallets}
          owners={owners}
          currentWallet={currentWallet}
          mineConfirmed={mineConfirmed}
          hasConfirmed={hasConfirmed}
          onActionDone={refreshMs}
        />
      </PanelCard>
    </div>
  );
}