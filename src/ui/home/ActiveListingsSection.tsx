// src/ui/home/ActiveListingsSection.tsx
import * as React from "react";
import Link from "next/link";
import { Container } from "@/src/ui/Container";
import CardMedia from "@/src/components/shared/CardMedia";
import {
  getActiveListingsCached,
  type ActiveListingFeedItem,
} from "@/src/lib/server/listings/getActiveListings";

function shorten(addr: string) {
  const a = addr?.toLowerCase?.() ?? "";
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function SectionHeader({
  title,
  desc,
  href,
  cta = "View all",
}: {
  title: string;
  desc: string;
  href: string;
  cta?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="max-w-2xl">
        <div className="text-xs font-semibold text-muted">Market</div>
        <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">{desc}</p>
      </div>

      <Link
        href={href}
        className="
          hidden sm:inline-flex h-10 items-center rounded-full
          border border-border bg-card px-4 text-sm font-semibold
          hover:bg-card/80 hover:border-foreground/15 transition
        "
      >
        {cta}
      </Link>
    </div>
  );
}

function ListingsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-border bg-card/50 overflow-hidden"
        >
          <div className="aspect-square w-full animate-pulse bg-foreground/5" />
          <div className="p-3 sm:p-4">
            <div className="h-4 w-3/5 animate-pulse rounded bg-foreground/5" />
            <div className="mt-2 h-3 w-2/5 animate-pulse rounded bg-foreground/5" />
            <div className="mt-4 h-4 w-24 animate-pulse rounded bg-foreground/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListingCard({ v }: { v: ActiveListingFeedItem }) {
  const std = (v.nft.standard ?? "ERC721").toUpperCase();
  const is1155 = std === "ERC1155";
  const title = v.nft.name || "Untitled";
  const img = v.nft.image || undefined;

  const sellerAddr = v.sellerAddress ?? v.seller.address ?? "";
  const sellerLabel = sellerAddr ? shorten(sellerAddr) : "Unknown";

  return (
    <Link key={v.id} href={v.href} prefetch={false} className="group block">
      <div
        className="
          h-full rounded-3xl border border-border bg-card/50
          overflow-hidden transition-all duration-200
          hover:-translate-y-0.5 hover:shadow-lg
        "
      >
        <div className="relative aspect-square bg-foreground/5">
          <CardMedia src={img} alt={title} className="absolute inset-0" />

          {/* ✅ badge that always pops (both themes) */}
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
              {is1155
                ? `ERC-1155${v.quantity > 1 ? ` × ${v.quantity}` : ""}`
                : "ERC-721"}
            </span>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/40 to-transparent" />
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{title}</div>
              <div className="text-xs text-muted truncate">
                Seller {sellerLabel}
              </div>
            </div>
            <div className="text-right text-sm font-semibold shrink-0">
              {v.priceLabel}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

async function ListingsData({ limit }: { limit: number }) {
  const { items } = await getActiveListingsCached({ take: limit });

  if (!items.length) {
    return (
      <div className="mt-6 rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted">
        No active listings right now.
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {items.map((v) => (
        <ListingCard key={v.id} v={v} />
      ))}
    </div>
  );
}

export default function ActiveListingsSection({ limit = 10 }: { limit?: number }) {
  return (
    <section className="py-10 sm:py-14">
      <Container>
        <SectionHeader
          title="Listings"
          desc="Fresh fixed-price listings across ERC-721 and ERC-1155."
          href="/listings"
        />

        <React.Suspense fallback={<ListingsSkeleton cards={limit} />}>
          <ListingsData limit={limit} />
        </React.Suspense>

        {/* mobile CTA */}
        <div className="mt-6 sm:hidden">
          <Link
            href="/listings"
            className="
              inline-flex h-11 w-full items-center justify-center rounded-2xl
              border border-border bg-card px-5 text-sm font-semibold
              hover:bg-card/80 transition
            "
          >
            View all listings
          </Link>
        </div>
      </Container>
    </section>
  );
}