/* eslint-disable @typescript-eslint/no-explicit-any */
// src/ui/home/MarketHeroStrip.tsx
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { ArrowRight, Gavel, Timer } from "lucide-react";

import { Container } from "@/src/ui/Container";
import { Button } from "@/src/ui/Button";
import { Badge } from "@/src/ui/Badge";
import TopCollectionsFilters from "@/src/ui/home/TopCollectionsFilters";
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
    current: string | null; // decimal string
  };
  seller: { address: string | null; username: string | null };
  bidsCount: number | null;
};

function safeNum(x: unknown, fallback = 0) {
  const n = typeof x === "number" ? x : Number(String(x ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

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

function Pill({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-full border border-border bg-card/70 px-3 py-2 backdrop-blur sm:px-4">
      <div className="flex items-center gap-2">
        {icon ? <span className="text-muted">{icon}</span> : null}
        <span className="text-[11px] font-semibold text-muted">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}

function SpotlightEmpty({
  liveCount,
  endingSoonCount,
  totalBids,
  ok,
}: {
  liveCount: number;
  endingSoonCount: number;
  totalBids: number;
  ok: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-muted">Spotlight</div>
        <div className="mt-1 text-sm sm:text-base font-semibold text-foreground">
          {ok ? "No live auctions right now" : "Auctions are taking a moment"}
        </div>
        <div className="mt-1 text-xs text-muted">
          {ok
            ? "Check back soon — or explore collections and listings in the meantime."
            : "Refresh in a bit — or keep exploring while we reconnect."}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-card/70 px-2 py-1 text-[11px] text-muted">
            Live: {liveCount}
          </span>
          <span className="rounded-full border border-border bg-card/70 px-2 py-1 text-[11px] text-muted">
            Ending ≤ 1h: {endingSoonCount}
          </span>
          <span className="rounded-full border border-border bg-card/70 px-2 py-1 text-[11px] text-muted">
            Bids today: {formatInt(totalBids)}
          </span>
        </div>
      </div>

      {/* ✅ No duplicate “Explore / View auctions” buttons here,
          because the right-side Explore cards already handle that. */}
      <div className="sm:ml-auto flex items-center gap-2">
        <Badge variant="outline" className="gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
          Live
        </Badge>
      </div>
    </div>
  );
}

export default async function MarketHeroStrip({ windowKey }: { windowKey: WindowKey }) {
  const { items, now, ok } = await fetchActiveAuctions(18);

  const live = items.filter((x) => x.isLive);

  const liveCount = live.length;

  const endingSoonCount = live.filter((x) => {
    const end = new Date(x.endTime).getTime();
    return Number.isFinite(end) && end - now <= 60 * 60 * 1000; // <= 1 hour
  }).length;

  const totalBids = live.reduce((acc, x) => acc + safeNum(x.bidsCount, 0), 0);

  const nextEnding = (() => {
    let best: ActiveAuctionItem | null = null;
    let bestMs = Number.POSITIVE_INFINITY;

    for (const a of live) {
      const end = new Date(a.endTime).getTime();
      if (!Number.isFinite(end)) continue;
      const dt = end - now;
      if (dt > 0 && dt < bestMs) {
        bestMs = dt;
        best = a;
      }
    }
    return best;
  })();

  // Spotlight: prefer live -> else any
  const spotlight = live[0] ?? items[0] ?? null;

  // route uses dbId when available
  const spotlightHref = spotlight?.dbId
    ? `/auction-now/${spotlight.dbId}`
    : spotlight
    ? `/auction-now/${spotlight.id}`
    : "/auction-now";

  const priceLine =
    spotlight?.price?.current && spotlight?.currency?.symbol
      ? `${spotlight.price.current} ${spotlight.currency.symbol}`
      : "—";

  return (
    <section className="pt-2 sm:pt-4">
      <Container>
        <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-5 sm:p-7">
          {/* subtle premium radials */}
          <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.14),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.10),transparent_50%)]" />

          <div className="relative flex flex-col gap-5 sm:gap-6">
            {/* Top row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="soft" className="gap-2">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live
                </Badge>
              </div>

              {/* ✅ Fully fluid on mobile */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <div className="min-w-0">
                  <TopCollectionsFilters active={windowKey} />
                </div>

                <Link href="/auction-now" className="sm:shrink-0">
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto gap-2">
                    View auctions <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Pills */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5 mt-3">
              <Pill label="Live auctions" value={liveCount} icon={<Gavel className="h-4 w-4" />} />
              <Pill label="Ending ≤ 1h" value={endingSoonCount} icon={<Timer className="h-4 w-4" />} />
              <Pill label="Bids today" value={formatInt(totalBids)} />
              <Pill
                label="Next ending"
                value={
                  nextEnding ? (
                    <LiveEta
                      endISO={nextEnding.endTime}
                      nowMs={now}
                      className="text-sm font-semibold text-foreground"
                    />
                  ) : (
                    "—"
                  )
                }
              />
            </div>

            {/* Spotlight + Actions */}
            <div className="mt-3 sm:mt-0 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
              {/* Spotlight */}
              <div className="lg:col-span-7 rounded-3xl border border-border bg-background/40 p-4 sm:p-5">
                {spotlight ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-foreground/5">
                        {spotlight.nft.image ? (
                          <Image
                            src={spotlight.nft.image}
                            alt={spotlight.nft.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-muted">Spotlight</div>
                        <div className="mt-1 truncate text-sm sm:text-base font-semibold text-foreground">
                          {spotlight.nft.name}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="rounded-full border border-border bg-card/70 px-2 py-1">
                            {spotlight.isLive ? "Live" : "Scheduled"}
                          </span>

                          <span className="rounded-full border border-border bg-card/70 px-2 py-1">
                            <LiveEta endISO={spotlight.endTime} nowMs={now} prefix="Ends " />
                          </span>

                          <span className="rounded-full border border-border bg-card/70 px-2 py-1">
                            {priceLine}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ✅ Wrap-safe button */}
                    <div className="sm:ml-auto w-full sm:w-auto">
                      <Link href={spotlightHref}>
                        <Button size="sm" className="w-full sm:w-auto gap-2">
                          Bid now <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <SpotlightEmpty
                    liveCount={liveCount}
                    endingSoonCount={endingSoonCount}
                    totalBids={totalBids}
                    ok={ok}
                  />
                )}
              </div>

              {/* Actions (mini cards) */}
              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Link
                  href="/collections"
                  className="rounded-3xl border border-border bg-background/40 p-4 sm:p-5 hover:bg-background/60 transition"
                >
                  <div className="text-xs font-semibold text-muted">Explore</div>
                  <div className="mt-1 text-sm font-semibold">Collections</div>
                  <div className="mt-2 text-[11px] text-muted">Leaderboard + floors</div>
                </Link>

                <Link
                  href="/auction-now"
                  className="rounded-3xl border border-border bg-background/40 p-4 sm:p-5 hover:bg-background/60 transition"
                >
                  <div className="text-xs font-semibold text-muted">Explore</div>
                  <div className="mt-1 text-sm font-semibold">Auctions</div>
                  <div className="mt-2 text-[11px] text-muted">Ending soon, live</div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="h-3 sm:h-5" />
      </Container>
    </section>
  );
}