/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { ethers } from "ethers";
import { getAddress } from "viem";

import AddressChip from "@/src/ui/AddressChip";
import { getBrowserSigner, ZERO_ADDRESS } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { STOLEN_REGISTRY_ABI } from "@/src/lib/abis/marketplace-core/stolenRegistryABI";

const EXPLORER =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER ||
  "";
const REGISTRY = process.env.NEXT_PUBLIC_STOLEN_REGISTRY_ADDRESS as `0x${string}`;
const MULTISIG = process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS as `0x${string}`;

export type ReportRow = {
  id: string;
  contract: string;
  tokenId: string;
  reporterAddress: string | null;
  reporterUserId: string | null;
  evidenceUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  onChainActive: boolean;
};

function reasonHashFrom(id: string) {
  return ethers.id(`USER_REPORT:${id}`) as `0x${string}`;
}

export default function ReportedQueue({
  allowedWallets,
}: {
  allowedWallets: string[];
}) {
  const [rows, setRows] = React.useState<ReportRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/governance/stolen/reports").then((r) => r.json());
      if (res?.ok) setRows(res.data || []);
      else toast.error(res?.error || "Failed to load reports");
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const guard = async () => {
    const { signer, chainId } = await getBrowserSigner();
    const wallet = (await signer.getAddress()).toLowerCase();

    if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
      throw new Error("This wallet is not in the allowed admin list.");
    }

    if (chainId !== 52014) {
      throw new Error("Wrong network. Switch to Chain ID 52014.");
    }

    return signer;
  };

  const proposeFlag = async (row: ReportRow) => {
    try {
      setBusyId(`flag-${row.id}`);

      const signer = await guard();
      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData("flag", [
        getAddress(row.contract),
        BigInt(row.tokenId),
        reasonHashFrom(row.id),
        row.evidenceUrl || "",
      ]);

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);
      const resp = await multisig.submitAndConfirm(
        ZERO_ADDRESS,
        REGISTRY,
        BigInt(0),
        data
      );

      toast.message("Submitting on-chain flag proposal...");
      await resp.wait();
      toast.success("Flag proposal submitted successfully.");
      load();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  };

  const proposeClear = async (row: ReportRow) => {
    try {
      setBusyId(`clear-${row.id}`);

      const signer = await guard();
      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData("clear", [
        getAddress(row.contract),
        BigInt(row.tokenId),
      ]);

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);
      const resp = await multisig.submitAndConfirm(
        ZERO_ADDRESS,
        REGISTRY,
        BigInt(0),
        data
      );

      toast.message("Submitting on-chain clear proposal...");
      await resp.wait();
      toast.success("Clear proposal submitted successfully.");
      load();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Reported Queue (Users)
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            User-submitted NFT reports that can be mirrored on-chain through the registry.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!loading && rows.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border bg-background p-8 text-center text-sm text-muted">
          No user reports found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-background/80">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    NFT
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    Reporter
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    Evidence
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    On-chain
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const nftLink = EXPLORER
                    ? `${EXPLORER}/token/${row.contract}?a=${row.tokenId}`
                    : undefined;
                  const contractLink = EXPLORER
                    ? `${EXPLORER}/address/${row.contract}`
                    : undefined;

                  return (
                    <tr key={row.id} className="bg-card align-top">
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {contractLink ? (
                              <a
                                className="inline-flex"
                                href={contractLink}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <AddressChip address={row.contract} showCopy />
                              </a>
                            ) : (
                              <AddressChip address={row.contract} showCopy />
                            )}
                            <span className="text-xs text-muted">#{row.tokenId}</span>
                          </div>

                          {nftLink ? (
                            <a
                              href={nftLink}
                              className="text-xs underline underline-offset-4 text-muted"
                              target="_blank"
                              rel="noreferrer"
                            >
                              View token
                            </a>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {row.reporterAddress ? (
                          <AddressChip address={row.reporterAddress} />
                        ) : (
                          <span className="text-muted">—</span>
                        )}

                        {row.notes ? (
                          <div className="mt-2 max-w-xs wrap-break-word text-xs text-muted">
                            {row.notes}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        {row.evidenceUrl ? (
                          <a
                            className="break-all underline underline-offset-4"
                            href={row.evidenceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.evidenceUrl}
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                            row.onChainActive
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border border-border bg-background text-muted",
                          ].join(" ")}
                        >
                          {row.onChainActive ? "Yes" : "No"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => proposeClear(row)}
                            disabled={!row.onChainActive || busyId !== null}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyId === `clear-${row.id}` ? "Submitting..." : "Propose Clear"}
                          </button>

                          <button
                            type="button"
                            onClick={() => proposeFlag(row)}
                            disabled={row.onChainActive || busyId !== null}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyId === `flag-${row.id}` ? "Submitting..." : "Propose Flag"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-3 text-sm text-muted">Loading...</div>
      ) : null}
    </section>
  );
}