"use client";

import React from "react";
import Link from "next/link";

import { Container } from "@/src/ui/Container";
import AuctionGrid, { type AuctionGridItem } from "./AuctionGrid";

type InitialPage = {
  items: AuctionGridItem[];
  nextCursor: string | null;
};

type SortKey = "endingSoon" | "newest";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function LivePill() {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] md:text-xs font-semibold",
        "ring-1 shadow-sm backdrop-blur-md text-white",
        // ✅ Light mode: strong contrast pill
        "bg-foreground text-background ring-black/10",
        // ✅ Dark mode: glass pill
        "dark:bg-white/10 dark:text-white dark:ring-white/15"
      )}
    >
      LIVE
    </span>
  );
}

export default function AuctioningNowComponent({
  initialPage = { items: [], nextCursor: null },
}: {
  initialPage?: InitialPage;
}) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("endingSoon");

  const filteredInitial = React.useMemo<InitialPage>(() => {
    const q = query.trim().toLowerCase();
    const base = initialPage.items ?? [];

    const filtered = q
      ? base.filter((it) => {
          const name = (it.nft?.name ?? "").toLowerCase();
          const contract = (it.nft?.contract ?? "").toLowerCase();
          const tokenId = String(it.nft?.tokenId ?? "");
          return name.includes(q) || contract.includes(q) || tokenId.includes(q);
        })
      : base;

    const sorted =
      sort === "newest"
        ? [...filtered].sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime))
        : [...filtered].sort((a, b) => +new Date(a.endTime) - +new Date(b.endTime));

    return { items: sorted, nextCursor: initialPage.nextCursor ?? null };
  }, [initialPage, query, sort]);

  const liveCount = initialPage.items?.length ?? 0;

  return (
    <Container size="xl" className="py-6 md:py-10">
      {/* Breadcrumb */}
      <nav className="mb-5 text-sm text-muted">
        <Link className="hover:underline" href="/">
          Home
        </Link>
        <span className="mx-2 opacity-60">/</span>
        <span className="text-foreground/80">Auctions</span>
      </nav>

      {/* Header */}
      <section className="relative overflow-hidden rounded-[28px] border border-border">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_15%_10%,rgba(56,189,248,0.14),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_85%_90%,rgba(168,85,247,0.14),transparent_60%)]" />
          <div className="absolute inset-0 [background:linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.04)_45%,rgba(0,0,0,0.08)_100%)] dark:[background:linear-gradient(180deg,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0.30)_45%,rgba(0,0,0,0.65)_100%)]" />
        </div>

        <div className="relative p-5 md:p-7">
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-2">
              <LivePill />
              <span className="text-xs text-muted-foreground">
                {liveCount > 0 ? `${liveCount.toLocaleString()} auctions loaded` : "No live auctions right now"}
              </span>
            </div>

            <h1 className="font-semibold tracking-tight text-[1.55rem] md:text-[2.1rem]">
              Live Auctions
            </h1>

            <p className="text-sm md:text-[15px] text-muted-foreground max-w-[70ch] leading-relaxed">
              Bid in real-time on timed auctions. Fast refresh, smooth UX, and low fees on Electroneum (ETN).
            </p>

            {/* Toolbar */}
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, contract, or token ID…"
                  className={cx(
                    "h-11 w-full rounded-2xl border border-border bg-background/75 px-4 text-sm outline-none",
                    "focus:ring-2 focus:ring-foreground/10"
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground hidden sm:block">Sort:</div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className={cx(
                    "h-11 rounded-2xl border border-border bg-background/75 px-3 text-sm outline-none",
                    "focus:ring-2 focus:ring-foreground/10"
                  )}
                >
                  <option value="endingSoon">Ending soon</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <div className="mt-8">
        <AuctionGrid initialPage={filteredInitial} sort={sort} query={query} />
      </div>
    </Container>
  );
}