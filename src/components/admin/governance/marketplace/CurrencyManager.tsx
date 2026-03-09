/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { createPublicClient, getAddress, http } from "viem";
import { ethers } from "ethers";

import AddressChip from "@/src/ui/AddressChip";
import { getBrowserSigner, ZERO_ADDRESS } from "@/src/lib/evm/getSigner";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "";
const MARKETPLACE =
  process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
const MULTISIG = process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS as `0x${string}`;
const EXPLORER =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER ||
  "";

type DbCurrency = {
  id: string;
  symbol: string;
  decimals: number;
  kind: "NATIVE" | "ERC20";
  tokenAddress: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function TableHeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
      {children}
    </th>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export default function CurrencyManager({
  allowedWallets,
}: {
  allowedWallets: string[];
}) {
  const [list, setList] = React.useState<DbCurrency[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [newAddr, setNewAddr] = React.useState("");
  const [busyToken, setBusyToken] = React.useState<string | null>(null);
  const [allowedMap, setAllowedMap] = React.useState<Record<string, boolean>>(
    {}
  );

  const client = React.useMemo(() => {
    if (!RPC_URL) return null;
    return createPublicClient({ transport: http(RPC_URL) });
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/governance/currencies").then((r) => r.json());
      if (res?.ok) setList(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAllowed = React.useCallback(async () => {
    try {
      if (!client || !MARKETPLACE) return;

      const items = list.filter(
        (c) => c.kind === "ERC20" && c.tokenAddress
      ) as DbCurrency[];

      const targets = [
        { key: ZERO_ADDRESS.toLowerCase(), addr: ZERO_ADDRESS as `0x${string}` },
        ...items.map((c) => ({
          key: c.tokenAddress!.toLowerCase(),
          addr: c.tokenAddress! as `0x${string}`,
        })),
      ];

      const next: Record<string, boolean> = {};
      for (const t of targets) {
        try {
          const ok = (await client.readContract({
            address: MARKETPLACE,
            abi: MARKETPLACE_CORE_ABI as any,
            functionName: "currencyAllowed",
            args: [t.addr],
          })) as boolean;
          next[t.key] = !!ok;
        } catch {
          next[t.key] = false;
        }
      }

      setAllowedMap(next);
    } catch (e) {
      console.error(e);
    }
  }, [client, list]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    refreshAllowed();
  }, [refreshAllowed]);

  const onAdd = async () => {
    try {
      const tokenAddress = getAddress(newAddr);

      const res = await fetch("/api/governance/currencies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenAddress }),
      }).then((r) => r.json());

      if (!res.ok) throw new Error(res.error || "Add failed");

      toast.success(
        `Added ${res.data.symbol} (${res.data.decimals} decimals)`
      );
      setNewAddr("");
      await load();
      await refreshAllowed();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    }
  };

  const proposeToggle = async (token: `0x${string}`, allowed: boolean) => {
    try {
      if (!MARKETPLACE || !MULTISIG) {
        throw new Error("Missing env addresses.");
      }

      const { signer, chainId } = await getBrowserSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
        throw new Error("This wallet is not in the allowed admin list.");
      }

      if (chainId !== 52014) {
        throw new Error("Wrong network. Switch to Chain ID 52014.");
      }

      setBusyToken(`${token}-${allowed ? "allow" : "disallow"}`);

      const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
      const data = iface.encodeFunctionData("setCurrencyAllowed", [
        token,
        allowed,
      ]);

      const multisig = new ethers.Contract(
        MULTISIG,
        [
          {
            inputs: [
              { internalType: "address", name: "tokenAddress", type: "address" },
              { internalType: "address", name: "to", type: "address" },
              { internalType: "uint256", name: "value", type: "uint256" },
              { internalType: "bytes", name: "data", type: "bytes" },
            ],
            name: "submitAndConfirm",
            outputs: [{ internalType: "uint256", name: "txIndex", type: "uint256" }],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        signer
      );

      const txResp = await multisig.submitAndConfirm(
        ZERO_ADDRESS,
        MARKETPLACE,
        BigInt(0),
        data
      );

      toast.message("Submitting multisig proposal...");
      await txResp.wait();
      toast.success("Proposal submitted. Confirm in Transactions.");

      await refreshAllowed();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusyToken(null);
    }
  };

  const nativeAllowed = allowedMap[ZERO_ADDRESS.toLowerCase()] ?? false;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">Currencies</h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Add supported ERC-20 currencies to the DB and propose allow/disallow
          changes through the multisig.
        </p>
      </div>

      <div className="rounded-[20px] border border-border bg-background p-4 md:p-5">
        <div className="mb-2 text-sm font-medium text-foreground">
          Add ERC-20 by address
        </div>
        <p className="mb-4 text-xs leading-5 text-muted">
          Symbol and decimals are fetched from chain, then stored in the DB.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            placeholder="0x..."
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            className="h-11 flex-1 rounded-[18px] border border-border bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={!newAddr.trim()}
            className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Currency
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[20px] border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-background/80">
              <tr>
                <TableHeaderCell>Symbol</TableHeaderCell>
                <TableHeaderCell>Address</TableHeaderCell>
                <TableHeaderCell>Allowed</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              <tr className="bg-card">
                <td className="px-4 py-4 align-middle text-foreground">
                  ETN <span className="text-xs text-muted">(native)</span>
                </td>
                <td className="px-4 py-4 align-middle">
                  <AddressChip address={ZERO_ADDRESS} showCopy />
                </td>
                <td className="px-4 py-4 align-middle">
                  <span
                    className={[
                      "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                      nativeAllowed
                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border border-border bg-background text-muted",
                    ].join(" ")}
                  >
                    {nativeAllowed ? "Allowed" : "Blocked"}
                  </span>
                </td>
                <td className="px-4 py-4 align-middle">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      disabled={
                        nativeAllowed || busyToken === `${ZERO_ADDRESS}-allow`
                      }
                      onClick={() => proposeToggle(ZERO_ADDRESS, true)}
                    >
                      {busyToken === `${ZERO_ADDRESS}-allow`
                        ? "Proposing..."
                        : "Propose Allow"}
                    </ActionButton>

                    <ActionButton
                      disabled={
                        !nativeAllowed ||
                        busyToken === `${ZERO_ADDRESS}-disallow`
                      }
                      onClick={() => proposeToggle(ZERO_ADDRESS, false)}
                    >
                      {busyToken === `${ZERO_ADDRESS}-disallow`
                        ? "Proposing..."
                        : "Propose Disallow"}
                    </ActionButton>
                  </div>
                </td>
              </tr>

              {list
                .filter((c) => c.kind === "ERC20" && c.tokenAddress)
                .map((c) => {
                  const addr = c.tokenAddress!;
                  const addrLc = addr.toLowerCase();
                  const allowed = allowedMap[addrLc] ?? false;
                  const busyAllow = busyToken === `${addr}-allow`;
                  const busyDisallow = busyToken === `${addr}-disallow`;

                  const chip = <AddressChip address={addr as `0x${string}`} showCopy />;

                  return (
                    <tr key={c.id} className="bg-card">
                      <td className="px-4 py-4 align-middle text-foreground">
                        {c.symbol}{" "}
                        <span className="text-xs text-muted">({c.decimals})</span>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        {EXPLORER ? (
                          <a
                            className="inline-flex max-w-full"
                            href={`${EXPLORER}/address/${addr}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {chip}
                          </a>
                        ) : (
                          chip
                        )}
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                            allowed
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border border-border bg-background text-muted",
                          ].join(" ")}
                        >
                          {allowed ? "Allowed" : "Blocked"}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            disabled={allowed || busyAllow}
                            onClick={() =>
                              proposeToggle(addr as `0x${string}`, true)
                            }
                          >
                            {busyAllow ? "Proposing..." : "Propose Allow"}
                          </ActionButton>

                          <ActionButton
                            disabled={!allowed || busyDisallow}
                            onClick={() =>
                              proposeToggle(addr as `0x${string}`, false)
                            }
                          >
                            {busyDisallow ? "Proposing..." : "Propose Disallow"}
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!loading &&
                list.filter((c) => c.kind === "ERC20" && c.tokenAddress).length ===
                  0 && (
                  <tr className="bg-card">
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                      No ERC-20 currencies added yet.
                    </td>
                  </tr>
                )}

              {loading ? (
                <tr className="bg-card">
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                    Loading currencies...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}