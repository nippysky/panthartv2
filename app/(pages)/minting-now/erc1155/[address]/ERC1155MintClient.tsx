/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { ethers } from "ethers";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Minus,
  Plus,
  X,
} from "lucide-react";

import { ERC1155_SINGLE_ABI } from "@/src/lib/abis/ERC1155SingleDropABI";
import type { ERC1155MintDetails } from "@/src/lib/server/erc1155-details";
import { shortenAddress } from "@/src/lib/utils";

import { Button } from "@/src/ui/Button";
import { Progress } from "@/src/ui/Progress";
import { useLoaderStore } from "@/src/lib/store/loader-store";
import LoaderModal from "@/src/components/shared/LoaderModal";

const PUBLIC_RPC = process.env.NEXT_PUBLIC_RPC_URL || "";
const EXPLORER_BASE = process.env.NEXT_PUBLIC_BLOCK_EXPLORER || "";
const IPFS_GW = (
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com/ipfs/"
).replace(/\/?$/, "/");

/* ---------------------------------------------------------------------------
 * BigInt constants
 * ------------------------------------------------------------------------- */
const ZERO = BigInt(0);
const TEN = BigInt(10);
const WEI_PER_ETN = TEN ** BigInt(18);

/* ---------------------------------------------------------------------------
 * Media helpers
 * ------------------------------------------------------------------------- */
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|ogg)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function ipfsToHttp(u?: string | null) {
  if (!u) return "";
  if (u.startsWith("ipfs://")) return IPFS_GW + u.slice(7);
  if (/^[a-z0-9]{46,}$/i.test(u) && !u.includes("/") && !u.includes(".")) {
    return IPFS_GW + u;
  }
  return u;
}

function guessMediaKind(u?: string) {
  if (!u) return "unknown" as const;
  const clean = u.split("?")[0].split("#")[0].toLowerCase();
  if (VIDEO_EXT.test(clean)) return "video" as const;
  if (IMAGE_EXT.test(clean)) return "image" as const;
  return "unknown" as const;
}

function bypassOptimizer(u: string): boolean {
  try {
    const host = new URL(u).host;
    return /ipfs\.io$|cloudflare-ipfs\.com$|pinata\.cloud$|lighthouse\.storage$|arweave\.net$/i.test(
      host
    );
  } catch {
    return true;
  }
}

/* ---------------------------------------------------------------------------
 * Formatting helpers
 * ------------------------------------------------------------------------- */
function formatEtnFromWei(wei: string | number | bigint) {
  const b = BigInt(wei.toString());
  const whole = b / WEI_PER_ETN;
  const frac = b % WEI_PER_ETN;

  if (frac === ZERO) return whole.toString();

  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function multiplyWei(aWei: string | bigint, qty: number): string {
  const a = BigInt(aWei.toString());
  return (a * BigInt(qty)).toString();
}

function prettyNumber(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString();
}

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------------------
 * Wallet connection
 * ------------------------------------------------------------------------- */
function useConnectedAddress() {
  const [addr, setAddr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const eth: any = (window as any).ethereum;

    async function load() {
      try {
        let a = eth?.selectedAddress || null;
        if (!a && eth?.request) {
          const arr = await eth.request({ method: "eth_accounts" });
          a = arr?.[0] ?? null;
        }
        setAddr(a);
      } catch {
        setAddr(null);
      }
    }

    load();

    if (eth?.on) {
      const handler = (accounts: string[]) => setAddr(accounts?.[0] ?? null);
      eth.on("accountsChanged", handler);
      return () => eth.removeListener?.("accountsChanged", handler);
    }
  }, []);

  return addr;
}

async function getReadProvider(): Promise<ethers.Provider | null> {
  try {
    if (PUBLIC_RPC) return new ethers.JsonRpcProvider(PUBLIC_RPC);
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return new ethers.BrowserProvider((window as any).ethereum);
    }
  } catch {}
  return null;
}

/* ---------------------------------------------------------------------------
 * On-chain reads
 * ------------------------------------------------------------------------- */
