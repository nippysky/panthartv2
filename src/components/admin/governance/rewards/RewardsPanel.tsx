"use client";

import * as React from "react";

import { useMultisig } from "@/src/lib/hooks/useMultisig";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";

import RewardsInfo from "@/src/components/admin/governance/rewards/RewardsInfo";
import FundRewardsForm from "@/src/components/admin/governance/rewards/FundRewardsForm";
import RotateSignerForm from "@/src/components/admin/governance/rewards/RotateSignerForm";
import PauseControls from "@/src/components/admin/governance/rewards/PauseControls";
import ManageFunderRole from "@/src/components/admin/governance/rewards/ManageFunderRole";
import RescueFundsForm from "@/src/components/admin/governance/rewards/RescueFundsForm";
import TxTable from "../multisig/TxTable";

const DISTRIBUTOR = process.env
  .NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS as `0x${string}` | undefined;

function PanelCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-border bg-card p-5 md:p-6 ${className}`}>
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

type RewardsPanelProps = {
  allowedWallets: string[];
};

export default function RewardsPanel({ allowedWallets }: RewardsPanelProps) {
  const { address, owners, txs, refresh, hasConfirmed } = useMultisig({
    take: 50,
  });

  const related = React.useMemo(
    () =>
      DISTRIBUTOR
        ? txs.filter((t) => t.to.toLowerCase() === DISTRIBUTOR.toLowerCase())
        : [],
    [txs]
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

  const [mineConfirmed, setMineConfirmed] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!currentWallet || !address || related.length === 0) {
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
  }, [related, currentWallet, address, hasConfirmed]);

  return (
    <div className="space-y-6">
      <PanelCard
        title="Rewards Distributor Overview"
        description="Read-only status of the rewards distributor, signer, and runtime state."
      >
        <RewardsInfo />
      </PanelCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <PanelCard
          title="Fund Rewards Distributor"
          description="Send ETN into the rewards distributor through a multisig proposal."
        >
          <FundRewardsForm allowedWallets={allowedWallets} />
        </PanelCard>

        <PanelCard
          title="Rotate Signer"
          description="Propose a signer rotation for the rewards distributor."
        >
          <RotateSignerForm allowedWallets={allowedWallets} />
        </PanelCard>

        <PanelCard
          title="Pause Controls"
          description="Pause or resume rewards operations through governance."
        >
          <PauseControls allowedWallets={allowedWallets} />
        </PanelCard>

        <PanelCard
          title="Manage FUNDER_ROLE"
          description="Grant or revoke funder permissions for approved addresses."
        >
          <ManageFunderRole allowedWallets={allowedWallets} />
        </PanelCard>
      </div>

      <PanelCard
        title="Rescue Funds"
        description="Admin-only sweep of native or ERC-20 balances from the rewards distributor."
      >
        <RescueFundsForm allowedWallets={allowedWallets} />
        <div className="mt-4 text-xs leading-5 text-muted">
          For ERC-20, this transfers tokens from the Rewards Distributor to the
          specified target using the contract rescue flow.
        </div>
      </PanelCard>

      <PanelCard
        title="Related Transactions"
        description="Recent multisig transactions that target the rewards distributor."
      >
        <TxTable
          txs={related}
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
      </PanelCard>
    </div>
  );
}