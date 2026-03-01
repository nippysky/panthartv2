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
  createWalletClient,
  custom,
  encodeFunctionData,
  formatUnits,
} from "viem";
import { useActiveAccount } from "thirdweb/react";
import { Loader2, Gift, ExternalLink, Copy } from "lucide-react";
import { REWARD_DISTRIBUTOR_ABI } from "@/src/lib/abis/marketplace-core/rewardDistributorABI";


/* ───────────────── env/chain ───────────────── */
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  "https://rpc.ankr.com/electroneum";

const EXPLORER_BASE = (
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER ||
  "https://blockexplorer.electroneum.com"
).replace(/\/+$/, "");

const REWARDS_ADDRESS = process.env
  .NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS as Address | undefined;

const ELECTRONEUM = defineChain({
  id: 52014,
  name: "Electroneum",
  nativeCurrency: { name: "Electroneum", symbol: "ETN", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Explorer", url: EXPLORER_BASE } },
});

const CHAIN_HEX_ID = `0x${ELECTRONEUM.id.toString(16)}` as const;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function expTx(hash: Hash) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

async function ensureWalletOnChain(provider: Eip1193Provider) {
  try {
    const current = await provider.request({ method: "eth_chainId" });
    if (String(current).toLowerCase() === CHAIN_HEX_ID.toLowerCase()) return;

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
type MeItem = {
  currency: {
    id: string;
    symbol: string;
    decimals: number;
    kind: "NATIVE" | "ERC20";
    tokenAddress: string | null;
  };
  comrades: number;
  accPerToken1e27: string;
  lastAccPerToken1e27: string;
  claimedWei: string;
  pendingWei: string;
  totalWei: string;
};

/* ───────────────── component ───────────────── */
export default function RewardsClaimDialog({
  ownerAddress,
  className,
}: {
  ownerAddress: string;
  className?: string;
}) {
  const acct = useActiveAccount();
  const myAddr = (acct?.address ?? "") as Address;

  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [lastTx, setLastTx] = React.useState<Hash | null>(null);

  const q = useQuery<{ items: MeItem[] }>({
    queryKey: ["rewards-me", ownerAddress],
    enabled: open && !!ownerAddress,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
    queryFn: async () => {
      const res = await fetch("/api/rewards/me", {
        headers: { "x-user-address": ownerAddress },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load rewards");
      return (await res.json()) as { items: MeItem[] };
    },
  });

  const items = React.useMemo(() => q.data?.items ?? [], [q.data?.items]);

  const totalPending = React.useMemo(() => {
    return items.reduce((acc, it) => {
      const v = BigInt(String(it.pendingWei || "0"));
      return acc + v;
    }, BigInt(0));
  }, [items]);

  async function claimAll() {
    if (!REWARDS_ADDRESS) return toast.error("RewardsDistributor not configured.");
    if (!myAddr) return toast.error("Connect your wallet first.");

    const provider = (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (!provider?.request) return toast.error("No injected wallet provider found.");

    const active = items.filter((i) => BigInt(String(i.pendingWei || "0")) > BigInt(0));
    if (!active.length) return toast("Nothing to claim.");

    try {
      setSubmitting(true);
      await ensureWalletOnChain(provider);

      const wallet = createWalletClient({
        chain: ELECTRONEUM,
        transport: custom(provider),
      });

      for (const it of active) {
        const currencyParam =
          it.currency.kind === "ERC20" && it.currency.tokenAddress
            ? it.currency.tokenAddress
            : "ETN";

        const prep = await fetch(
          `/api/rewards/prepare-claim?account=${ownerAddress}&currency=${encodeURIComponent(
            currencyParam
          )}`,
          { cache: "no-store" }
        );

        if (!prep.ok) {
          const t = await prep.text().catch(() => "");
          throw new Error(`Prepare failed: ${t || prep.status}`);
        }

        const signed = (await prep.json()) as {
          currency: { tokenAddress: string | null };
          total: string;
          deadline: number;
          signature: `0x${string}`;
        };

        const tokenAddr = (signed.currency?.tokenAddress || ZERO) as Address;

        const data = encodeFunctionData({
          abi: REWARD_DISTRIBUTOR_ABI as Abi,
          functionName: "claim",
          args: [tokenAddr, BigInt(String(signed.total)), BigInt(String(signed.deadline)), signed.signature],
        });

        const tx = await wallet.sendTransaction({
          to: REWARDS_ADDRESS,
          data,
          account: myAddr,
        });

        setLastTx(tx);
        toast.success(`Claiming ${it.currency.symbol}…`);
      }

      // Soft refresh a few times so UI catches up quickly
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        await q.refetch();
        const stillPending = (q.data?.items ?? []).some(
          (x) => BigInt(String(x.pendingWei || "0")) > BigInt(0)
        );
        if (!stillPending) break;
      }

      toast.success("Claims submitted.");
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      console.error(err);
      toast.error(e?.shortMessage || e?.message || "Claim failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className={cn("rounded-lg", className)}
        onClick={() => {
          if (!REWARDS_ADDRESS) {
            toast.error("RewardsDistributor not configured.");
            return;
          }
          setOpen(true);
        }}
      >
        <Gift className="mr-2 h-4 w-4" />
        Rewards
      </Button>

      <Modal
        open={open}
        title="Claim Rewards"
        onClose={() => setOpen(false)}
        preventClose={true}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              onClick={claimAll}
              disabled={submitting || q.isFetching || totalPending === BigInt(0)}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming…
                </>
              ) : (
                "Claim All"
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
            <div className="text-sm text-muted-foreground">Wallet</div>
            <div className="text-xs break-all">{ownerAddress}</div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Accrued (to date)</div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => q.refetch()}
                disabled={q.isFetching || submitting}
              >
                {q.isFetching ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Refresh
                  </>
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>

            {q.isPending ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active currencies.</div>
            ) : (
              <ul className="space-y-2">
                {items.map((it) => {
                  const total = Number(
                    formatUnits(BigInt(String(it.totalWei || "0")), it.currency.decimals)
                  ).toLocaleString(undefined, { maximumFractionDigits: 6 });

                  const pending = Number(
                    formatUnits(BigInt(String(it.pendingWei || "0")), it.currency.decimals)
                  ).toLocaleString(undefined, { maximumFractionDigits: 6 });

                  return (
                    <li
                      key={it.currency.id}
                      className="rounded-lg border border-border bg-background/60 p-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm">
                          <span className="font-semibold">{it.currency.symbol}</span>{" "}
                          <span className="text-muted-foreground">({it.currency.kind})</span>
                        </div>
                        <div className="text-right text-sm">
                          <div>
                            <b>{total}</b> {it.currency.symbol}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Pending now: {pending}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {lastTx && (
            <div className="rounded-xl border border-border bg-muted/10 p-3 sm:p-4 space-y-2">
              <div className="text-sm text-muted-foreground">Latest transaction</div>
              <div className="rounded-lg border border-border bg-background/60 p-2">
                <a
                  href={expTx(lastTx)}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs font-mono break-all leading-5"
                  title={lastTx}
                >
                  {lastTx}
                </a>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(lastTx)
                        .then(() => toast.success("Hash copied"))
                    }
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                  </Button>

                  <AnchorButton href={expTx(lastTx)} target="_blank" rel="noreferrer">
                    Open in Explorer <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </AnchorButton>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Rewards = <b>claimed so far + pending now</b>. After a successful claim, pending becomes
            0 until new rewards accrue. Your wallet will be prompted on{" "}
            <b>{ELECTRONEUM.name}</b>.
          </p>
        </div>
      </Modal>
    </>
  );
}
