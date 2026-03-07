export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { ArrowLeft, ArrowRight, Gavel } from "lucide-react";

import { Badge } from "@/src/ui/Badge";
import { Button } from "@/src/ui/Button";
import { BackButton } from "@/src/ui/BackButton";
import { ipfsToHttp } from "@/src/lib/media";

type PageContext = {
  params: Promise<{ contract: string; tokenId: string }>;
};

type ActiveAuctionItem = {
  id: string;
  dbId?: string | null;
  nft: {
    contract: string;
    tokenId: string;
    name: string;
    image: string | null;
    standard: string;
  };
  startTime: string;
  endTime: string;
  isLive: boolean;
  currency: {
    symbol: string;
    decimals: number;
    tokenAddress: string | null;
    kind: "NATIVE" | "ERC20" | string;
  };
  price: {
    currentWei: string | null;
    current: string | null;

    startWei?: string | null;
    start?: string | null;

    currentBidWei?: string | null;
    currentBid?: string | null;
  };
  seller: {
    address: string | null;
    username: string | null;
  };
  bidsCount: number | null;
  quantity?: number | null;
  highestBidder?: string | null;
};

type AuctionsApiResponse = {
  items?: ActiveAuctionItem[];
  nextCursor?: string | null;
  error?: string;
};

type TokenApiResponse = {
  nft?: {
    contract?: string;
    tokenId?: string;
    name?: string | null;
    image?: string | null;
    description?: string | null;
  };
  collection?: {
    name?: string | null;
  } | null;
};

function formatInt(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

function formatSellerLabel(a: ActiveAuctionItem) {
  if (a.seller?.username?.trim()) return a.seller.username.trim();
  if (a.seller?.address) {
    return `${a.seller.address.slice(0, 6)}…${a.seller.address.slice(-4)}`;
  }
  return "Unknown seller";
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function msUntil(endISO?: string | null, nowMs?: number) {
  if (!endISO) return 0;
  const t = new Date(endISO).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, t - (nowMs ?? Date.now()));
}

function formatRemaining(endISO?: string | null, nowMs?: number) {
  const ms = msUntil(endISO, nowMs);
  if (ms <= 0) return "Ended";

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${Math.max(1, mins)}m left`;
}

async function getBaseUrlFromHeaders() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function getTokenMeta(contract: string, tokenId: string) {
  const baseUrl = await getBaseUrlFromHeaders();
  const res = await fetch(
    `${baseUrl}/api/nft/${encodeURIComponent(contract)}/${encodeURIComponent(tokenId)}`,
    { cache: "no-store" }
  ).catch(() => null);

  if (!res?.ok) return null;

  const json = (await res.json().catch(() => null)) as TokenApiResponse | null;
  return {
    name: json?.nft?.name ?? `Token #${tokenId}`,
    image: json?.nft?.image ? ipfsToHttp(json.nft.image) ?? json.nft.image : null,
    collectionName: json?.collection?.name ?? null,
  };
}

async function getTokenAuctions(contract: string, tokenId: string): Promise<{
  items: ActiveAuctionItem[];
  ok: boolean;
  now: number;
}> {
  const baseUrl = await getBaseUrlFromHeaders();

  const url =
    `${baseUrl}/api/auction/active` +
    `?contract=${encodeURIComponent(contract)}` +
    `&tokenId=${encodeURIComponent(tokenId)}` +
    `&limit=60&chain=1`;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return { items: [], ok: false, now: Date.now() };

  const json = (await res.json().catch(() => null)) as AuctionsApiResponse | null;
  const items = Array.isArray(json?.items) ? json.items : [];

  const normalized = items
    .filter((x) => x && x.id && x.nft?.contract && x.nft?.tokenId)
    .map((x) => ({
      ...x,
      nft: {
        ...x.nft,
        image: x.nft?.image ? ipfsToHttp(x.nft.image) ?? x.nft.image : null,
      },
    }))
    .sort((a, b) => {
      const aLive = a.isLive ? 1 : 0;
      const bLive = b.isLive ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;

      const aEnd = new Date(a.endTime).getTime() || Number.MAX_SAFE_INTEGER;
      const bEnd = new Date(b.endTime).getTime() || Number.MAX_SAFE_INTEGER;
      return aEnd - bEnd;
    });

  return { items: normalized, ok: true, now: Date.now() };
}

