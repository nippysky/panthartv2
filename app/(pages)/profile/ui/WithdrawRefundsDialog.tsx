"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Address,
  Abi,
  Hash,
  defineChain,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  encodeFunctionData,
} from "viem";
import { useActiveAccount } from "thirdweb/react";
import { Loader2, CircleDollarSign, ExternalLink, Copy } from "lucide-react";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";


/* ───────────────── env/chain ───────────────── */
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  "https://rpc.ankr.com/electroneum";

const EXPLORER_BASE = (
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER ||
  "https://blockexplorer.electroneum.com"
).replace(/\/+$/, "");

const MARKETPLACE_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as Address | undefined;

const ELECTRONEUM = defineChain({
  id: 52014,
  name: "Electroneum",
  nativeCurrency: { name: "Electroneum", symbol: "ETN", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "ETN Explorer", url: EXPLORER_BASE } },
});

const CHAIN_HEX_ID = `0x${ELECTRONEUM.id.toString(16)}` as const;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function explorerTxUrl(hash: Hash) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

async function ensureWalletOnChain(provider: Eip1193Provider) {
  try {
    const currentHex = await provider.request({ method: "eth_chainId" });
    if (String(currentHex).toLowerCase() === CHAIN_HEX_ID.toLowerCase()) return;

    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX_ID }],
    });
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e?.code === 4902) {
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

/* ───────────────── tiny UI primitives (no shadcn) ───────────────── */
function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md";
};
function Button({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition " +
    "disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const sizes = size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm";
  const variants =
    variant === "primary"
      ? "bg-foreground text-background hover:opacity-90"
      : variant === "secondary"
      ? "bg-muted text-foreground hover:bg-muted/80"
      : variant === "outline"
      ? "border border-border bg-background hover:bg-muted/40"
      : "bg-transparent hover:bg-muted/40";
  return <button className={cn(base, sizes, variants, className)} {...props} />;
}

function AnchorButton({
  href,
  children,
  variant = "outline",
  size = "sm",
  className,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  variant?: BtnProps["variant"];
  size?: BtnProps["size"];
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition select-none";
  const sizes = size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm";
  const variants =
    variant === "primary"
      ? "bg-foreground text-background hover:opacity-90"
      : variant === "secondary"
      ? "bg-muted text-foreground hover:bg-muted/80"
      : variant === "outline"
      ? "border border-border bg-background hover:bg-muted/40"
      : "bg-transparent hover:bg-muted/40";
  return (
    <a className={cn(base, sizes, variants, className)} href={href} {...rest}>
      {children}
    </a>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  preventClose = true,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  preventClose?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || preventClose) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, preventClose, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-80">
      <div
        className="absolute inset-0 bg-black/50"
        onMouseDown={() => {
          if (!preventClose) onClose();
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div
          className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-lg max-h-[92vh] sm:max-h-[86vh]
                     overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border">
            <div className="text-base font-semibold">{title}</div>
          </div>

          <div className="px-4 py-3 sm:px-6 sm:py-4 overflow-y-auto max-h-[calc(92vh-120px)] sm:max-h-[calc(86vh-120px)]">
            {children}
          </div>

          <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-border bg-background">
            {footer}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ───────────────── types ───────────────── */
type CurrencyOption = {
  id: string; // "native" or Currency.id
  symbol: string;
  decimals: number;
  kind: "NATIVE" | "ERC20";
  tokenAddress?: string | null;
};

type CreditsRow = {
  currency: CurrencyOption;
  rawWei: bigint;
  formatted: string;
  hasCredit: boolean;
};

/* ───────────────── component ───────────────── */
export default function WithdrawRefundsDialog({
  ownerAddress,
  className,
}: {
  ownerAddress: string;
  className?: string;
}) {
  const acct = useActiveAccount();
  const myAddr = (acct?.address ?? "") as Address;

  const [open, setOpen] = React.useState(false);
  const [withdrawing, setWithdrawing] = React.useState(false);
  const [latestTx, setLatestTx] = React.useState<Hash | null>(null);

  const [lastTxByCurrency, setLastTxByCurrency] = React.useState<Record<string, Hash>>(
    {}
  );

  const pub = React.useMemo(
    () => createPublicClient({ chain: ELECTRONEUM, transport: http(RPC_URL) }),
    []
  );

  // ✅ REVAMP endpoint: /api/currencies  -> { currencies }
  const currenciesQuery = useQuery<{ currencies: CurrencyOption[] }>({
    queryKey: ["currencies"],
    enabled: open,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/currencies", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load currencies");
      return (await res.json()) as { currencies: CurrencyOption[] };
    },
  });

  const currencies = React.useMemo<CurrencyOption[]>(() => {
    const fallback: CurrencyOption = {
      id: "native",
      symbol: "ETN",
      decimals: 18,
      kind: "NATIVE",
      tokenAddress: null,
    };

    const list = currenciesQuery.data?.currencies;
    if (!Array.isArray(list) || list.length === 0) return [fallback];

    const hasNative = list.some((c) => c.kind === "NATIVE" || c.id === "native");
    return hasNative ? list : [fallback, ...list];
  }, [currenciesQuery.data]);

  const currencyKey = React.useMemo(() => {
    return currencies.map((c) => c.tokenAddress ?? "native").join("|");
  }, [currencies]);

  const creditsQuery = useQuery<CreditsRow[]>({
    queryKey: ["refund-credits", ownerAddress, currencyKey],
    enabled: open && !!ownerAddress && !!MARKETPLACE_ADDRESS,
    refetchOnWindowFocus: false,
    staleTime: 10_000,
    queryFn: async () => {
      if (!MARKETPLACE_ADDRESS) return [];
      const rows = await Promise.all(
        currencies.map(async (c) => {
          const currencyAddr = (c.tokenAddress || ZERO_ADDR) as Address;

          const raw = (await pub.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_CORE_ABI as Abi,
            functionName: "credits",
            args: [currencyAddr, ownerAddress as Address],
          })) as bigint;

          const formatted = Number(
            formatUnits(raw, c.decimals ?? 18)
          ).toLocaleString(undefined, { maximumFractionDigits: 6 });

          return {
            currency: c,
            rawWei: raw,
            formatted,
            hasCredit: raw > BigInt(0),
          } satisfies CreditsRow;
        })
      );

      return rows;
    },
  });

  const rows = creditsQuery.data ?? [];
  const hasAnyCredit = rows.some((r) => r.hasCredit);

  async function withdrawAll() {
    if (!MARKETPLACE_ADDRESS) return toast.error("Marketplace address not configured.");
    if (!myAddr) return toast.error("Connect your wallet first.");
    if (!hasAnyCredit) return toast("No refunds to withdraw.");

    const provider = (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (!provider?.request) return toast.error("No injected wallet provider found.");

    try {
      setWithdrawing(true);
      await ensureWalletOnChain(provider);

      const wallet = createWalletClient({
        chain: ELECTRONEUM,
        transport: custom(provider),
      });

      const claimables = rows.filter((r) => r.hasCredit);

      for (const r of claimables) {
        const cAddr = (r.currency.tokenAddress || ZERO_ADDR) as Address;

        const data = encodeFunctionData({
          abi: MARKETPLACE_CORE_ABI as Abi,
          functionName: "withdrawCredits",
          args: [cAddr],
        });

        const hash = await wallet.sendTransaction({
          chain: ELECTRONEUM,
          to: MARKETPLACE_ADDRESS,
          data,
          account: myAddr,
        });

        setLatestTx(hash);
        setLastTxByCurrency((prev) => ({
          ...prev,
          [r.currency.tokenAddress ?? "native"]: hash,
        }));

        toast.success(`Withdrawing ${r.currency.symbol}…`);
        await pub.waitForTransactionReceipt({ hash });
      }

      toast.success("All available refunds withdrawn.");
      await creditsQuery.refetch();
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      console.error("withdrawCredits error", err);
      toast.error(e?.shortMessage || e?.message || "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className={cn("rounded-lg", className)}
        onClick={() => {
          if (!MARKETPLACE_ADDRESS) {
            toast.error("Marketplace address not configured.");
            return;
          }
          setOpen(true);
        }}
      >
        <CircleDollarSign className="mr-2 h-4 w-4" />
        Refunds
      </Button>

      <Modal
        open={open}
        title="Withdraw Refunds"
        onClose={() => setOpen(false)}
        preventClose={true}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              onClick={withdrawAll}
              disabled={withdrawing || creditsQuery.isFetching || !hasAnyCredit}
            >
              {withdrawing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Withdrawing…
                </>
              ) : (
                "Withdraw All"
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
            <div className="text-sm text-muted-foreground">Your wallet</div>
            <div className="text-xs break-all">{ownerAddress}</div>

            <div className="text-sm text-muted-foreground mt-3">Marketplace</div>
            <div className="text-xs break-all">{MARKETPLACE_ADDRESS ?? "—"}</div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Available refunds</div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => creditsQuery.refetch()}
                disabled={creditsQuery.isFetching || withdrawing}
              >
                {creditsQuery.isFetching ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Refresh
                  </>
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>

            {currenciesQuery.isFetching && (
              <div className="text-sm text-muted-foreground mb-2">
                Loading currencies…
              </div>
            )}
            {currenciesQuery.isError && (
              <div className="text-sm text-muted-foreground mb-2">
                Other currencies unavailable right now — showing ETN only.
              </div>
            )}

            {creditsQuery.isPending ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <>
                <ul className="space-y-2">
                  {rows.map((r) => {
                    const key = r.currency.tokenAddress ?? "native";
                    const lastTx = lastTxByCurrency[key];

                    return (
                      <li
                        key={`${r.currency.id}-${key}`}
                        className="rounded-lg border border-border bg-background/60 p-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm">
                            <span className="font-semibold">{r.currency.symbol}</span>{" "}
                            <span className="text-muted-foreground">({r.currency.kind})</span>
                          </div>
                          <div className="text-sm font-semibold">
                            {creditsQuery.isFetching ? "…" : `${r.formatted} ${r.currency.symbol}`}
                          </div>
                        </div>

                        {lastTx && (
                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                navigator.clipboard
                                  .writeText(lastTx)
                                  .then(() => toast.success("Hash copied"))
                              }
                            >
                              <Copy className="mr-1 h-3.5 w-3.5" />
                              Copy Tx
                            </Button>

                            <AnchorButton href={explorerTxUrl(lastTx)} target="_blank" rel="noreferrer">
                              Open in Explorer
                              <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </AnchorButton>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {!hasAnyCredit && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No refunds available right now.
                  </p>
                )}
              </>
            )}
          </div>

          {latestTx && (
            <div className="rounded-xl border border-border bg-muted/10 p-3 sm:p-4 space-y-2">
              <div className="text-sm text-muted-foreground">Latest transaction</div>
              <div className="rounded-lg border border-border bg-background/60 p-2">
                <a
                  href={explorerTxUrl(latestTx)}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs font-mono break-all leading-5"
                  title={latestTx}
                >
                  {latestTx}
                </a>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Refunds are credited when your bid is outbid or when a payout could not be delivered.
            Your wallet will be prompted on <b>{ELECTRONEUM.name}</b>.
          </p>
        </div>
      </Modal>
    </>
  );
}
