/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { formatEther, getAddress } from "viem";
import { toast } from "sonner";
import { ethers } from "ethers";

import { useMultisig } from "@/src/lib/hooks/useMultisig";
import { ZERO_ADDRESS, getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import NewTxDialog, { type NewTxDraft } from "./NewTxDialog";
import TxTable from "./TxTable";
import AddressChip from "@/src/ui/AddressChip";

type Props = {
  allowedWallets: string[];
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

export default function AdminMultisigClient({ allowedWallets }: Props) {
  const {
    address,
    owners,
    required,
    balanceWei,
    txs,
    loading,
    error,
    refresh,
    chainId,
    hasConfirmed,
  } = useMultisig({ take: 25 });

  const [open, setOpen] = React.useState(false);
  const [currentWallet, setCurrentWallet] = React.useState<`0x${string}` | undefined>(
    undefined
  );
  const [mineConfirmed, setMineConfirmed] = React.useState<Record<number, boolean>>(
    {}
  );

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { signer } = await getBrowserSigner();
        const wallet = await signer.getAddress();
        const checksum = getAddress(wallet) as `0x${string}`;

        const flags: Record<number, boolean> = {};
        for (const t of txs) {
          flags[t.index] = await hasConfirmed(t.index, checksum);
        }

        if (!cancelled) {
          setCurrentWallet(checksum);
          setMineConfirmed(flags);
        }
      } catch {
        if (!cancelled) {
          setCurrentWallet(undefined);
          setMineConfirmed({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [txs, hasConfirmed]);

  const isOwner =
    !!currentWallet &&
    owners.map((o) => o.toLowerCase()).includes(currentWallet.toLowerCase());

  const submitNewTx = async (draft: NewTxDraft) => {
    try {
      const { signer, chainId } = await getBrowserSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
        throw new Error("This wallet is not in the allowed admin list.");
      }

      if (!address) throw new Error("Multisig address missing.");

      if (chainId !== 52014) {
        throw new Error("Wrong network. Please switch to Chain ID 52014.");
      }

      const contract = new ethers.Contract(address, MULTI_SIG_ABI as any, signer);

      const to = getAddress(draft.to);
      const value = ethers.parseEther(draft.valueEtn || "0");
      const data = draft.data && draft.data.length > 0 ? draft.data : "0x";

      const txResp = await contract.submitAndConfirm(
        ZERO_ADDRESS,
        to,
        value,
        data
      );

      toast.message("Submitting transaction...");
      await txResp.wait();
      toast.success("Transaction submitted and your confirmation was recorded.");
      setOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    }
  };

  return (
    <div className="space-y-6">
      {!isOwner ? (
        <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="text-sm font-semibold text-foreground">View only</div>
          <p className="mt-1 text-sm leading-6 text-muted">
            Connect one of the multisig owners to confirm or execute transactions.
          </p>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-sm font-semibold text-foreground">Multisig read error</div>
          <p className="mt-1 text-sm leading-6 text-muted">{error}</p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Safe Summary</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Overview of the multisig, connected owners, current balance, and
              execution threshold.
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

            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={!isOwner}
              className="inline-flex h-10 items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              New Transaction
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Safe Address"
            value={address ? <AddressChip address={address} showCopy /> : "—"}
          />
          <StatCard
            label="Network"
            value={`Chain ID ${chainId ?? "-"}`}
          />
          <StatCard
            label="ETN Balance"
            value={`${formatEther(balanceWei)} ETN`}
          />
          <StatCard
            label="Required Confirmations"
            value={<span className="text-lg font-semibold">{required}</span>}
          />
        </div>

        <div className="mt-5 rounded-[20px] border border-border bg-background p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Owners
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {owners.length ? (
              owners.map((owner) => (
                <AddressChip key={owner} address={owner} showCopy />
              ))
            ) : (
              <span className="text-sm text-muted">No owners found.</span>
            )}
          </div>

          <div className="mt-4 text-xs text-muted">
            Allowed admin wallets: {allowedWallets.join(", ")}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">
            Recent Transactions
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Review, confirm, and execute multisig transactions from the same
            governance workspace.
          </p>
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
          <div className="mt-3 text-sm text-muted">Loading transactions...</div>
        ) : null}
      </section>

      <NewTxDialog open={open} onOpenChange={setOpen} onSubmit={submitNewTx} />
    </div>
  );
}