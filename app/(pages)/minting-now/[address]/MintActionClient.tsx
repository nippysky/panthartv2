/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/(pages)/minting-now/[address]/MintActionClient.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ethers } from "ethers";
import { useActiveAccount } from "thirdweb/react";
import { CheckCircle2, X } from "lucide-react";
import { createPortal } from "react-dom";

import { Button } from "@/src/ui/Button";
import { Progress } from "@/src/ui/Progress";

import type { MintDetails } from "@/src/lib/server/mint-details";
import { ERC721_DROP_ABI } from "@/src/lib/abis/ERC721DropABI";
import {
  ensureChain,
  getBrowserSigner,
  getRequiredChainId,
} from "@/src/lib/chain/client";
import { ensureSufficientFunds } from "@/src/lib/chain/funds";
import { getFriendlyTxError } from "@/src/lib/chain/error-friendly";
import { formatEtnFromWei, formatNumber } from "@/src/lib/utils";

/* ---------- tiny ui helpers ---------- */

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function Modal({
  open,
  title,
  description,
  children,
  onClose,
  canClose = true,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  canClose?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !canClose) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, canClose, onClose]);

  if (!open || !mounted) return null;

  const modalUi = (
    <div className="fixed inset-0 z-9999" aria-hidden={false}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => {
          if (canClose) onClose();
        }}
      />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div className="min-w-0">
              <div className="text-base font-semibold">{title}</div>
              {description ? (
                <div className="mt-1 text-sm text-muted">{description}</div>
              ) : null}
            </div>

            {canClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background/60 hover:bg-background/80"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="max-h-[70vh] overflow-auto p-5">{children}</div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalUi, document.body);
}

function QtyInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <input
      value={String(value)}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      onChange={(e) => {
        const n = Math.floor(Number(e.target.value || 1));
        const clamped = Math.max(
          min,
          Math.min(max, Number.isFinite(n) ? n : min)
        );
        onChange(clamped);
      }}
      className={cx(
        "h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none",
        "focus:ring-2 focus:ring-foreground/10"
      )}
    />
  );
}

/* ---------- provider ---------- */

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "";

async function getReadProvider(): Promise<ethers.AbstractProvider | null> {
  try {
    if (RPC_URL) return new ethers.JsonRpcProvider(RPC_URL);
  } catch {}
  try {
    const eth = (globalThis as any)?.ethereum;
    if (eth) return new ethers.BrowserProvider(eth);
  } catch {}
  return null;
}

/* ---------- component ---------- */

type Props = { address: string; details: MintDetails };

