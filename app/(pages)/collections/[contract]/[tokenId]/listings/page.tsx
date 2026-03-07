export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { headers } from "next/headers";

import { Badge } from "@/src/ui/Badge";
import { Button } from "@/src/ui/Button";
import { BackButton } from "@/src/ui/BackButton";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ipfsToHttp } from "@/src/lib/media";
import ListingsClient from "./ListingsClient";
import CardMedia from "@/src/components/shared/CardMedia";

type PageContext = {
  params: Promise<{ contract: string; tokenId: string }>;
};

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

type ListingsApiResponse = {
  items?: ActiveListingItem[];
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

async function getTokenListings(contract: string, tokenId: string): Promise<{
  items: ActiveListingItem[];
  ok: boolean;
  now: number;
}> {
  const baseUrl = await getBaseUrlFromHeaders();

  const url =
    `${baseUrl}/api/listing/active` +
    `?contract=${encodeURIComponent(contract)}` +
    `&tokenId=${encodeURIComponent(tokenId)}` +
    `&limit=60&chain=1&requireChain=1`;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return { items: [], ok: false, now: Date.now() };

  const json = (await res.json().catch(() => null)) as ListingsApiResponse | null;
  const items = Array.isArray(json?.items) ? json.items : [];

  const normalized = items
    .filter((x) => x && x.nft?.contract && x.nft?.tokenId && (x.chainId || x.id))
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

      const aEnd = a.endTime ? new Date(a.endTime).getTime() : Number.MAX_SAFE_INTEGER;
      const bEnd = b.endTime ? new Date(b.endTime).getTime() : Number.MAX_SAFE_INTEGER;
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
          <div className="text-xs font-semibold text-muted">Listings</div>
          <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
            {ok ? "No listing entries yet" : "Listing entries unavailable"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {ok
              ? `${tokenName} does not currently have any active seller listings. When owners list their quantities, they’ll appear here.`
              : "We couldn’t load listings right now. Try refreshing in a moment."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Link href={`/collections/${contract}/${tokenId}`}>
            <Button variant="secondary" size="sm" className="w-full sm:w-auto gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to token
            </Button>
          </Link>

          <Link href="/collections">
            <Button size="sm" className="w-full sm:w-auto gap-2">
              Browse collections
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata(ctx: PageContext) {
  const { contract, tokenId } = await ctx.params;
  const tokenMeta = await getTokenMeta(contract, tokenId);

  return {
    title: `${tokenMeta?.name ?? `Token #${tokenId}`} Listings`,
    description: `View live listing entries for token #${tokenId} on Panth.art.`,
  };
}

export default async function TokenListingsPage(ctx: PageContext) {
  const { contract, tokenId } = await ctx.params;

  const [tokenMeta, listingsRes] = await Promise.all([
    getTokenMeta(contract, tokenId),
    getTokenListings(contract, tokenId),
  ]);

  const tokenName = tokenMeta?.name ?? `Token #${tokenId}`;
  const tokenImage = tokenMeta?.image ?? null;
  const collectionName = tokenMeta?.collectionName ?? null;

  const items = listingsRes.items;
  const liveCount = items.filter((x) => x.isLive).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <BackButton />
          </div>

          <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight truncate">
            {tokenName} Listings
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
              <CardMedia
                src={tokenImage}
                alt={tokenName}
                className="absolute inset-0"
                fit="cover"
                autoPlay
                muted
                loop
                playsInline
                audio="toggle"
              />
            ) : null}

            <div className="absolute inset-0 pointer-events-none [background:linear-gradient(to_top,rgba(0,0,0,0.22),transparent_55%)]" />
          </div>

          <div className="lg:col-span-8 p-5 sm:p-6">
            <div className="text-xs font-semibold text-muted">Listing directory</div>
            <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight">
              Seller-specific listings for this ERC-1155 token
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Each owner can list their own quantity independently. Browse the active seller
              listings below, compare prices, quantities, and end dates, and buy the one you want.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{formatInt(items.length)} total</Badge>
              <Badge variant="outline">{formatInt(liveCount)} live</Badge>
              <Badge variant="outline">
                {formatInt(items.filter((x) => !x.isLive).length)} scheduled
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyState
          contract={contract}
          tokenId={tokenId}
          tokenName={tokenName}
          ok={listingsRes.ok}
        />
      ) : (
        <>
          <ListingsClient
            contract={contract}
            tokenId={tokenId}
            standard="ERC1155"
            items={items}
            tokenName={tokenName}
            now={listingsRes.now}
          />

          <div className="mt-6 text-xs text-muted">
            <Link href="/collections" className="hover:underline underline-offset-4">
              Explore more collections →
            </Link>
          </div>
        </>
      )}
    </main>
  );
}