function EmptyState({
  contract,
  tokenId,
  tokenName,
  ok,
}: {
  contract: string;
  tokenId: string;
  tokenName: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-border bg-card p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted">Auctions</div>
          <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
            {ok ? "No auction listings yet" : "Auction listings unavailable"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {ok
              ? `${tokenName} does not currently have any live seller auctions. When owners place their quantities on auction, they’ll appear here.`
              : "We couldn’t load auction listings right now. Try refreshing in a moment."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Link href={`/collections/${contract}/${tokenId}`}>
            <Button variant="secondary" size="sm" className="w-full sm:w-auto gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to token
            </Button>
          </Link>

          <Link href="/auction-now">
            <Button size="sm" className="w-full sm:w-auto gap-2">
              Browse all auctions
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function AuctionDirectoryCard({
  auction,
  now,
}: {
  auction: ActiveAuctionItem;
  now: number;
}) {
  const href = auction.dbId ? `/auction-now/${auction.dbId}` : `/auction-now/${auction.id}`;

  const bids = Number(auction.bidsCount ?? 0) || 0;
  const qty = Number(auction.quantity ?? 1) || 1;
  const sellerLabel = formatSellerLabel(auction);
  const imageSrc = auction.nft.image;
  const liveEta = formatRemaining(auction.endTime, now);

  const startPriceLine =
    auction.price?.start && auction.currency?.symbol
      ? `${auction.price.start} ${auction.currency.symbol}`
      : auction.price?.current && auction.currency?.symbol
      ? `${auction.price.current} ${auction.currency.symbol}`
      : "—";

  const currentBidLine =
    auction.price?.currentBid && auction.currency?.symbol
      ? `${auction.price.currentBid} ${auction.currency.symbol}`
      : bids > 0 && auction.price?.current && auction.currency?.symbol
      ? `${auction.price.current} ${auction.currency.symbol}`
      : null;

  const primaryPriceLabel = bids > 0 ? "Current bid" : "Start price";
  const primaryPriceLine = bids > 0 ? currentBidLine ?? "—" : startPriceLine;

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-[28px] border border-border bg-card transition hover:bg-card/80"
    >
      <div className="relative h-44 w-full bg-foreground/5">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={auction.nft.name}
            fill
            sizes="(max-width: 1024px) 92vw, 33vw"
            className="object-cover"
            priority={false}
          />
        ) : null}

        <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_45%)] dark:[background:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_45%)]" />

        <div className="absolute inset-0 pointer-events-none bg-linear-to-t from-black/18 via-transparent to-transparent dark:from-black/28" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          {auction.isLive ? (
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
              Scheduled
            </Badge>
          )}
        </div>

        <div className="absolute right-3 top-3">
          <Badge
            variant="outline"
            className="border border-black/10 bg-white/92 text-foreground shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-black/58 dark:text-white"
          >
            {liveEta}
          </Badge>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground transition group-hover:opacity-90">
            {auction.nft.name}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span className="font-mono">
              {auction.nft.contract.slice(0, 6)}…{auction.nft.contract.slice(-4)} #{auction.nft.tokenId}
            </span>
            <span>•</span>
            <span>Seller: {sellerLabel}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <div className="text-[11px] text-muted">{primaryPriceLabel}</div>
            <div className="truncate text-sm font-semibold">{primaryPriceLine}</div>
          </div>

          <div className="min-w-0 text-right">
            <div className="text-[11px] text-muted">Quantity</div>
            <div className="truncate text-sm font-semibold">{formatInt(qty)}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <div className="text-[11px] text-muted">Bids</div>
            <div className="text-sm font-semibold">{formatInt(bids)}</div>
          </div>

          <div className="min-w-0 text-right">
            <div className="text-[11px] text-muted">Ends</div>
            <div className="truncate text-sm font-semibold">
              {formatDateTime(auction.endTime)}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Button size="sm" className="w-full gap-2">
            <Gavel className="h-4 w-4" />
            Open auction
          </Button>
        </div>
      </div>
    </Link>
  );
}

export async function generateMetadata(ctx: PageContext) {
  const { contract, tokenId } = await ctx.params;
  const tokenMeta = await getTokenMeta(contract, tokenId);

  return {
    title: `${tokenMeta?.name ?? `Token #${tokenId}`} Auctions`,
    description: `View live auction listings for token #${tokenId} on Panth.art.`,
  };
}

export default async function TokenAuctionsPage(ctx: PageContext) {
  const { contract, tokenId } = await ctx.params;

  const [tokenMeta, auctionsRes] = await Promise.all([
    getTokenMeta(contract, tokenId),
    getTokenAuctions(contract, tokenId),
  ]);

  const tokenName = tokenMeta?.name ?? `Token #${tokenId}`;
  const tokenImage = tokenMeta?.image ?? null;
  const collectionName = tokenMeta?.collectionName ?? null;

  const items = auctionsRes.items;
  const liveCount = items.filter((x) => x.isLive).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <BackButton />
          </div>

          <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight truncate">
            {tokenName} Auctions
          </h1>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{contract}</span>
            <span className="opacity-50">•</span>
            <span className="font-mono">#{tokenId}</span>
            <span className="opacity-50">•</span>
            <span>ERC1155</span>
            {collectionName ? (
              <>
                <span className="opacity-50">•</span>
                <span>{collectionName}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">{liveCount} live</Badge>

          <Link
            href={`/collections/${contract}/${tokenId}`}
            className="text-xs rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            View token
          </Link>
        </div>
      </div>

      <section className="mb-6 overflow-hidden rounded-[28px] border border-border bg-card">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="relative lg:col-span-4 min-h-55 bg-foreground/5">
            {tokenImage ? (
              <Image
                src={tokenImage}
                alt={tokenName}
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-cover"
                priority={false}
              />
            ) : null}

            <div className="absolute inset-0 pointer-events-none [background:linear-gradient(to_top,rgba(0,0,0,0.22),transparent_55%)]" />
          </div>

          <div className="lg:col-span-8 p-5 sm:p-6">
            <div className="text-xs font-semibold text-muted">Auction directory</div>
            <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight">
              Seller-specific auctions for this ERC-1155 token
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Each owner can auction their own quantity independently. Browse the active seller
              auctions below, compare prices and bids, and open the one you want to participate in.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{formatInt(items.length)} total</Badge>
              <Badge variant="outline">{formatInt(liveCount)} live</Badge>
              <Badge variant="outline">{formatInt(items.filter((x) => !x.isLive).length)} scheduled</Badge>
            </div>
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyState
          contract={contract}
          tokenId={tokenId}
          tokenName={tokenName}
          ok={auctionsRes.ok}
        />
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {items.map((auction) => (
              <AuctionDirectoryCard
                key={(auction.dbId ?? auction.id) as string}
                auction={auction}
                now={auctionsRes.now}
              />
            ))}
          </section>

          <div className="mt-6 text-xs text-muted">
            <Link href="/auction-now" className="hover:underline underline-offset-4">
              See all live auctions →
            </Link>
          </div>
        </>
      )}
    </main>
  );
}