/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { Gavel, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/src/ui/Badge";
import { Button } from "@/src/ui/Button";
import { marketplace, type Standard } from "@/src/lib/services/marketplace";
import CardMedia from "@/src/components/shared/CardMedia";

type ActiveListingItem = {
  id: string;
  dbId?: string | null;
  chainId?: string | null;
  nft: {
    contract: string;
    tokenId: string;
    name: string;
    image: string | null;
    standard: string;
  };
  startTime: string | null;
  endTime: string | null;
  isLive: boolean;
  onchainActive?: boolean | null;
  currency: {
    id?: string | null;
    kind: "NATIVE" | "ERC20" | string;
    symbol: string;
    decimals: number;
    tokenAddress: string | null;
  };
  price: {
    unitWei: string | null;
    unit: string | null;
    totalWei: string | null;
    total: string | null;
    perItemWei?: string | null;
    perItem?: string | null;
  };
  sellerAddress: string | null;
  seller: {
    address: string | null;
    username: string | null;
  };
  quantity: number;
};

function formatInt(n: number) {
  try {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

function formatSellerLabel(item: ActiveListingItem) {
  if (item.seller?.username?.trim()) return item.seller.username.trim();
  if (item.seller?.address) {
    return `${item.seller.address.slice(0, 6)}…${item.seller.address.slice(-4)}`;
  }
  return "Unknown seller";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function sameAddr(a?: string | null, b?: string | null) {
  try {
    if (!a || !b) return false;
    return ethers.getAddress(a) === ethers.getAddress(b);
  } catch {
    return String(a || "").toLowerCase() === String(b || "").toLowerCase();
  }
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";

  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()] ?? "";
  const year = d.getUTCFullYear();

  let hours = d.getUTCHours();
  const mins = pad2(d.getUTCMinutes());

  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${month} ${day}, ${year}, ${hours}:${mins} ${suffix} UTC`;
}

function msUntil(iso?: string | null, nowMs?: number) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, t - (nowMs ?? Date.now()));
}

function formatRemaining(iso?: string | null, nowMs?: number) {
  if (!iso) return "Open-ended";

  const ms = msUntil(iso, nowMs);
  if (ms <= 0) return "Ended";

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${Math.max(1, mins)}m left`;
}

function useNowTicker(initialNow: number) {
  const [now, setNow] = React.useState(initialNow);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  return now;
}

function ListingDirectoryCard({
  item,
  now,
  standard,
  contract,
  tokenId,
}: {
  item: ActiveListingItem;
  now: number;
  standard: Standard;
  contract: `0x${string}`;
  tokenId: bigint;
}) {
  const [busy, setBusy] = React.useState(false);
  const [account, setAccount] = React.useState<string | null>(null);

  const nftHref = `/collections/${item.nft.contract}/${item.nft.tokenId}`;
  const imageSrc = item.nft.image;
  const sellerLabel = formatSellerLabel(item);

  const qty = Math.max(1, Number(item.quantity ?? 1) || 1);

  const totalPriceLine =
    item.price?.total && item.currency?.symbol
      ? `${item.price.total} ${item.currency.symbol}`
      : item.price?.unit && item.currency?.symbol
      ? `${item.price.unit} ${item.currency.symbol}`
      : "—";

  const perItemLine =
    qty > 1 && item.price?.perItem && item.currency?.symbol
      ? `${item.price.perItem} ${item.currency.symbol} each`
      : null;

  const endLabel = formatDateTime(item.endTime);
  const startLabel = formatDateTime(item.startTime);

  const startMs = item.startTime ? new Date(item.startTime).getTime() : 0;
  const endMs = item.endTime ? new Date(item.endTime).getTime() : 0;

  const isScheduled = !!startMs && now < startMs;
  const isEnded = !!endMs && now > endMs;
  const isSeller = !!account && !!item.sellerAddress && sameAddr(account, item.sellerAddress);

  const canBuy = !busy && !isScheduled && !isEnded && !!item.isLive && !isSeller;

  const topRightLabel = isScheduled
    ? formatRemaining(item.startTime, now)
    : formatRemaining(item.endTime, now);

  React.useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      try {
        if (typeof window === "undefined") return;
        const eth = (window as any)?.ethereum;
        if (!eth?.request) return;

        const accounts = (await eth.request({ method: "eth_accounts" }).catch(() => [])) as string[];
        if (!mounted) return;

        const first = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : null;
        setAccount(first && ethers.isAddress(first) ? ethers.getAddress(first) : null);
      } catch {
        if (mounted) setAccount(null);
      }
    }

    void loadAccount();

    const eth = typeof window !== "undefined" ? (window as any)?.ethereum : null;
    if (eth?.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        const first = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : null;
        setAccount(first && ethers.isAddress(first) ? ethers.getAddress(first) : null);
      };

      eth.on("accountsChanged", handleAccountsChanged);

      return () => {
        mounted = false;
        if (eth?.removeListener) {
          eth.removeListener("accountsChanged", handleAccountsChanged);
        }
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  async function onBuy() {
    if (!canBuy) return;

    if (!item.sellerAddress || !ethers.isAddress(item.sellerAddress)) {
      toast.error("Seller address missing for this listing.");
      return;
    }

    const t = toast.loading("Preparing purchase…");
    setBusy(true);

    try {
      const txHash = await marketplace.buyActiveListingForSellerJustInTime({
        collection: contract,
        tokenId,
        standard,
        seller: ethers.getAddress(item.sellerAddress) as `0x${string}`,
      });

      toast.success("Purchase submitted.", {
        id: t,
        description: txHash,
      });
    } catch (e: any) {
      const raw = e?.shortMessage || e?.reason || e?.message || "Purchase failed.";
      const msg = String(raw);

      if (msg.includes("missing revert data") || msg.includes("estimateGas")) {
        toast.error("This listing can’t be purchased right now. Refresh and try again.", {
          id: t,
        });
      } else {
        toast.error(msg.replace("Error: ", ""), { id: t });
      }
    } finally {
      setBusy(false);
    }
  }

  const buyTitle = isSeller
    ? "You are the seller"
    : isScheduled
    ? `Listing starts in ${formatRemaining(item.startTime, now)}`
    : isEnded
    ? "Listing has ended"
    : busy
    ? "Processing"
    : "Buy now";

  const buyLabel = busy
    ? "Buying…"
    : isSeller
    ? "You are the seller"
    : isScheduled
    ? "Not live yet"
    : isEnded
    ? "Ended"
    : "Buy now";

  return (
    <div className="group overflow-hidden rounded-[28px] border border-border bg-card transition hover:bg-card/80">
      <div className="relative h-44 w-full bg-foreground/5">
        {imageSrc ? (
          <CardMedia
            src={imageSrc}
            alt={item.nft.name}
            className="absolute inset-0"
            fit="cover"
            autoPlay
            muted
            loop
            playsInline
            audio="toggle"
          />
        ) : null}

        <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_45%)] dark:[background:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_45%)]" />
        <div className="absolute inset-0 pointer-events-none bg-linear-to-t from-black/18 via-transparent to-transparent dark:from-black/28" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          {isScheduled ? (
            <Badge
              variant="outline"
              className="border border-black/10 bg-white/92 text-foreground shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-black/58 dark:text-white"
            >
              Scheduled
            </Badge>
          ) : item.isLive ? (
            <Badge
              variant="soft"
              className="gap-2 border border-black/10 bg-white/92 text-foreground shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-black/58 dark:text-white"
            >
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              Live
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border border-black/10 bg-white/92 text-foreground shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-black/58 dark:text-white"
            >
              Inactive
            </Badge>
          )}
        </div>

        <div className="absolute right-3 top-3">
          <Badge
            variant="outline"
            className="border border-black/10 bg-white/92 text-foreground shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-black/58 dark:text-white"
          >
            {topRightLabel}
          </Badge>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground transition group-hover:opacity-90">
            {item.nft.name}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span className="font-mono">
              {item.nft.contract.slice(0, 6)}…{item.nft.contract.slice(-4)} #{item.nft.tokenId}
            </span>
            <span>•</span>
            <span>Seller: {sellerLabel}</span>
          </div>

          {isSeller ? (
            <div className="mt-1 text-[11px] text-muted">You are the seller</div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <div className="text-[11px] text-muted">Listing price</div>
            <div className="truncate text-sm font-semibold">{totalPriceLine}</div>
            {perItemLine ? (
              <div className="mt-1 truncate text-[11px] text-muted">{perItemLine}</div>
            ) : null}
          </div>

          <div className="min-w-0 text-right">
            <div className="text-[11px] text-muted">Quantity</div>
            <div className="truncate text-sm font-semibold">{formatInt(qty)}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <div className="text-[11px] text-muted">
              {isScheduled ? "Starts in" : "Start"}
            </div>
            <div className="truncate text-sm font-semibold">
              {isScheduled ? formatRemaining(item.startTime, now) : startLabel}
            </div>
          </div>

          <div className="min-w-0 text-right">
            <div className="text-[11px] text-muted">Ends</div>
            <div className="truncate text-sm font-semibold">{endLabel}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={onBuy}
            disabled={!canBuy}
            title={buyTitle}
          >
            <ShoppingCart className="h-4 w-4" />
            {buyLabel}
          </Button>

          <Link href={nftHref}>
            <Button size="sm" variant="outline" className="w-full gap-2">
              <Gavel className="h-4 w-4" />
              View NFT
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ListingsClient({
  contract,
  tokenId,
  standard,
  items,
  now,
}: {
  contract: string;
  tokenId: string;
  standard: Standard;
  items: ActiveListingItem[];
  tokenName: string;
  now: number;
}) {
  const tickingNow = useNowTicker(now);
  const collection = ethers.getAddress(contract) as `0x${string}`;
  const tokenIdBigInt = BigInt(tokenId);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {items.map((item) => (
        <ListingDirectoryCard
          key={(item.dbId ?? item.chainId ?? item.id) as string}
          item={item}
          now={tickingNow}
          standard={standard}
          contract={collection}
          tokenId={tokenIdBigInt}
        />
      ))}
    </section>
  );
}