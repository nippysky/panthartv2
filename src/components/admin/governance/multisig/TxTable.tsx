/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { ethers } from "ethers";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { shortAddress, formatETN, formatDate } from "@/src/lib/format";

export type UiTx = {
  index: number;
  to: `0x${string}`;
  tokenAddress: `0x${string}`;
  valueWei: bigint;
  executed: boolean;
  confirmations: number;
  required: number;
  data: `0x${string}` | "0x";
};

function StatusBadge({
  executed,
  confirmations,
  required,
}: {
  executed: boolean;
  confirmations: number;
  required: number;
}) {
  if (executed) {
    return (
      <span className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
        Executed
      </span>
    );
  }

  if (confirmations >= required) {
    return (
      <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        Ready
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted">
      Pending
    </span>
  );
}

function AvatarChip({
  addr,
  highlight,
}: {
  addr: `0x${string}`;
  highlight?: boolean;
}) {
  const url = `https://api.dicebear.com/7.x/identicon/svg?seed=${addr}`;

  return (
    <img
      src={url}
      alt={addr}
      width={22}
      height={22}
      className={[
        "h-5.5 w-5.5 rounded-full bg-background ring-1",
        highlight ? "ring-emerald-500" : "ring-border",
      ].join(" ")}
    />
  );
}

function ConfirmersCell({
  txIndex,
  owners,
  hasConfirmed,
  currentWallet,
}: {
  txIndex: number;
  owners: `0x${string}`[];
  hasConfirmed: (txIndex: number, owner?: `0x${string}`) => Promise<boolean>;
  currentWallet?: `0x${string}`;
}) {
  const [confirmed, setConfirmed] = React.useState<`0x${string}`[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const checks = await Promise.all(owners.map((o) => hasConfirmed(txIndex, o)));
        const list = owners.filter((_, i) => checks[i]);
        if (!cancelled) setConfirmed(list);
      } catch {
        if (!cancelled) setConfirmed([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [txIndex, owners, hasConfirmed]);

  if (owners.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5"
      >
        {confirmed.length ? (
          <>
            <div className="flex -space-x-1.5">
              {confirmed.map((a) => (
                <AvatarChip
                  key={a}
                  addr={a}
                  highlight={
                    currentWallet ? a.toLowerCase() === currentWallet.toLowerCase() : false
                  }
                />
              ))}
            </div>
            <span className="text-xs text-muted">
              {confirmed.length} confirmer{confirmed.length > 1 ? "s" : ""}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted">No confirmations yet</span>
        )}
      </button>

      {open && confirmed.length > 0 ? (
        <div className="mt-2 rounded-2xl border border-border bg-background p-3">
          <div className="mb-2 text-xs font-medium text-foreground">
            Confirmed by
          </div>
          <ul className="space-y-2">
            {confirmed.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <AvatarChip
                  addr={a}
                  highlight={
                    currentWallet ? a.toLowerCase() === currentWallet.toLowerCase() : false
                  }
                />
                <span className="font-mono text-xs text-foreground">
                  {a.slice(0, 8)}…{a.slice(-6)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  txs: UiTx[];
  explorerUrl?: string;
  multisigAddress: `0x${string}`;
  allowedWallets: string[];
  owners?: `0x${string}`[];
  currentWallet?: `0x${string}`;
  mineConfirmed?: Record<number, boolean>;
  hasConfirmed: (txIndex: number, owner?: `0x${string}`) => Promise<boolean>;
  onActionDone?: () => void;
};

export default function TxTable({
  txs,
  explorerUrl,
  multisigAddress,
  allowedWallets,
  owners = [],
  currentWallet,
  mineConfirmed = {},
  hasConfirmed,
  onActionDone,
}: Props) {
  const [busy, setBusy] = React.useState<{
    idx: number;
    kind: "confirm" | "execute";
  } | null>(null);

  const isOwner = currentWallet
    ? owners.map((o) => o.toLowerCase()).includes(currentWallet.toLowerCase())
    : false;

  const guardAllowed = async () => {
    const { signer, chainId } = await getBrowserSigner();
    const addr = (await signer.getAddress()).toLowerCase();

    if (!allowedWallets.map((x) => x.toLowerCase()).includes(addr)) {
      throw new Error("This wallet is not in the allowed admin list.");
    }

    if (chainId !== 52014) {
      throw new Error("Wrong network. Please switch to Chain ID 52014.");
    }

    return signer;
  };

  const onConfirm = async (txIndex: number) => {
    try {
      setBusy({ idx: txIndex, kind: "confirm" });

      const signer = await guardAllowed();
      const contract = new ethers.Contract(multisigAddress, MULTI_SIG_ABI as any, signer);

      const resp = await contract.confirmTransaction(BigInt(txIndex));
      toast.message("Confirming transaction...");
      await resp.wait();
      toast.success(`Confirmed tx #${txIndex}`);
      onActionDone?.();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const onExecute = async (txIndex: number) => {
    try {
      setBusy({ idx: txIndex, kind: "execute" });

      const signer = await guardAllowed();
      const contract = new ethers.Contract(multisigAddress, MULTI_SIG_ABI as any, signer);

      const resp = await contract.executeTransaction(BigInt(txIndex));
      toast.message("Executing transaction...");
      await resp.wait();
      toast.success(`Executed tx #${txIndex}`);
      onActionDone?.();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  if (txs.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-border bg-background p-8 text-center text-sm text-muted">
        No transactions yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-border">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-background/80">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Index
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                To
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Value
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Confirmations
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Status
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {txs.map((t) => {
              const alreadyConfirmed = !!mineConfirmed[t.index];
              const canConfirm =
                !t.executed && isOwner && !alreadyConfirmed && t.confirmations < t.required;
              const canExecute =
                !t.executed && t.confirmations >= t.required && isOwner;

              const isConfirmBusy =
                busy?.idx === t.index && busy.kind === "confirm";
              const isExecuteBusy =
                busy?.idx === t.index && busy.kind === "execute";

              return (
                <tr key={t.index} className="bg-card align-top">
                  <td className="px-4 py-4 font-mono text-xs text-foreground">
                    {t.index}
                  </td>

                  <td className="px-4 py-4 font-mono text-xs text-foreground">
                    {explorerUrl ? (
                      <a
                        className="underline underline-offset-4"
                        href={`${explorerUrl}/address/${t.to}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortAddress(t.to)}
                      </a>
                    ) : (
                      shortAddress(t.to)
                    )}
                  </td>

                  <td className="px-4 py-4 text-foreground">
                    {formatETN(t.valueWei)}
                  </td>

                  <td className="px-4 py-4 text-foreground">
                    <div>
                      {t.confirmations}/{t.required}
                    </div>
                    <ConfirmersCell
                      txIndex={t.index}
                      owners={owners}
                      hasConfirmed={hasConfirmed}
                      currentWallet={currentWallet}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge
                      executed={t.executed}
                      confirmations={t.confirmations}
                      required={t.required}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      {!t.executed ? (
                        <button
                          type="button"
                          disabled={!canConfirm || isConfirmBusy}
                          onClick={() => onConfirm(t.index)}
                          title={
                            t.executed
                              ? "Already executed"
                              : !isOwner
                                ? "Only multisig owners can confirm"
                                : alreadyConfirmed
                                  ? "You already confirmed this transaction"
                                  : t.confirmations >= t.required
                                    ? "Already has enough confirmations"
                                    : undefined
                          }
                          className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isConfirmBusy ? "Confirming..." : "Confirm"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        disabled={!canExecute || isExecuteBusy}
                        onClick={() => onExecute(t.index)}
                        title={
                          t.executed
                            ? "Already executed"
                            : t.confirmations < t.required
                              ? "Needs more confirmations"
                              : !isOwner
                                ? "Only multisig owners can execute"
                                : undefined
                        }
                        className="inline-flex h-9 items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isExecuteBusy ? "Executing..." : "Execute"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border bg-background px-4 py-3 text-xs text-muted">
        Updated {formatDate(new Date())}. Use the Refresh button above to reload.
      </div>
    </div>
  );
}