"use client";

import * as React from "react";
import { useMarketplaceAdmin } from "@/src/lib/hooks/useMarketplaceAdmin";

import PauseControls from "./PauseControls";
import RoleGuardCard from "./RoleGuardCard";
import SetConfigForm from "./SetConfigForm";
import ToggleCurrencyForm from "./ToggleCurrencyForm";
import CurrencyManager from "./CurrencyManager";
import FundRewardsForm from "../rewards/FundRewardsForm";
import AddressChip from "@/src/ui/AddressChip";

type Props = { allowedWallets: string[] };

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "danger"
        ? "text-red-700 dark:text-red-300"
        : "text-foreground";

  return (
    <div className="rounded-[20px] border border-border bg-background p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className={`mt-2 text-sm font-medium ${toneClass}`}>{value}</div>
    </div>
  );
}

function PanelCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {children}
    </section>
  );
}

export default function MarketplaceAdminPanel({ allowedWallets }: Props) {
  const mp = useMarketplaceAdmin();

  return (
    <div className="space-y-6">
      {mp.error ? (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-sm font-medium text-red-700 dark:text-red-300">
            Marketplace read error
          </div>
          <p className="mt-1 text-sm leading-6 text-red-700 dark:text-red-300">
            {mp.error}
          </p>
        </section>
      ) : null}

      <PanelCard
        title="Marketplace Overview"
        description="Read-only overview of the marketplace contract state, configuration, and connected governance references."
        action={
          <button
            type="button"
            onClick={mp.refresh}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card"
          >
            Refresh
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Contract"
            value={<AddressChip address={mp.address || ""} showCopy />}
          />
          <StatTile label="Network" value={`Chain ID ${mp.chainId ?? "-"}`} />
          <StatTile
            label="Paused"
            tone={mp.paused ? "danger" : "success"}
            value={mp.paused ? "Yes" : "No"}
          />
          <StatTile
            label="ETN Allowed"
            tone={mp.etnAllowed ? "success" : "danger"}
            value={mp.etnAllowed ? "Yes" : "No"}
          />

          <StatTile label="Fee Bps" value={mp.feeBps.toString()} />
          <StatTile
            label="Distributor Share Bps"
            value={mp.distributorShareBps.toString()}
          />
          <StatTile
            label="Snipe Extension (s)"
            value={mp.snipeExtension.toString()}
          />
          <StatTile
            label="Fee Recipient"
            value={<AddressChip address={mp.feeRecipient || ""} showCopy />}
          />

          <StatTile
            label="Rewards Distributor"
            value={<AddressChip address={mp.rewardsDistributor || ""} showCopy />}
          />
          <StatTile
            label="Stolen Registry"
            value={<AddressChip address={mp.stolenRegistry || ""} showCopy />}
          />
        </div>
      </PanelCard>

      <RoleGuardCard allowedWallets={allowedWallets} />

      <SetConfigForm allowedWallets={allowedWallets} />

      <div className="grid gap-6 xl:grid-cols-2">
        <PauseControls allowedWallets={allowedWallets} />
        <ToggleCurrencyForm allowedWallets={allowedWallets} />
      </div>

      <CurrencyManager allowedWallets={allowedWallets} />

      <FundRewardsForm allowedWallets={allowedWallets} />
    </div>
  );
}