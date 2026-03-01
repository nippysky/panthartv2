/* eslint-disable react-hooks/exhaustive-deps */
// app/minting-now/MintingNowClient.tsx
"use client";

import * as React from "react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/src/ui/Button";
import { cn } from "@/src/lib/utils";
import type { MintingNowItem } from "@/src/types/minting-now";
import MintingCardSkeleton from "@/src/components/shared/MintingCardSkeleton";
import MintingCard from "@/src/components/shared/MintCard";

type PagePayload = { items: MintingNowItem[]; nextCursor: string | null };

const PAGE_SIZE = 20;

const fetcher = async (url: string): Promise<PagePayload> => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return { items: [], nextCursor: null };
  const j = (await r.json()) as PagePayload;
  return {
    items: Array.isArray(j?.items) ? j.items : [],
    nextCursor: j?.nextCursor ?? null,
  };
};

function keyOf(item: MintingNowItem) {
  return `${item.kind}:${item.id}`;
}

export default function MintingNowClient({ initialPage }: { initialPage: PagePayload }) {
  const getKey = (pageIndex: number, prev: PagePayload | null) => {
    if (prev && !prev.nextCursor) return null;

    const p = new URLSearchParams();
    p.set("limit", String(PAGE_SIZE));
    if (pageIndex > 0 && prev?.nextCursor) p.set("cursor", prev.nextCursor);

    return `/api/minting-now?${p.toString()}`;
  };

  const { data, isLoading, isValidating, size, setSize } = useSWRInfinite<PagePayload>(
    getKey,
    fetcher,
    {
      persistSize: true,
      revalidateFirstPage: false,
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      fallbackData: initialPage ? [initialPage] : undefined,
    }
  );

  const pages = data ?? [];
  const rawItems = React.useMemo(() => pages.flatMap((p) => p.items ?? []), [pages]);

  const items = React.useMemo(() => {
    const map = new Map<string, MintingNowItem>();
    for (const it of rawItems) map.set(keyOf(it), it);
    return Array.from(map.values());
  }, [rawItems]);

  const hasMore = pages.length > 0 ? Boolean(pages[pages.length - 1]?.nextCursor) : false;

  // Auto-load sentinel
  const moreRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!hasMore) return;
    const el = moreRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setSize((s) => s + 1);
      },
      { rootMargin: "600px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, setSize]);

  const showSkeleton = (isLoading || isValidating) && items.length === 0;

  // ✅ Use the same grid spacing everywhere (skeleton + real list)
  const gridClass =
    "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 " +
    "gap-3 sm:gap-4 lg:gap-5 " +
    "mt-2 mb-12";

  if (showSkeleton) {
    return (
      <section className={cn(gridClass, "mb-20")}>
        {Array.from({ length: 10 }).map((_, i) => (
          <MintingCardSkeleton key={i} />
        ))}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing is minting right now. New drops appear here the moment they go live.
      </div>
    );
  }

  return (
    <>
      <section className={gridClass}>
        {items.map((item) => (
          <MintingCard
            key={keyOf(item)}
            item={item}
            mediaPreference="logo"
            layoutVariant="square"
            compact={false}
          />
        ))}
      </section>

      <div className="flex justify-center pb-16">
        {hasMore ? (
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="outline"
              className={cn("h-11 rounded-2xl px-5", isValidating ? "opacity-70" : "")}
              onClick={() => setSize(size + 1)}
              disabled={isValidating}
            >
              {isValidating ? "Loading…" : "Load more"}
            </Button>
            <div ref={moreRef} className="h-10 w-10" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No more results.</p>
        )}
      </div>
    </>
  );
}