export default function MintActionClient({ address, details }: Props) {
  const twAccount = useActiveAccount();
  const connected = twAccount?.address ?? null;

  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const supply = details.supply;
  const publicStartMs = new Date(details.publicSale.startISO).getTime();
  const presaleStartMs = details.presale
    ? new Date(details.presale.startISO).getTime()
    : Number.POSITIVE_INFINITY;
  const presaleEndMs = details.presale
    ? new Date(details.presale.endISO).getTime()
    : Number.NEGATIVE_INFINITY;

  const timePresaleLive =
    !!details.presale && nowMs >= presaleStartMs && nowMs < presaleEndMs;
  const timePublicLive = nowMs >= publicStartMs;

  const [liveMinted, setLiveMinted] = React.useState<number>(details.minted);
  const [liveMintedPct, setLiveMintedPct] = React.useState<number>(
    details.mintedPct
  );

  const supplyLeft = Math.max(0, supply - liveMinted);
  const liveSoldOut = liveMinted >= supply;

  const [presaleMax, setPresaleMax] = React.useState<number>(
    details.presale?.maxSupply ?? 0
  );
  const [presaleMinted, setPresaleMinted] = React.useState<number>(0);
  const presaleLeft = Math.max(0, presaleMax - presaleMinted);

  const presaleLive = timePresaleLive && presaleLeft > 0 && !timePublicLive;
  const publicLive = timePublicLive && !liveSoldOut;

  const priceWeiDisplay = presaleLive
    ? details.presale?.priceEtnWei ?? details.publicSale.priceEtnWei
    : details.publicSale.priceEtnWei;

  const price = formatEtnFromWei(priceWeiDisplay, 18, 4);

  const maxPerTx = Number(details.publicSale.maxPerTx);
  const maxPerWallet = Number(details.publicSale.maxPerWallet);

  const [walletMintedCount, setWalletMintedCount] = React.useState<number>(0);
  const walletRemaining = Math.max(0, maxPerWallet - walletMintedCount);

  const [eligible, setEligible] = React.useState(true);
  const [eligibilityLoaded, setEligibilityLoaded] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    async function check() {
      try {
        if (!connected) {
          setEligible(!timePresaleLive);
          setEligibilityLoaded(true);
          return;
        }

        const res = await fetch(
          `/api/minting-now/${address}/eligibility?wallet=${connected}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!active) return;

        setEligible(!!json.eligible);
        setEligibilityLoaded(true);
      } catch {
        if (!active) return;
        setEligible(!timePresaleLive);
        setEligibilityLoaded(true);
      }
    }

    check();
    const id = setInterval(check, 15_000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [address, connected, timePresaleLive]);

  const readOnchainProgress = React.useCallback(async () => {
    try {
      const provider = await getReadProvider();
      if (!provider) return false;

      const c = new ethers.Contract(address, ERC721_DROP_ABI as any, provider);

      try {
        const tm: bigint = await c.totalMinted();
        const minted = Number(tm);
        setLiveMinted(minted);
        setLiveMintedPct(
          supply > 0 ? Math.min(100, Math.round((minted / supply) * 100)) : 0
        );
      } catch {}

      try {
        const ps = await c.presale();
        setPresaleMax(Number(ps?.maxSupply ?? 0));
      } catch {}

      try {
        const pm: bigint = await c.presaleMinted();
        setPresaleMinted(Number(pm));
      } catch {}

      return true;
    } catch {
      return false;
    }
  }, [address, supply]);

  const readWalletMinted = React.useCallback(async () => {
    try {
      if (!connected) return;
      const provider = await getReadProvider();
      if (!provider) return;

      const c = new ethers.Contract(address, ERC721_DROP_ABI as any, provider);
      const mw: bigint = await c.mintedPerWallet(connected);
      setWalletMintedCount(Number(mw));
    } catch {}
  }, [address, connected]);

  async function refreshFallbackFromApi() {
    try {
      const r = await fetch(`/api/minting-now/${address}`, {
        cache: "no-store",
      });
      if (!r.ok) return;

      const j = await r.json();
      if (typeof j?.minted === "number" && typeof j?.supply === "number") {
        setLiveMinted(j.minted);
        setLiveMintedPct(
          j.supply > 0 ? Math.min(100, Math.round((j.minted / j.supply) * 100)) : 0
        );
      }
    } catch {}
  }

  React.useEffect(() => {
    let t: any;

    const fast = publicLive || timePresaleLive;

    const tick = async () => {
      const ok = await readOnchainProgress();
      if (!ok) await refreshFallbackFromApi();
      await readWalletMinted();
    };

    tick();
    t = setInterval(tick, fast ? 7_500 : 30_000);

    return () => clearInterval(t);
  }, [publicLive, timePresaleLive, readOnchainProgress, readWalletMinted]);

  React.useEffect(() => {
    const vis = () => {
      if (document.visibilityState === "visible") {
        readOnchainProgress();
        readWalletMinted();
      }
    };

    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [readOnchainProgress, readWalletMinted]);

  const baseCanMint =
    (publicLive || (timePresaleLive && presaleLeft > 0)) &&
    eligible &&
    !liveSoldOut;

  const canMint = baseCanMint && !!connected;

  const saleBadge = liveSoldOut
    ? "Sold Out"
    : presaleLive
    ? "Presale Live"
    : publicLive
    ? "Public Live"
    : "Upcoming";

  const buttonLabel = liveSoldOut
    ? "Sold Out"
    : !connected
    ? "Mint"
    : baseCanMint
    ? "Mint"
    : !eligibilityLoaded
    ? "Checking…"
    : publicLive || !timePresaleLive
    ? "Mint"
    : "Not Whitelisted";

  const remainingNow = presaleLive
    ? Math.max(0, presaleLeft)
    : Math.max(0, supplyLeft);

  function validateQty(n: number) {
    if (!Number.isFinite(n) || n < 1) return "Enter a valid amount";
    if (n > maxPerTx) return `Max per transaction is ${maxPerTx}`;
    if (n > remainingNow) return `Only ${remainingNow} left`;
    return null;
  }

  async function fetchPresaleProof(wallet: string): Promise<string[]> {
    try {
      const r = await fetch(
        `/api/minting-now/${address}/eligibility?wallet=${wallet}&includeProof=1`,
        { cache: "no-store" }
      );

      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j?.proof)) return j.proof as string[];
      }
    } catch {}

    return [];
  }

  const [openMint, setOpenMint] = React.useState(false);
  const [qty, setQty] = React.useState(1);
  const [minting, setMinting] = React.useState(false);
  const [lastError, setLastError] = React.useState<string | null>(null);

  const [showSuccess, setShowSuccess] = React.useState(false);
  const [mintedQty, setMintedQty] = React.useState(0);

  async function handleMintConfirm() {
    setLastError(null);

    const qtyErr = validateQty(qty);
    if (qtyErr) {
      setLastError(qtyErr);
      toast.error(qtyErr);
      return;
    }

    try {
      const required = getRequiredChainId();
      await ensureChain(required);

      const signer = await getBrowserSigner();
      const from = await signer.getAddress();

      const contract = new ethers.Contract(address, ERC721_DROP_ABI as any, signer);

      const isPresalePhase = timePresaleLive && !publicLive;

      const [ps, pub] = await Promise.all([
        contract.presale(),
        contract.publicSale(),
      ]);

      const priceWeiOnchain = isPresalePhase ? ps.price : pub.price;
      const priceWeiBig = BigInt(priceWeiOnchain.toString());
      const value = priceWeiBig * BigInt(qty);

      let method: "mint" | "presaleMint" = "mint";
      let args: any[] = [qty];

      if (isPresalePhase) {
        method = "presaleMint";
        const proof = await fetchPresaleProof(from);
        if (!proof.length) {
          const msg = "Not whitelisted or proof unavailable yet.";
          setLastError(msg);
          toast.error(msg);
          return;
        }
        args = [qty, proof];
      }

      const overrides: any = { value };

      try {
        const pop = await contract[method].populateTransaction(...args, overrides);
        const txReq = { to: contract.target as string, data: pop.data!, value };
        const provider = signer.provider!;
        const bal = await ensureSufficientFunds(provider, from, txReq);

        if (!bal.ok) {
          const havePretty = formatEtnFromWei(bal.have.toString(), 18, 4);
          const needPretty = formatEtnFromWei(bal.need.toString(), 18, 4);
          const msg = `Not enough balance. You have ${havePretty} ETN but need about ${needPretty} ETN (incl. gas).`;
          setLastError(msg);
          toast.error(msg);
          return;
        }
      } catch {}

      setMinting(true);

      try {
        await contract[method].staticCall(...args, overrides);
      } catch (e: any) {
        const friendly = getFriendlyTxError(e, {
          method,
          abi: ERC721_DROP_ABI as any,
          fallback:
            "The transaction was rejected by the contract. Check sale window, limits, and whitelist.",
        });
        setLastError(friendly);
        setMinting(false);
        toast.error(friendly);
        return;
      }

      let gasLimit: bigint | undefined;
      try {
        const est: bigint = await contract[method].estimateGas(...args, overrides);
        gasLimit = (est * BigInt(120)) / BigInt(100);
      } catch {}

      const sendOverrides = {
        ...overrides,
        ...(gasLimit ? { gasLimit } : {}),
      };

      const tx = await contract[method](...args, sendOverrides);
      toast.message("Transaction submitted", {
        description: "Waiting for confirmation…",
      });

      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        const msg = "Mint failed on-chain (no success status).";
        setLastError(msg);
        setMinting(false);
        toast.error(msg);
        return;
      }

      // optimistic UI update
      setLiveMinted((prev) => {
        const next = prev + qty;
        setLiveMintedPct(
          supply > 0 ? Math.min(100, Math.round((next / supply) * 100)) : 0
        );
        return next;
      });

      if (isPresalePhase) {
        setPresaleMinted((pm) => pm + qty);
      }

      // optional index notify
      try {
        const iface = new ethers.Interface(ERC721_DROP_ABI as any);
        const mintedEvents: { tokenId: string; uri: string }[] = [];

        for (const log of receipt.logs ?? []) {
          if (log.address.toLowerCase() !== address.toLowerCase()) continue;
          try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === "DropMinted") {
              const tokenId =
                (parsed.args?.tokenId as bigint)?.toString?.() ??
                String(parsed.args?.tokenId);
              const uri = String(parsed.args?.uri ?? "");
              mintedEvents.push({ tokenId, uri });
            }
          } catch {}
        }

        await fetch("/api/index/minted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract: address,
            mints: mintedEvents.map((m) => ({
              tokenId: m.tokenId,
              uri: m.uri,
            })),
            txHash: receipt.hash,
            minter: from,
          }),
        });
      } catch {}

      setOpenMint(false);
      setMintedQty(qty);
      setShowSuccess(true);
      setMinting(false);
      toast.success("Mint successful!");

      readOnchainProgress();
      readWalletMinted();
      setTimeout(readOnchainProgress, 2500);
      setTimeout(readOnchainProgress, 6000);
    } catch (e: any) {
      const friendly = getFriendlyTxError(e, {
        abi: ERC721_DROP_ABI as any,
        fallback:
          "The transaction failed. Check your network, balance, and limits, then try again.",
      });
      setLastError(friendly);
      setMinting(false);
      toast.error(friendly);
    }
  }

  return (
    <div className="relative z-10 isolate rounded-[28px] border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">Mint</div>
        <span className="rounded-full bg-neutral-900/70 px-2 py-1 text-[11px] text-white ring-1 ring-black/10 dark:ring-white/15">
          {saleBadge}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            {presaleLive ? "Presale minted" : "Minted"}
          </span>
          <span className="font-medium tabular-nums">
            {presaleLive
              ? `${presaleMinted} / ${presaleMax}`
              : `${liveMinted} / ${supply}`}
          </span>
        </div>

        <Progress
          value={
            presaleLive
              ? presaleMax > 0
                ? Math.min(100, Math.round((presaleMinted / presaleMax) * 100))
                : 0
              : liveMintedPct
          }
          className="h-2"
        />

        <div className="flex items-center justify-between text-[12px] text-muted">
          <span className="tabular-nums">
            Remaining:{" "}
            <span className="font-medium text-foreground/80">{remainingNow}</span>
          </span>
          <span className="tabular-nums">
            {Math.round(
              presaleLive
                ? presaleMax
                  ? (presaleMinted / presaleMax) * 100
                  : 0
                : liveMintedPct
            )}
            %
          </span>
        </div>

        {connected ? (
          <div className="text-[12px] text-muted">
            Per-wallet remaining:{" "}
            <span className="font-medium text-foreground/80 tabular-nums">
              {walletRemaining}
            </span>
          </div>
        ) : null}
      </div>

      {timePresaleLive && !publicLive ? (
        <div className="mt-4">
          {!connected ? (
            <div className="rounded-2xl border border-border bg-foreground/5 p-3 text-sm text-foreground/80">
              Connect your wallet to check whitelist status and mint.
            </div>
          ) : !eligibilityLoaded ? (
            <div className="rounded-2xl border border-border bg-foreground/5 p-3 text-sm text-foreground/80">
              Checking presale eligibility…
            </div>
          ) : !eligible ? (
            <div className="rounded-2xl border border-border bg-foreground/5 p-3 text-sm text-foreground/80">
              You’re <span className="font-semibold">not whitelisted</span> for
              presale.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-border bg-foreground/5 p-3">
          <div className="text-muted">Price</div>
          <div className="mt-1 font-semibold">{price} ETN</div>
        </div>

        <div className="rounded-2xl border border-border bg-foreground/5 p-3">
          <div className="text-muted">Max / wallet</div>
          <div className="mt-1 font-semibold tabular-nums">
            {formatNumber(maxPerWallet)}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-foreground/5 p-3">
          <div className="text-muted">Max / tx</div>
          <div className="mt-1 font-semibold tabular-nums">
            {formatNumber(maxPerTx)}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-foreground/5 p-3">
          <div className="text-muted">Status</div>
          <div className="mt-1 font-semibold">{saleBadge}</div>
        </div>
      </div>

      <div className="mt-4">
        <Button
          className="h-11 w-full rounded-2xl"
          disabled={!canMint}
          onClick={() => {
            setQty(1);
            setLastError(null);
            setOpenMint(true);
          }}
        >
          {buttonLabel}
        </Button>

        {lastError ? (
          <p className="mt-2 text-sm text-red-500">{lastError}</p>
        ) : null}
      </div>

      {/* mint modal */}
      <Modal
        open={openMint}
        title={`Mint ${details.name}`}
        description="Choose quantity (respects per-wallet and per-tx limits)."
        onClose={() => (!minting ? setOpenMint(false) : null)}
        canClose={!minting}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Price per mint</span>
            <span className="font-semibold">{price} ETN</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-border bg-foreground/5 p-3">
              <div className="text-muted">Max / wallet</div>
              <div className="mt-1 font-semibold tabular-nums">{maxPerWallet}</div>
            </div>

            <div className="rounded-2xl border border-border bg-foreground/5 p-3">
              <div className="text-muted">Max / tx</div>
              <div className="mt-1 font-semibold tabular-nums">{maxPerTx}</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Amount</div>
            <QtyInput
              min={1}
              max={Math.max(1, Math.min(maxPerTx, remainingNow))}
              value={qty}
              onChange={setQty}
            />
            <div className="mt-2 text-xs text-muted tabular-nums">
              Remaining now: {remainingNow}
            </div>
          </div>

          {lastError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {lastError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              className="h-11 rounded-2xl"
              disabled={minting}
              onClick={() => setOpenMint(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-2xl"
              disabled={minting}
              onClick={handleMintConfirm}
            >
              {minting ? "Minting…" : "Confirm Mint"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* success modal */}
      <Modal
        open={showSuccess}
        title="Mint Successful"
        onClose={() => setShowSuccess(false)}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 ring-1 ring-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>

            <div className="min-w-0">
              <div className="text-base font-semibold text-foreground">
                Mint completed successfully
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">
                You minted{" "}
                <span className="font-semibold text-foreground">
                  {mintedQty}
                </span>{" "}
                {mintedQty === 1 ? "NFT" : "NFTs"} from{" "}
                <span className="font-semibold text-foreground">
                  {details.name}
                </span>.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-foreground/5 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-muted">
              Collection
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">
              {details.name}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted">Minted now</div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {mintedQty}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted">Contract</div>
                <div className="mt-1 truncate text-sm font-medium text-foreground">
                  {address}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Link href={`/collections/${address}`}>
              <Button variant="outline" className="h-11 rounded-2xl">
                View collection
              </Button>
            </Link>

            <Button
              className="h-11 rounded-2xl"
              onClick={() => setShowSuccess(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}