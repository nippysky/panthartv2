/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Address,
  Hash,
  Abi,
  defineChain,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  encodeFunctionData,
  formatEther,
} from "viem";
import { useUnifiedAccount } from "@/src/lib/useUnifiedAccount";

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  "https://rpc.ankr.com/electroneum";

const EXPLORER_BASE = (process.env.NEXT_PUBLIC_BLOCK_EXPLORER ||
  "https://blockexplorer.electroneum.com"
).replace(/\/+$/, "");

const ELECTRONEUM = defineChain({
  id: 52014,
  name: "Electroneum",
  nativeCurrency: { name: "Electroneum", symbol: "ETN", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "ETN Explorer", url: EXPLORER_BASE } },
});

const CHAIN_HEX_ID = `0x${ELECTRONEUM.id.toString(16)}` as const;

function explorerTxUrl(hash: Hash) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

async function ensureWalletOnChain(provider: any) {
  if (!provider?.request) return;
  try {
    const currentHex = await provider.request({ method: "eth_chainId" });
    if (String(currentHex).toLowerCase() === CHAIN_HEX_ID.toLowerCase()) return;

    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX_ID }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_HEX_ID,
            chainName: ELECTRONEUM.name,
            nativeCurrency: ELECTRONEUM.nativeCurrency,
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [EXPLORER_BASE],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

const WITHDRAW_ABI = [
  {
    type: "function",
    name: "withdrawProceeds",
    stateMutability: "nonpayable",
    inputs: [{ name: "recipient", type: "address" }],
    outputs: [],
  },
] as const satisfies Abi;

export default function WithdrawProceedsDialog({
  contract,
  collectionName,
  className,
}: {
  contract: string;
  collectionName: string;
  className?: string;
}) {
  const acct = useUnifiedAccount(); // ✅ unified
  const myAddr = (acct.address ?? "") as Address;

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [balanceWei, setBalanceWei] = React.useState<bigint>(BigInt(0));
  const [lastTx, setLastTx] = React.useState<Hash | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const contractAddr = React.useMemo(() => contract as Address, [contract]);

  const pub = React.useMemo(
    () => createPublicClient({ chain: ELECTRONEUM, transport: http(RPC_URL) }),
    []
  );

  async function refreshBalance() {
    setLoading(true);
    try {
      const bal = await pub.getBalance({ address: contractAddr });
      setBalanceWei(bal);
    } catch (err) {
      setMsg("Could not load contract balance");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (open) refreshBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onWithdraw() {
    if (!acct.address) {
      setMsg("Connect your wallet first.");
      return;
    }
    if (balanceWei <= BigInt(0)) {
      setMsg("Nothing to withdraw — balance is 0.");
      return;
    }

    // Works for Decent Wallet (injected) and normal injected wallets (MetaMask/Rabby)
    const provider = (globalThis as any).ethereum;
    if (!provider?.request) {
      setMsg("No injected wallet provider found.");
      return;
    }

    try {
      setMsg(null);
      setSending(true);

      await ensureWalletOnChain(provider);

      const wal = createWalletClient({
        chain: ELECTRONEUM,
        transport: custom(provider),
      });

      const data = encodeFunctionData({
        abi: WITHDRAW_ABI,
        functionName: "withdrawProceeds",
        args: [myAddr],
      });

      const hash = await wal.sendTransaction({
        chain: ELECTRONEUM,
        to: contractAddr,
        data,
        account: myAddr,
      });

      setLastTx(hash);
      setMsg("Withdrawal submitted. Waiting for confirmation…");
      await pub.waitForTransactionReceipt({ hash });

      setMsg("Proceeds withdrawn successfully!");
      await refreshBalance();
    } catch (err: any) {
      setMsg(err?.shortMessage || err?.message || "Withdrawal failed");
    } finally {
      setSending(false);
    }
  }

  const human = React.useMemo(() => {
    try {
      return Number(formatEther(balanceWei)).toLocaleString(undefined, {
        maximumFractionDigits: 6,
      });
    } catch {
      return "0";
    }
  }, [balanceWei]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cx(
          "inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground",
          "hover:bg-background/60 active:scale-[0.99]",
          className
        )}
      >
        Withdraw
      </button>

      {open ? (
        <div className="fixed inset-0" style={{ zIndex: 220 }}>
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <div className="text-sm font-semibold">Withdraw Proceeds</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Withdraw mint proceeds from this collection contract.
              </div>
            </div>

            <div className="p-5 space-y-4">
              {msg ? (
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
                  {msg}
                </div>
              ) : null}

              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="text-xs text-muted-foreground">Collection</div>
                <div className="mt-1 font-semibold">{collectionName}</div>
                <div className="mt-1 text-xs text-muted-foreground break-all">
                  {contractAddr}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      Contract Balance
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {loading ? "…" : `${human} ETN`}
                    </div>
                  </div>
                  <button
                    onClick={refreshBalance}
                    disabled={loading || sending}
                    className="h-9 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-background/60 disabled:opacity-50"
                  >
                    {loading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>

              {lastTx ? (
                <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Last transaction
                  </div>
                  <a
                    href={explorerTxUrl(lastTx)}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs font-mono break-all underline underline-offset-2 opacity-90"
                  >
                    {lastTx}
                  </a>
                </div>
              ) : null}
            </div>

            <div className="px-5 py-4 border-t border-border bg-card/90 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-card"
                >
                  Close
                </button>
                <button
                  onClick={onWithdraw}
                  disabled={sending || loading || balanceWei <= BigInt(0)}
                  className={cx(
                    "h-10 rounded-full px-5 text-sm font-semibold",
                    "bg-foreground text-background hover:opacity-95 active:opacity-90",
                    (sending || loading || balanceWei <= BigInt(0)) &&
                      "opacity-50 cursor-not-allowed"
                  )}
                >
                  {sending ? "Withdrawing…" : "Withdraw"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
