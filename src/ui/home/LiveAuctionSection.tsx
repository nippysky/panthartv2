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
import { Skeleton } from "@/src/ui/Skeleton";
import LiveEta from "./LiveETA";


type WindowKey = "24h" | "7d" | "30d";

type ActiveAuctionItem = {
  id: string; // chain auction id (string)
  dbId?: string | null; // ✅ DB id for /auction-now/[id]
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

async function fetchActiveAuctions(limit: number): Promise<{ items: ActiveAuctionItem[]; now: number }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) return { items: [], now: Date.now() };

  const url = `${proto}://${host}/api/auction/active?limit=${encodeURIComponent(String(limit))}&chain=1`;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return { items: [], now: Date.now() };

  const j = (await res.json().catch(() => null)) as any;
  const items = Array.isArray(j?.items) ? (j.items as ActiveAuctionItem[]) : [];
  return { items, now: Date.now() };
}

function LiveAuctionsFallback({ cards = 4 }: { cards?: number }) {
  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="rounded-[28px] border border-border bg-card overflow-hidden"
        >
          <Skeleton className="h-44 w-full" />
          <div className="p-4 sm:p-5">
            <Skeleton className="h-4 w-[75%] rounded-lg" />
            <Skeleton className="mt-2 h-3 w-[55%] rounded-lg" />
            <div className="mt-5 flex items-center justify-between">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuctionCard({
  a,
  now,
}: {
  a: ActiveAuctionItem;
  now: number;
}) {
  const href = a.dbId ? `/auction-now/${a.dbId}` : `/auction-now/${a.id}`; // ✅ FIX ROUTING

  const priceLine =
    a.price?.current && a.currency?.symbol ? `${a.price.current} ${a.currency.symbol}` : "—";

  const bids = a.bidsCount ?? 0;

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

        <div className="absolute left-3 top-3 flex items-center gap-2">
          {a.isLive ? (
            <Badge variant="soft" className="gap-2">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline">Scheduled</Badge>
          )}
        </div>

        <div className="absolute right-3 top-3">
          <Badge variant="outline" className="gap-2">
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
            <div className="text-[11px] text-muted">Current</div>
            <div className="truncate text-sm font-semibold">{priceLine}</div>
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
  // windowKey kept for layout consistency; can be used later (e.g. sorting)
  const { items, now } = await fetchActiveAuctions(Math.max(4, limit));

  const live = items.filter((x) => x.isLive);

  return (
    <section className="pt-10 sm:pt-14">
      <Container>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-muted">Market</div>
            <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
              Live auctions
            </h2>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Badge variant="outline">{live.length} live</Badge>

            <Link href="/auction-now">
              <Button variant="secondary" size="sm" className="gap-2">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <LiveAuctionsFallback cards={Math.min(4, limit)} />
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