async function fetchOnchainProgress(contract: string) {
  const provider = await getReadProvider();
  if (!provider) return null;

  try {
    const c = new ethers.Contract(contract, ERC1155_SINGLE_ABI, provider);
    const [totalMinted, maxSupply, mintPrice, maxPerWallet] = await Promise.all([
      c.totalMinted() as Promise<bigint>,
      c.maxSupply() as Promise<bigint>,
      c.mintPrice() as Promise<bigint>,
      c.maxPerWallet() as Promise<bigint>,
    ]);

    const supply = Number(maxSupply);
    const minted = Number(totalMinted);
    const mintedPct =
      supply > 0 ? Math.min(100, Math.round((minted / supply) * 100)) : 0;

    return {
      supply,
      minted,
      mintedPct,
      priceEtnWei: mintPrice.toString(),
      maxPerWallet: Number(maxPerWallet),
    };
  } catch {
    return null;
  }
}

async function fetchWalletMinted(contract: string, wallet: string) {
  const provider = await getReadProvider();
  if (!provider) return null;

  try {
    const c = new ethers.Contract(contract, ERC1155_SINGLE_ABI, provider);
    const mw: bigint = await c.mintedPerWallet(wallet);
    return Number(mw);
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * UI atoms
 * ------------------------------------------------------------------------- */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] md:text-xs bg-neutral-900/70 text-white backdrop-blur-md shadow-sm ring-1 ring-black/10 dark:ring-white/15">
      {children}
    </span>
  );
}

function CopyAddr({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success("Address copied");
      }}
      className="inline-flex cursor-pointer items-center justify-center rounded-md px-1.5 py-1 hover:bg-black/5 dark:hover:bg-white/10"
      title="Copy"
    >
      <Copy className="h-3.5 w-3.5 opacity-80" />
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Quantity input
 * ------------------------------------------------------------------------- */
function QtyInput({
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) {
  return (
    <input
      value={String(value)}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Math.floor(Number(e.target.value || min));
        const clamped = Math.max(
          min,
          Math.min(max, Number.isFinite(n) ? n : min)
        );
        onChange(clamped);
      }}
      className={cx(
        "h-11 w-full rounded-2xl border border-border bg-background px-4 text-center text-sm outline-none",
        "focus:ring-2 focus:ring-foreground/10 disabled:opacity-50"
      )}
    />
  );
}

/* ---------------------------------------------------------------------------
 * Portal Modal
 * ------------------------------------------------------------------------- */
function PortalModal({
  open,
  title,
  description,
  children,
  onClose,
  canClose = true,
  closeOnBackdrop = true,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  canClose?: boolean;
  closeOnBackdrop?: boolean;
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

  const ui = (
    <div className="fixed inset-0 z-9999">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (canClose && closeOnBackdrop) onClose();
        }}
        aria-hidden="true"
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

  return createPortal(ui, document.body);
}

/* ---------------------------------------------------------------------------
 * Success modal — simplified, no image/video preview
 * ------------------------------------------------------------------------- */
