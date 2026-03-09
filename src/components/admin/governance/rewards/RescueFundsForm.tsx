/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { ethers } from "ethers";
import { toast } from "sonner";

import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { REWARD_DISTRIBUTOR_ABI } from "@/src/lib/abis/marketplace-core/rewardDistributorABI";

type Props = { allowedWallets: string[] };

const DISTRIBUTOR = process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || "";
const MULTISIG = process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS || "";
const ZERO = "0x0000000000000000000000000000000000000000";

type ActiveCurrency = {
  id: string;
  symbol: string;
  decimals: number;
  kind: string;
  tokenAddress: string | null;
};

type CurrencyRow = {
  symbol: string;
  decimals: number;
  token: string;
  kind: "NATIVE" | "ERC20";
};

type BalRow = CurrencyRow & {
  raw: bigint;
  formatted: string;
};

export default function RescueFundsForm({ allowedWallets }: Props) {
  const [currencies, setCurrencies] = React.useState<CurrencyRow[]>([]);
  const [balances, setBalances] = React.useState<BalRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [token, setToken] = React.useState<string>(ZERO);
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("0.0");
  const [selected, setSelected] = React.useState<CurrencyRow | null>(null);
  const [selectedBalance, setSelectedBalance] = React.useState<bigint>(BigInt(0));

  const erc20Iface = React.useMemo(
    () =>
      new ethers.Interface([
        "function balanceOf(address) view returns (uint256)",
      ]),
    []
  );

  async function fetchActiveCurrencies(): Promise<CurrencyRow[]> {
    const res = await fetch("/api/currencies/active", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load currencies");

    const json = await res.json();
    const items = (json?.items as ActiveCurrency[]) || [];

    return items.map((item) => ({
      symbol: item.symbol || (item.tokenAddress ? "TOKEN" : "ETN"),
      decimals: item.decimals ?? 18,
      token: item.tokenAddress ? ethers.getAddress(item.tokenAddress) : ZERO,
      kind: item.tokenAddress ? "ERC20" : "NATIVE",
    }));
  }

  const refresh = React.useCallback(async () => {
    setLoading(true);

    try {
      const rows = await fetchActiveCurrencies();
      setCurrencies(rows);

      const { signer } = await getBrowserSigner();
      const provider = signer.provider!;

      const out: BalRow[] = [];

      for (const currency of rows) {
        try {
          if (currency.kind === "NATIVE") {
            const raw = await provider.getBalance(DISTRIBUTOR);
            out.push({
              ...currency,
              raw,
              formatted: ethers.formatUnits(raw, currency.decimals),
            });
          } else {
            const data = erc20Iface.encodeFunctionData("balanceOf", [DISTRIBUTOR]);
            const res = await provider.call({ to: currency.token, data });
            const raw = erc20Iface.decodeFunctionResult("balanceOf", res)[0] as bigint;

            out.push({
              ...currency,
              raw,
              formatted: ethers.formatUnits(raw, currency.decimals),
            });
          }
        } catch {
          out.push({
            ...currency,
            raw: BigInt(0),
            formatted: "0",
          });
        }
      }

      out.sort((a, b) => {
        const az = a.raw === BigInt(0) ? 1 : 0;
        const bz = b.raw === BigInt(0) ? 1 : 0;
        if (az !== bz) return az - bz;
        if (a.token === ZERO && b.token !== ZERO) return -1;
        if (b.token === ZERO && a.token !== ZERO) return 1;
        return a.symbol.localeCompare(b.symbol);
      });

      const bals = out;
      setBalances(bals);

      const match =
        rows.find((r) => r.token.toLowerCase() === token.toLowerCase()) ||
        rows[0] ||
        null;

      if (match) {
        setSelected(match);
        setToken(match.token);

        const bal = bals.find(
          (b) => b.token.toLowerCase() === match.token.toLowerCase()
        );
        setSelectedBalance(bal?.raw ?? BigInt(0));
      } else {
        setSelected(null);
        setSelectedBalance(BigInt(0));
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to refresh balances.");
    } finally {
      setLoading(false);
    }
  }, [token, erc20Iface]);

  React.useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  React.useEffect(() => {
    const row =
      currencies.find((r) => r.token.toLowerCase() === token.toLowerCase()) || null;
    setSelected(row);

    const bal = balances.find((b) => b.token.toLowerCase() === token.toLowerCase());
    setSelectedBalance(bal?.raw ?? BigInt(0));
  }, [token, currencies, balances]);

  function setMax() {
    if (!selected) return;
    setAmount(ethers.formatUnits(selectedBalance, selected.decimals));
  }

  async function parseAmount(): Promise<bigint> {
    const decimals = selected?.decimals ?? 18;
    return ethers.parseUnits(amount || "0", decimals);
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!selected) throw new Error("Select a currency.");
      if (!ethers.isAddress(to)) throw new Error("Enter a valid destination address.");

      const value = await parseAmount();

      if (value <= BigInt(0)) throw new Error("Enter a positive amount.");
      if (value > selectedBalance) throw new Error("Amount exceeds contract balance.");

      setBusy(true);

      const { signer, chainId } = await getBrowserSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
        throw new Error("This wallet is not in the allowed admin list.");
      }

      if (chainId !== 52014) {
        throw new Error("Wrong network. Switch to Chain ID 52014.");
      }

      const distributorIface = new ethers.Interface(REWARD_DISTRIBUTOR_ABI as any);
      const data = distributorIface.encodeFunctionData("rescue", [
        selected.token,
        to,
        value,
      ]);

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);

      const tx = await multisig.submitAndConfirm(
        ZERO,
        DISTRIBUTOR,
        BigInt(0),
        data
      );

      toast.message("Proposing rescue...");
      await tx.wait();
      toast.success("Rescue proposed successfully.");
      setAmount("0.0");
      refresh().catch(() => {});
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">Current Balances</div>
            <div className="mt-1 text-xs leading-5 text-muted">
              Select a currency below to rescue native or ERC-20 balances.
            </div>
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((balance) => {
            const isSelected = balance.token.toLowerCase() === token.toLowerCase();

            return (
              <button
                key={`${balance.token}-${balance.symbol}`}
                type="button"
                onClick={() => setToken(balance.token)}
                className={[
                  "rounded-[18px] border p-4 text-left transition-colors",
                  isSelected
                    ? "border-foreground/25 bg-card"
                    : "border-border bg-card hover:bg-background",
                ].join(" ")}
              >
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                  Token
                </div>
                <div className="mt-1 font-mono text-xs break-all text-foreground">
                  {balance.token === ZERO ? "ETN (native)" : balance.token}
                </div>

                <div className="mt-3 text-sm">
                  <span className="font-semibold text-foreground">{balance.formatted}</span>{" "}
                  <span className="text-muted">{balance.symbol}</span>
                </div>
              </button>
            );
          })}

          {!loading && balances.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-border bg-card p-4 text-sm text-muted">
              No active currencies found.
            </div>
          ) : null}
        </div>
      </section>

      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 min-w-0">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Selected Currency</span>
            <div className="mt-2 rounded-[18px] border border-border bg-background p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Symbol • Decimals
              </div>
              <div className="mt-1 text-sm text-foreground">
                <span className="font-medium">{selected?.symbol ?? "—"}</span>{" "}
                <span className="text-muted">• {selected?.decimals ?? 18}</span>
              </div>

              <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted">
                Token
              </div>
              <div className="mt-1 font-mono text-xs break-all text-foreground">
                {selected ? (selected.token === ZERO ? "ETN (native)" : selected.token) : "—"}
              </div>

              <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted">
                Balance
              </div>
              <div className="mt-1 text-sm text-foreground">
                {selected
                  ? `${ethers.formatUnits(selectedBalance, selected.decimals)} ${selected.symbol}`
                  : "—"}
              </div>
            </div>
          </label>
        </div>

        <div className="space-y-2 min-w-0">
          <label className="block">
            <span className="text-sm font-medium text-foreground">To</span>
            <input
              className="mt-2 h-11 w-full rounded-[18px] border border-border bg-background px-4 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="0x...recipient"
            />
          </label>
        </div>

        <div className="space-y-2 min-w-0">
          <label className="block">
            <span className="flex items-center justify-between text-sm font-medium text-foreground">
              <span>Amount</span>
              <button
                type="button"
                className="text-xs underline underline-offset-4 text-muted hover:text-foreground"
                onClick={setMax}
                disabled={!selected}
                title="Use full available balance"
              >
                MAX
              </button>
            </span>

            <input
              className="mt-2 h-11 w-full rounded-[18px] border border-border bg-background px-4 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.0"
            />
          </label>

          <div className="text-xs leading-5 text-muted">
            {selected
              ? `Max: ${ethers.formatUnits(selectedBalance, selected.decimals)} ${selected.symbol}`
              : "Select a currency to enable MAX"}
          </div>
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Submitting..." : "Propose via Multisig"}
          </button>
        </div>
      </form>

      <div className="text-xs leading-5 text-muted">
        Admin-only sweep. Transfers funds from{" "}
        <span className="font-mono break-all">{DISTRIBUTOR}</span> to the
        destination using the distributor <code>rescue()</code> flow. The token
        and amount are validated against current on-chain balance.
      </div>
    </div>
  );
}