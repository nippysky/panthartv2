/* eslint-disable @typescript-eslint/no-explicit-any */
// src/ui/home/LiveAuctionsSection.tsx
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { ArrowRight, Gavel } from "lucide-react";

import { Container } from "@/src/ui/Container";
import { Button } from "@/src/ui/Button";
import { Badge } from "@/src/ui/Badge";
import LiveEta from "./LiveETA";

type WindowKey = "24h" | "7d" | "30d";

type ActiveAuctionItem = {
  id: string; // chain auction id (string)
  dbId?: string | null; // DB id for /auction-now/[id]
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
  };
  seller: { address: string | null; username: string | null };
  bidsCount: number | null;
};

function formatInt(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

async function fetchActiveAuctions(limit: number): Promise<{
  items: ActiveAuctionItem[];
  now: number;
  ok: boolean;
}> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) return { items: [], now: Date.now(), ok: false };

  const url = `${proto}://${host}/api/auction/active?limit=${encodeURIComponent(
    String(limit)
  )}&chain=1`;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return { items: [], now: Date.now(), ok: false };

  const j = (await res.json().catch(() => null)) as any;
  const items = Array.isArray(j?.items) ? (j.items as ActiveAuctionItem[]) : [];
  return { items, now: Date.now(), ok: true };
}

function EmptyState({ ok }: { ok: boolean }) {
  return (
    <div className="mt-6 rounded-[28px] border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted">Market</div>
          <div className="mt-1 text-lg sm:text-xl font-semibold tracking-tight">
            {ok ? "No live auctions yet" : "Live auctions unavailable"}
          </div>
          <div className="mt-1 text-sm text-muted">
            {ok
              ? "When auctions go live, they’ll appear here instantly. Meanwhile, explore listings and collections."
              : "We couldn’t load auctions right now. Try again shortly."}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
          <Link href="/collections" className="w-full sm:w-auto">
            <Button variant="secondary" size="sm" className="w-full sm:w-auto gap-2">
              Explore collections <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/auction-now" className="w-full sm:w-auto">
            <Button size="sm" className="w-full sm:w-auto gap-2">
              View auctions <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function AuctionCard({ a, now }: { a: ActiveAuctionItem; now: number }) {
  const href = a.dbId ? `/auction-now/${a.dbId}` : `/auction-now/${a.id}`;

  const bids = Math.max(0, a.bidsCount ?? 0);
  const hasBids = bids > 0;

  const startPriceLine =
    a.price?.start && a.currency?.symbol
      ? `${a.price.start} ${a.currency.symbol}`
      : a.price?.current && a.currency?.symbol
      ? `${a.price.current} ${a.currency.symbol}`
      : "—";

  const currentBidLine =
    hasBids && a.price?.current && a.currency?.symbol
      ? `${a.price.current} ${a.currency.symbol}`
      : "—";

  const valueLabel = hasBids ? "Current bid" : "Start price";
  const valueLine = hasBids ? currentBidLine : startPriceLine;

  return (
    <Link
      href={href}
      className="group rounded-[28px] border border-border bg-card overflow-hidden hover:bg-card/80 transition"
    >
      <div className="relative h-44 w-full bg-foreground/5">
        {a.nft.image ? (
          <Image
            src={a.nft.image}
            alt={a.nft.name}
            fill
            sizes="(max-width: 1024px) 92vw, 320px"
            className="object-cover"
            priority={false}
          />
        ) : null}

        <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_45%)]" />
        <div className="absolute inset-0 pointer-events-none bg-linear-to-t from-black/18 via-transparent to-transparent dark:from-black/28" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          {a.isLive ? (
            <Badge
              variant="soft"
              className="gap-2 border border-black/10 bg-white/94 text-foreground shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-black/58 dark:text-white"
            >
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              Live
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border border-black/10 bg-white/94 text-foreground shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-black/58 dark:text-white"
            >
              Scheduled
            </Badge>
          )}
        </div>

        <div className="absolute right-3 top-3">
          <Badge
            variant="outline"
            className="border border-black/10 bg-white/94 text-foreground shadow-sm backdrop-blur-md dark:border-white/12 dark:bg-black/58 dark:text-white"
          >
            <LiveEta endISO={a.endTime} nowMs={now} prefix="" />
          </Badge>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground group-hover:opacity-90 transition">
            {a.nft.name}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
            <span className="font-mono">
              {a.nft.contract.slice(0, 6)}…{a.nft.contract.slice(-4)} #{a.nft.tokenId}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] text-muted">{valueLabel}</div>
            <div className="truncate text-sm font-semibold">{valueLine}</div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[11px] text-muted">Bids</div>
            <div className="text-sm font-semibold">{formatInt(bids)}</div>
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

export default async function LiveAuctionsSection({
  limit = 4,
}: {
  windowKey: WindowKey;
  limit?: number;
}) {
  const { items, now, ok } = await fetchActiveAuctions(Math.max(4, limit));

  return (
    <section className="pt-10 sm:pt-14">
      <Container>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-muted">Market</div>
            <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">Live auctions</h2>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">

            <Link href="/auction-now">
              <Button variant="secondary" size="sm" className="gap-2">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState ok={ok} />
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {items.slice(0, limit).map((a) => (
              <AuctionCard key={(a.dbId ?? a.id) as string} a={a} now={now} />
            ))}
          </div>
        )}

        <div className="mt-6 text-xs text-muted">
          <Link href="/auction-now" className="hover:underline underline-offset-4">
            See all live auctions →
          </Link>
        </div>
      </Container>
    </section>
  );
}