function SuccessModal({
  open,
  onClose,
  name,
  qty,
  contract,
  txHash,
  explorerBase,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  qty: number;
  contract: string;
  txHash: string | null;
  explorerBase?: string;
}) {
  const explorerTxUrl =
    explorerBase && txHash
      ? `${explorerBase.replace(/\/+$/, "")}/tx/${txHash}`
      : null;

  const explorerContractUrl =
    explorerBase && contract
      ? `${explorerBase.replace(/\/+$/, "")}/address/${contract}`
      : null;

  return (
    <PortalModal
      open={open}
      title="Mint Successful"
      onClose={onClose}
      closeOnBackdrop={false}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-foreground">
              Mint completed successfully
            </div>
            <div className="mt-1 text-sm leading-6 text-muted">
              You minted{" "}
              <span className="font-semibold text-foreground">{qty}</span>{" "}
              {qty === 1 ? "edition" : "editions"} from{" "}
              <span className="font-semibold text-foreground">{name}</span>.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-foreground/5 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-muted">
            Collection
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {name}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted">Minted now</div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {qty}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted">Contract</div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {shortenAddress(contract)}
              </div>
            </div>
          </div>

          {explorerContractUrl ? (
            <div className="mt-4">
              <a
                href={explorerContractUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs text-muted underline"
              >
                View contract
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : null}

          {txHash ? (
            <div className="mt-3 text-xs text-muted">
              Tx:{" "}
              {explorerTxUrl ? (
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 underline"
                >
                  {txHash.slice(0, 10)}…{txHash.slice(-8)}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="font-mono">{txHash}</span>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Link href={`/minting-now/erc1155/${contract}`}>
            <Button variant="outline" className="h-11 rounded-2xl">
              Back to mint page
            </Button>
          </Link>

          <Button onClick={onClose} className="h-11 rounded-2xl">
            Close
          </Button>
        </div>
      </div>
    </PortalModal>
  );
}

/* ---------------------------------------------------------------------------
 * Hero media thumbnail
 * ------------------------------------------------------------------------- */
function HeroMediaThumb({
  url,
  kind,
  onVideoError,
  onImageError,
}: {
  url: string;
  kind: "video" | "image";
  onVideoError: () => void;
  onImageError: () => void;
}) {
  if (!url) {
    return <div className="absolute inset-0 bg-black/25" />;
  }

  if (kind === "video") {
    return (
      <video
        key={`hero-video-${url}`}
        src={url}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        onError={onVideoError}
      />
    );
  }

  return (
    <Image
      src={url}
      alt="Media"
      fill
      sizes="112px"
      unoptimized={bypassOptimizer(url)}
      className="object-cover"
      onError={onImageError}
    />
  );
}

/* ---------------------------------------------------------------------------
 * Hero
 * ------------------------------------------------------------------------- */
function Hero({
  details,
  contract,
  heroMediaUrl,
  heroMediaKind,
  onHeroVideoError,
  onHeroImageError,
}: {
  details: ERC1155MintDetails;
  contract: string;
  heroMediaUrl: string;
  heroMediaKind: "video" | "image";
  onHeroVideoError: () => void;
  onHeroImageError: () => void;
}) {
  const creatorAvatar =
    details.creator.profileAvatar ||
    `https://api.dicebear.com/7.x/identicon/svg?seed=${details.creator.walletAddress}`;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border">
      <div className="absolute inset-0">
        {heroMediaUrl && heroMediaKind === "image" ? (
          <Image
            src={heroMediaUrl}
            alt={details.name}
            fill
            sizes="100vw"
            unoptimized={bypassOptimizer(heroMediaUrl)}
            className="object-cover"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-900" />
        )}

        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_240px_at_18%_-10%,rgba(56,189,248,0.18),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_240px_at_82%_110%,rgba(168,85,247,0.18),transparent_60%)]" />
        <div className="absolute inset-0 [background:linear-gradient(180deg,rgba(0,0,0,.70),rgba(0,0,0,.25),rgba(0,0,0,.70))]" />
      </div>

      <div className="relative p-4 text-white md:p-6">
        <div className="grid items-start gap-5 md:grid-cols-[auto,1fr] md:gap-6">
          <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-black/25 ring-1 ring-white/20 md:h-28 md:w-28">
            <HeroMediaThumb
              url={heroMediaUrl}
              kind={heroMediaKind}
              onVideoError={onHeroVideoError}
              onImageError={onHeroImageError}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill>
                <span className="uppercase tracking-wide">ERC-1155</span>
              </Pill>
              <span className="truncate text-[11px] text-white/85 md:text-xs">
                Contract: <span className="font-medium">{contract}</span>
              </span>
            </div>

            <h1 className="mt-4 truncate text-2xl font-semibold tracking-tight md:text-3xl">
              {details.name}
            </h1>

            {details.description ? (
              <p className="mt-1 line-clamp-3 max-w-3xl text-sm text-white/85">
                {details.description}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
                  <Image
                    src={creatorAvatar}
                    alt={details.creator.username || "Creator"}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0">
                  <Link
                    href={`/profile/${details.creator.walletAddress}`}
                    className="block truncate font-medium leading-tight hover:underline"
                    title={
                      details.creator.username || details.creator.walletAddress
                    }
                  >
                    {details.creator.username ||
                      shortenAddress(details.creator.walletAddress)}
                  </Link>
                  <div className="truncate text-[11px] text-white/70">
                    {details.creator.walletAddress}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-white/70">
                Single-drop mint on Electroneum (ETN)
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------------- */
export default function ERC1155MintClient({
  details,
}: {
  details: ERC1155MintDetails;
}) {
  const connected = useConnectedAddress();
  const { show, hide } = useLoaderStore();

  const rawMediaUrl = ipfsToHttp(details.imageUrl);
  const guessed = guessMediaKind(rawMediaUrl);

  const [heroKind, setHeroKind] = React.useState<"video" | "image">(
    guessed === "video" ? "video" : "image"
  );
  const [heroProbeTried, setHeroProbeTried] = React.useState(false);

  React.useEffect(() => {
    const g = guessMediaKind(rawMediaUrl);
    setHeroProbeTried(false);
    if (g === "video") setHeroKind("video");
    else if (g === "image") setHeroKind("image");
    else setHeroKind("video");
  }, [rawMediaUrl]);

  const mediaUrl = rawMediaUrl;

  const { data: live, mutate } = useSWR(
    ["erc1155-progress", details.contract],
    () => fetchOnchainProgress(details.contract),
    {
      refreshInterval: 10_000,
      revalidateOnFocus: true,
      fallbackData: {
        supply: details.supply,
        minted: details.minted,
        mintedPct: details.mintedPct,
        priceEtnWei: details.priceEtnWei,
        maxPerWallet: details.maxPerWallet,
      },
    }
  );

  const { data: walletMinted, mutate: mutateWalletMinted } = useSWR(
    connected ? ["erc1155-wallet-minted", details.contract, connected] : null,
    () => fetchWalletMinted(details.contract, connected as string),
    { refreshInterval: 12_000, revalidateOnFocus: true }
  );

  const supply = live?.supply ?? details.supply;
  const minted = live?.minted ?? details.minted;
  const mintedPct = live?.mintedPct ?? details.mintedPct;
  const priceWei = live?.priceEtnWei ?? details.priceEtnWei;
  const maxPerWallet = live?.maxPerWallet ?? details.maxPerWallet;

  const remaining = Math.max(0, supply - minted);
  const soldOut = remaining <= 0;
  const price = formatEtnFromWei(priceWei);

  const MAX_PER_TX = 20;

  const mintedByYou =
    connected && typeof walletMinted === "number"
      ? Math.max(0, walletMinted)
      : null;

  const walletRemaining =
    connected && typeof walletMinted === "number"
      ? Math.max(0, (maxPerWallet || 0) - walletMinted)
      : maxPerWallet;

  const maxQtyThisTx = Math.max(
    0,
    Math.min(
      MAX_PER_TX,
      remaining,
      Number.isFinite(walletRemaining)
        ? (walletRemaining as number)
        : MAX_PER_TX
    )
  );

  const [qty, setQty] = React.useState(1);
  const [minting, setMinting] = React.useState(false);

  const [openMint, setOpenMint] = React.useState(false);
  const [qtyError, setQtyError] = React.useState<string | null>(null);

  const [showSuccess, setShowSuccess] = React.useState(false);
  const [successQty, setSuccessQty] = React.useState(0);
  const [successTx, setSuccessTx] = React.useState<string | null>(null);

  React.useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, maxQtyThisTx || 1)));
  }, [maxQtyThisTx]);

  React.useEffect(() => {
    if (Number.isFinite(walletRemaining) && (walletRemaining as number) <= 0) {
      setQtyError(`You’ve reached the maximum per wallet (${maxPerWallet}).`);
    } else {
      setQtyError(null);
    }
  }, [walletRemaining, maxPerWallet]);

  const totalCostWei = multiplyWei(priceWei, qty);
  const totalCostETN = formatEtnFromWei(totalCostWei);

  const explorerContractUrl =
    EXPLORER_BASE && details.contract
      ? `${EXPLORER_BASE.replace(/\/+$/, "")}/address/${details.contract}`
      : undefined;

  function validateQty(n: number) {
    if (!Number.isFinite(n) || n < 1) return "Enter a valid amount.";
    if (maxQtyThisTx <= 0) return soldOut ? "Sold out." : "Not enough remaining to mint.";
    if (n > maxQtyThisTx) return `You can mint up to ${maxQtyThisTx} right now.`;
    return null;
  }

  async function handleMintConfirm() {
    if (soldOut) return;

    const err = validateQty(qty);
    if (err) {
      setQtyError(err);
      toast.error(err);
      return;
    }

    if (!connected || !(window as any).ethereum) {
      toast.error("Connect your wallet to mint.");
      return;
    }

    try {
      setQtyError(null);
      setMinting(true);
      show("Confirm the transaction in your wallet…");

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const c = new ethers.Contract(details.contract, ERC1155_SINGLE_ABI, signer);

      const value = BigInt(priceWei) * BigInt(qty);

      try {
        await c.mint.staticCall(qty, { value });
      } catch {
        hide();
        setMinting(false);
        const msg =
          Number.isFinite(walletRemaining) && qty > (walletRemaining as number)
            ? `You can mint ${walletRemaining} more total (max/wallet ${maxPerWallet}).`
            : "Mint would fail with current amount.";
        setQtyError(msg);
        toast.error(msg);
        return;
      }

      const overrides: any = { value };

      try {
        const est: bigint = await c.mint.estimateGas(qty, { value });
        overrides.gasLimit = (est * BigInt(120)) / BigInt(100);
      } catch {
        overrides.gasLimit = BigInt(500_000);
      }

      show("Waiting for on-chain confirmation…");
      const tx = await c.mint(qty, overrides);
      setSuccessTx(tx.hash);

      const rcpt = await tx.wait();
      if (!rcpt || rcpt.status !== 1) {
        hide();
        setMinting(false);
        toast.error("Mint failed on-chain.");
        return;
      }

      setOpenMint(false);
      setSuccessQty(qty);
      setShowSuccess(true);

      await mutate();
      await mutateWalletMinted();
      setTimeout(() => mutate(), 1400);
      setTimeout(() => mutateWalletMinted(), 2000);
      setTimeout(() => mutate(), 4200);

      hide();
      toast.success("Mint successful!");
    } catch {
      hide();
      toast.error("Mint failed. Please try again.");
    } finally {
      setMinting(false);
    }
  }

  return (
    <section className="min-h-[70vh]">
      <LoaderModal />

      <Hero
        details={details}
        contract={details.contract}
        heroMediaUrl={mediaUrl}
        heroMediaKind={heroKind}
        onHeroVideoError={() => {
          if (!heroProbeTried) {
            setHeroProbeTried(true);
            setHeroKind("image");
          }
        }}
        onHeroImageError={() => {
          if (!heroProbeTried && guessMediaKind(mediaUrl) === "unknown") {
            setHeroProbeTried(true);
            setHeroKind("video");
          }
        }}
      />

      <div className="isolate mt-8 grid items-start gap-6 lg:grid-cols-[1.05fr,.95fr]">
        <div className="overflow-hidden rounded-[28px] border border-border bg-card">
          <div className="p-4 md:p-6">
            <div className="text-sm font-semibold">About</div>
            {details.description ? (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {details.description}
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted">—</p>
            )}
          </div>
        </div>

        <div className="relative z-30">
          <div className="z-30 space-y-6 lg:sticky lg:top-24">
            <div className="rounded-[28px] border border-border bg-background/95 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/80">
              <div className="p-4 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold">Mint</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <span>Contract:</span>
                      <span className="font-medium">
                        {shortenAddress(details.contract)}
                      </span>
                      <CopyAddr value={details.contract} />
                      {explorerContractUrl ? (
                        <a
                          href={explorerContractUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          View <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <Pill>
                    <span className="uppercase tracking-wide">
                      {soldOut ? "Sold Out" : "Live"}
                    </span>
                  </Pill>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Minted</span>
                    <span className="font-medium tabular-nums">
                      {prettyNumber(minted)} / {prettyNumber(supply)}
                    </span>
                  </div>

                  <Progress value={mintedPct} className="h-2" />

                  <div className="flex items-center justify-between text-[12px] text-muted">
                    <span className="tabular-nums">
                      Remaining:{" "}
                      <span className="font-medium text-foreground/80">
                        {prettyNumber(remaining)}
                      </span>
                    </span>
                    <span className="tabular-nums">{mintedPct}%</span>
                  </div>

                  {connected && mintedByYou !== null ? (
                    <div className="text-[12px] text-muted">
                      Per-wallet remaining:{" "}
                      <span className="font-medium text-foreground/80 tabular-nums">
                        {walletRemaining}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-border bg-foreground/5 p-3">
                    <div className="text-muted">Price</div>
                    <div className="mt-1 font-semibold">{price} ETN</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-foreground/5 p-3">
                    <div className="text-muted">Max / wallet</div>
                    <div className="mt-1 font-semibold tabular-nums">
                      {prettyNumber(maxPerWallet)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-foreground/5 p-3">
                    <div className="text-muted">Max / tx</div>
                    <div className="mt-1 font-semibold tabular-nums">
                      {prettyNumber(MAX_PER_TX)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-foreground/5 p-3">
                    <div className="text-muted">Status</div>
                    <div className="mt-1 font-semibold">
                      {soldOut ? "Sold Out" : "Public Live"}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <Button
                    className="h-11 w-full rounded-2xl font-semibold"
                    disabled={soldOut || minting || maxQtyThisTx <= 0}
                    onClick={() => {
                      setQtyError(null);
                      setOpenMint(true);
                    }}
                  >
                    {soldOut ? "Sold Out" : "Mint"}
                  </Button>

                  {qtyError ? (
                    <p className="mt-2 text-sm text-red-500">{qtyError}</p>
                  ) : null}

                  <div className="mt-2 text-[11px] text-muted">
                    Tip: You’ll be prompted by your wallet. Network fees apply.
                    Only mint from creators you trust.
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-muted">
              {prettyNumber(remaining)} remaining • up to{" "}
              {prettyNumber(Math.max(1, maxQtyThisTx || 1))} this transaction
              {connected && mintedByYou !== null ? (
                <>
                  {" "}
                  • you can mint {walletRemaining} more (minted {mintedByYou})
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <PortalModal
        open={openMint}
        title={`Mint ${details.name}`}
        description="Choose quantity (respects per-wallet and per-tx limits)."
        onClose={() => (!minting ? setOpenMint(false) : null)}
        canClose={!minting}
        closeOnBackdrop={!minting}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Price per mint</span>
            <span className="font-semibold">{price} ETN</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-border bg-foreground/5 p-3">
              <div className="text-muted">Max / wallet</div>
              <div className="mt-1 font-semibold tabular-nums">
                {prettyNumber(maxPerWallet)}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-foreground/5 p-3">
              <div className="text-muted">Max / tx</div>
              <div className="mt-1 font-semibold tabular-nums">
                {prettyNumber(MAX_PER_TX)}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Amount</div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 rounded-2xl"
                disabled={minting || qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>

              <QtyInput
                value={qty}
                min={1}
                max={Math.max(1, maxQtyThisTx || 1)}
                disabled={minting}
                onChange={(n) => {
                  setQty(n);
                  setQtyError(null);
                }}
              />

              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 rounded-2xl"
                disabled={minting || qty >= Math.max(1, maxQtyThisTx || 1)}
                onClick={() =>
                  setQty((q) =>
                    Math.min(Math.max(1, maxQtyThisTx || 1), q + 1)
                  )
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-2 text-xs text-muted tabular-nums">
              Remaining now: {prettyNumber(remaining)} • Up to{" "}
              {prettyNumber(Math.max(1, maxQtyThisTx || 1))} this tx
            </div>

            <div className="mt-2 text-xs text-muted tabular-nums">
              Total:{" "}
              <span className="font-semibold text-foreground">
                {totalCostETN} ETN
              </span>
            </div>
          </div>

          {qtyError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {qtyError}
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
              disabled={minting || soldOut}
              onClick={handleMintConfirm}
            >
              {minting ? "Minting…" : `Confirm Mint (${totalCostETN} ETN)`}
            </Button>
          </div>
        </div>
      </PortalModal>

      <SuccessModal
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        name={details.name}
        qty={successQty}
        contract={details.contract}
        txHash={successTx}
        explorerBase={EXPLORER_BASE}
      />
    </section>
  );
}