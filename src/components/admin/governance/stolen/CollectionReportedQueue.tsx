/* eslint-disable @next/next/no-img-element */
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

type Row = {
  contract: string;
  itemsReported: number;
  latestReportedAt: string | null;
  name: string | null;
  symbol: string | null;
  logoUrl: string | null;
  onChainActive: boolean;
  evidenceUrl: string | null;
  notes: string | null;
};

function reasonHashFromCollection(contract: string): `0x${string}` {
  return ethers.id(`USER_REPORT_COLLECTION:${contract.toLowerCase()}`) as `0x${string}`;
}

export default function CollectionReportedQueue({
  allowedWallets,
}: {
  allowedWallets: string[];
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busyContract, setBusyContract] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/governance/stolen/reports/collections").then((r) =>
        r.json()
      );
      if (res?.ok) setRows(res.data || []);
      else toast.error(res?.error || "Failed to load collection reports");
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

  const proposeFlagCollection = async (row: Row) => {
    try {
      setBusyContract(`flag-${row.contract}`);

      const signer = await guard();
      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData("flagCollection", [
        getAddress(row.contract),
        reasonHashFromCollection(row.contract),
        row.evidenceUrl || "",
      ]);

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);
      const resp = await multisig.submitAndConfirm(
        ZERO_ADDRESS,
        REGISTRY,
        BigInt(0),
        data
      );

      toast.message("Submitting flag collection proposal...");
      await resp.wait();
      toast.success("Flag collection proposal submitted successfully.");
      load();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusyContract(null);
    }
  };

  const proposeClearCollection = async (row: Row) => {
    try {
      setBusyContract(`clear-${row.contract}`);

      const signer = await guard();
      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData("clearCollection", [getAddress(row.contract)]);

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);
      const resp = await multisig.submitAndConfirm(
        ZERO_ADDRESS,
        REGISTRY,
        BigInt(0),
        data
      );

      toast.message("Submitting clear collection proposal...");
      await resp.wait();
      toast.success("Clear collection proposal submitted successfully.");
      load();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusyContract(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Reported Collections (Users)
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Collection-level reports aggregated from users, with on-chain flag and clear controls.
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
          No collection reports yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-background/80">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    Collection
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted whitespace-nowrap">
                    Items Reported
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    Latest Report
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
                  const addrLink = EXPLORER
                    ? `${EXPLORER}/address/${row.contract}`
                    : undefined;
                  const latest = row.latestReportedAt
                    ? new Date(row.latestReportedAt).toLocaleString()
                    : "—";

                  return (
                    <tr key={row.contract} className="bg-card align-top">
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          {row.logoUrl ? (
                            <img
                              src={row.logoUrl}
                              alt={row.name || row.symbol || row.contract}
                              width={32}
                              height={32}
                              className="mt-0.5 h-8 w-8 rounded-[10px] object-cover"
                            />
                          ) : null}

                          <div className="min-w-0">
                            <div className="font-medium text-foreground">
                              {row.name || row.symbol || "Collection"}
                            </div>

                            <div className="mt-2">
                              {addrLink ? (
                                <a
                                  className="inline-flex"
                                  href={addrLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <AddressChip address={row.contract} showCopy />
                                </a>
                              ) : (
                                <AddressChip address={row.contract} showCopy />
                              )}
                            </div>

                            {row.evidenceUrl || row.notes ? (
                              <div className="mt-2 max-w-md wrap-break-word text-xs text-muted">
                                {row.evidenceUrl ? (
                                  <>
                                    Evidence:{" "}
                                    <a
                                      className="underline underline-offset-4"
                                      href={row.evidenceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {row.evidenceUrl}
                                    </a>
                                  </>
                                ) : null}

                                {row.notes ? (
                                  <>
                                    {row.evidenceUrl ? " — " : null}
                                    {row.notes}
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-foreground">
                        {row.itemsReported}
                      </td>

                      <td className="px-4 py-4 text-foreground">{latest}</td>

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
                            onClick={() => proposeClearCollection(row)}
                            disabled={!row.onChainActive || busyContract !== null}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyContract === `clear-${row.contract}`
                              ? "Submitting..."
                              : "Propose Clear"}
                          </button>

                          <button
                            type="button"
                            onClick={() => proposeFlagCollection(row)}
                            disabled={row.onChainActive || busyContract !== null}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyContract === `flag-${row.contract}`
                              ? "Submitting..."
                              : "Propose Flag"}
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

      {loading ? <div className="mt-3 text-sm text-muted">Loading...</div> : null}
    </section>
  );
}