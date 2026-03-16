// src/ui/home/MintingNowSection.tsx
import * as React from "react";
import Link from "next/link";
import { Container } from "@/src/ui/Container";
import { unstable_cache } from "next/cache";

import MintingCard from "@/src/components/shared/MintCard";
import MintingCardSkeleton from "@/src/components/shared/MintingCardSkeleton";
import { getMintingNowPage } from "@/src/lib/server/minting-now";
import type { MintingNowItem } from "@/src/types/minting-now";

const getMintingNowCached = unstable_cache(
  async (limit: number) => getMintingNowPage({ limit, cursor: null }),
  ["panth:minting-now:home"],
  { revalidate: 20 }
);

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
        <div className="text-xs font-semibold text-muted">Discover</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>
      </div>

      <Link
        href={href}
        className="
          hidden sm:inline-flex h-10 items-center rounded-full
          border border-border bg-card px-4 text-sm font-semibold
          transition hover:border-foreground/15 hover:bg-card/80
        "
      >
        {cta}
      </Link>
    </div>
  );
}

async function MintingData({ limit }: { limit: number }) {
  let items: MintingNowItem[] = [];

  try {
    const page = await getMintingNowCached(limit);
    items = page.items ?? [];
  } catch {
    items = [];
  }

  if (!items.length) {
    return (
      <div className="mt-6 rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted">
        Nothing is minting right now. New drops appear the moment they go live.
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.slice(0, limit).map((item) => (
        <MintingCard
          key={`${item.kind}:${item.id}`}
          item={item}
          mediaPreference="logo-strict"
          layoutVariant="square"
          compact={false}
        />
      ))}
    </div>
  );
}

function MintingSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <MintingCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function MintingNowSection({ limit = 4 }: { limit?: number }) {
  return (
    <section className="py-10 sm:py-14">
      <Container>
        <SectionHeader
          title="Minting now"
          desc="Drops and presales currently live — join while supply lasts."
          href="/minting-now"
        />

        <React.Suspense fallback={<MintingSkeleton cards={limit} />}>
          <MintingData limit={limit} />
        </React.Suspense>

        <div className="mt-6 sm:hidden">
          <Link
            href="/minting-now"
            className="
              inline-flex h-11 w-full items-center justify-center rounded-2xl
              border border-border bg-card px-5 text-sm font-semibold
              transition hover:bg-card/80
            "
          >
            View all minting now
          </Link>
        </div>
      </Container>
    </section>
  );
}