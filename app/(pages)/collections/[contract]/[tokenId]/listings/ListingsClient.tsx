/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { ExternalLink, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import CardMedia from "@/src/components/shared/CardMedia";
import { Container } from "@/src/ui/Container";
import { Button } from "@/src/ui/Button";
import { Badge } from "@/src/ui/Badge";
import { IconButton } from "@/src/ui/IconButton";
import { BackButton } from "@/src/ui/BackButton";
import { marketplace } from "@/src/lib/services/marketplace";

type NftLite = {
  contract: string;
  tokenId: string;
  standard: "ERC721" | "ERC1155";
  name: string;
  collectionName: string | null;
  imageUrl: string | null;
};

type ListingLite = {
  // ✅ we now accept nullable listingId (db doesn't store chain listing id)
  listingId: string | null;
  dbId?: string;

  sellerAddress: string;
  quantity: number;
  status: string;

  startTime: string | null;
  endTime: string | null;
  createdAt?: string | null;
  txHashCreated: string | null;

  priceEtnWei: string;
  priceTokenAmount: string | null;

  currency: {
    kind: string;
    symbol: string | null;
    decimals: number;
    tokenAddress: string | null;
  };
};

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function shortAddr(a?: string | null) {
  if (!a) return "";
  const s = String(a);
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function toBigIntSafe(valueLike: string): bigint {
  const s = String(valueLike || "0").trim();
  if (!s) return BigInt(0);
  if (s.includes(".")) return BigInt(s.split(".")[0] || "0");
  return BigInt(s);
}

function formatCompactNumber(n: number) {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatFullNumber(n: number) {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
  }).format(n);
}

function formatPrice(listing: ListingLite) {
  const kind = String(listing.currency?.kind || "NATIVE").toUpperCase();
  const symbol = listing.currency?.symbol || (kind === "NATIVE" ? "ETN" : "TOKEN");
  const decimals = Number(listing.currency?.decimals ?? 18) || 18;

  const base = kind === "NATIVE" ? listing.priceEtnWei : listing.priceTokenAmount || "0";

  try {
    const bi = toBigIntSafe(base);
    const human = ethers.formatUnits(bi, decimals);
    const num = Number(human);
    return {
      compact: `${formatCompactNumber(num)} ${symbol}`,
      full: `${formatFullNumber(num)} ${symbol}`,
    };
  } catch {
    return { compact: `0 ${symbol}`, full: `0 ${symbol}` };
  }
}

function ListingCard({
  nftHref,
  nftTitle,
  img,
  standard,
  contract,
  tokenId,
  l,
}: {
  nftHref: string;
  nftTitle: string;
  img?: string | null;
  standard: "ERC721" | "ERC1155";
  contract: `0x${string}`;
  tokenId: bigint;
  l: ListingLite;
}) {
  const { compact, full } = formatPrice(l);
  const [busy, setBusy] = React.useState(false);

  async function onBuy() {
    if (busy) return;

    const seller = ethers.getAddress(l.sellerAddress) as `0x${string}`;
    const t = toast.loading("Preparing purchase…");
    setBusy(true);

    try {
      const txHash = await marketplace.buyActiveListingForSellerJustInTime({
        collection: contract,
        tokenId,
        standard,
        seller,
      });

      toast.success("Purchase submitted.", { id: t, description: txHash });
    } catch (e: any) {
      const raw = e?.shortMessage || e?.reason || e?.message || "Purchase failed.";
      const msg = String(raw);

      // common metamask/ethers preflight failure
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

  return (
    <div
      className={cx(
        "group h-full rounded-[26px] border border-border bg-card/50 overflow-hidden",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/15"
      )}
    >
      {/* ✅ NOT clickable card. Only inner controls are clickable. */}
      <div className="relative aspect-square bg-foreground/5">
        <CardMedia
          src={img}
          alt={nftTitle}
          className="absolute inset-0"
          audio="toggle"
        />

        <div className="absolute left-3 top-3 z-10">
          <span
            className="
              inline-flex items-center gap-1
              rounded-full px-2.5 py-1
              text-[10px] sm:text-xs font-semibold
              border border-border/70
              bg-background/70 text-foreground
              backdrop-blur-md
              shadow-[0_10px_30px_rgba(0,0,0,0.22)]
              ring-1 ring-foreground/5
            "
          >
            {standard === "ERC1155" ? `ERC-1155 × ${Math.max(1, l.quantity)}` : "ERC-721"}
          </span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/40 to-transparent" />

        <div className="absolute right-3 bottom-3 z-10 flex items-center gap-2">
          <Link href={nftHref} prefetch={false} aria-label="Open NFT">
            <IconButton title="Open NFT" aria-label="Open NFT">
              <ExternalLink className="h-4 w-4" />
            </IconButton>
          </Link>
        </div>
      </div>

      <div className="p-3 sm:p-3.5">
        {/* top row: status + qty */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="soft">Active</Badge>
            <div className="text-xs text-muted truncate">
              Qty <span className="font-semibold text-foreground">{l.quantity}</span>
            </div>
          </div>

          <div className="text-xs text-muted truncate">
            Seller{" "}
            <span className="font-mono text-foreground/85">{shortAddr(l.sellerAddress)}</span>
          </div>
        </div>

        {/* price */}
        <div className="mt-3">
          <div className="text-xs text-muted">Price</div>
          <div className="mt-1 text-lg font-semibold" title={full}>
            {compact}
          </div>
        </div>

        {/* actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            onClick={onBuy}
            disabled={busy}
            className="rounded-full"
          >
            <ShoppingCart className="h-4 w-4" />
            {busy ? "Buying…" : "Buy now"}
          </Button>

          <Link href={nftHref} prefetch={false}>
            <Button variant="outline" className="w-full rounded-full">
              View NFT
            </Button>
          </Link>
        </div>

        {/* tiny identifier (optional, compact) */}
        {l.txHashCreated ? (
          <div className="mt-3 text-[11px] text-muted truncate">
            Tx{" "}
            <span className="font-mono text-foreground/75">
              {l.txHashCreated.slice(0, 10)}…{l.txHashCreated.slice(-6)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ListingsClient({
  nft,
  listings,
}: {
  nft: NftLite;
  listings: ListingLite[];
}) {
  const nftHref = `/collections/${nft.contract}/${nft.tokenId}`;
  const title = nft.name || `#${nft.tokenId}`;
  const img = nft.imageUrl || null;

  const contract = ethers.getAddress(nft.contract) as `0x${string}`;
  const tokenId = BigInt(nft.tokenId);

  return (
    <section className="pb-12">
      <Container size="lg" className="py-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <BackButton variant="ghost" className="-ml-2" fallbackHref={nftHref} />
          <div className="hidden sm:flex items-center gap-2">
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted">
              Market
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted">
              ERC-1155
            </span>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs font-semibold text-muted">Market</div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            Listings
          </h1>
          <p className="mt-2 text-sm text-muted leading-relaxed max-w-3xl">
            Active listings for this{" "}
            <span className="font-semibold text-foreground">ERC1155</span> token.
            ERC-1155 can have multiple sellers and quantities — choose the listing you
            want to buy.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[26px] border border-border bg-card p-4 sm:p-5">
          <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.10),transparent_45%),radial-gradient(circle_at_90%_0%,rgba(99,102,241,0.10),transparent_45%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 overflow-hidden rounded-2xl border border-border bg-foreground/5">
                <CardMedia src={img} alt={title} className="absolute inset-0" fit="cover" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm sm:text-base font-semibold truncate">{title}</div>
                  <Badge variant="outline">{nft.standard}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted font-mono truncate">
                  {shortAddr(nft.contract)} · #{nft.tokenId}
                  {nft.collectionName ? <> · {nft.collectionName}</> : null}
                </div>
              </div>
            </div>

            <Link href={nftHref} prefetch={false}>
              <Button variant="outline" className="rounded-full">
                View NFT
              </Button>
            </Link>
          </div>

          <div className="relative mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted">
              <span className="font-semibold text-foreground">{listings.length}</span>{" "}
              active listings
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted">
              Multiple sellers supported
            </span>
          </div>
        </div>

        <div className="mt-6">
          {listings.length === 0 ? (
            <div className="rounded-[26px] border border-border bg-card p-8 text-center">
              <div className="text-sm font-semibold">No active listings</div>
              <div className="mt-1 text-sm text-muted">
                Once sellers list this ERC1155 token, they’ll appear here.
              </div>
            </div>
          ) : (
            <div
              className="
                grid gap-4 sm:gap-6
                grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
                xl:grid-cols-4 2xl:grid-cols-5
              "
            >
              {listings.map((l) => (
                <ListingCard
                  key={l.dbId || `${l.sellerAddress}:${l.priceEtnWei}:${l.txHashCreated || ""}`}
                  nftHref={nftHref}
                  nftTitle={title}
                  img={img}
                  standard={nft.standard}
                  contract={contract}
                  tokenId={tokenId}
                  l={l}
                />
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}