// src/ui/listing/ListingGridClient.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/src/ui/Button";
import { Skeleton } from "@/src/ui/Skeleton";
import CardMedia from "./CardMedia";

type StandardFilter = "ALL" | "ERC721" | "ERC1155";

type Item = {
  id: string;
  dbId: string;
  chainId: string | null;
  href: string;

  nft: {
    contract: string;
    tokenId: string;
    name: string | null;
    image: string | null;
    standard: string;
  };

  quantity: number;
  seller: { address: string | null; username: string | null };
  priceLabel: string;
};

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function shortAddr(a?: string | null) {
  const s = (a ?? "").trim();
  if (!s) return "—";
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function Segmented({
  value,
  onChange,
}: {
  value: StandardFilter;
  onChange: (v: StandardFilter) => void;
}) {
  const opts: Array<{ k: StandardFilter; label: string }> = [
    { k: "ALL", label: "All" },
    { k: "ERC721", label: "ERC-721" },
    { k: "ERC1155", label: "ERC-1155" },
  ];

  return (
    <div className="inline-flex rounded-full border border-border bg-card/60 p-1">
      {opts.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          className={cx(
            "h-9 px-4 rounded-full text-sm font-semibold transition",
            value === o.k
              ? "bg-background text-foreground shadow-[0_1px_0_rgba(255,255,255,0.06)]"
              : "text-muted hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ListingGridClient({
  initialItems,
  initialCursor,
}: {
  initialItems: Item[];
  initialCursor: string | null;
}) {
  const [filter, setFilter] = React.useState<StandardFilter>("ALL");

  const [items, setItems] = React.useState<Item[]>(initialItems);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [loading, setLoading] = React.useState(false);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const loadMore = React.useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/listing/feed?cursor=${encodeURIComponent(cursor)}&take=24`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data?.ok) {
        setItems((prev) => [...prev, ...(data.items as Item[])]);
        setCursor(data.nextCursor ?? null);
      }
    } catch (e) {
      console.error("[ListingGridClient] loadMore error:", e);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  React.useEffect(() => {
    if (!cursor) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) void loadMore();
      },
      { rootMargin: "700px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loading, loadMore]);

  const visible = React.useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((x) => (x.nft.standard ?? "ERC721").toUpperCase() === filter);
  }, [items, filter]);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Segmented value={filter} onChange={setFilter} />

        <div className="text-xs text-muted">
          Showing <span className="text-foreground font-semibold">{visible.length}</span>{" "}
          items
        </div>
      </div>

      <div className="mt-5 sm:mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
        {visible.map((v) => {
          const std = (v.nft.standard ?? "ERC721").toUpperCase();
          const is1155 = std === "ERC1155";

          return (
            <Link key={v.dbId} href={v.href} prefetch={false} className="group block">
              <div
                className={cx(
                  "h-full overflow-hidden rounded-[28px] border border-border bg-card/50",
                  "shadow-[0_1px_0_rgba(255,255,255,0.06)]",
                  "transition will-change-transform",
                  "hover:-translate-y-0.5 hover:bg-card/65 hover:border-foreground/15"
                )}
              >
                <div className="relative aspect-square bg-foreground/5">
                  <CardMedia src={v.nft.image ?? undefined} alt={v.nft.name ?? "NFT"} />

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
      ? `ERC-1155${v.quantity && v.quantity > 1 ? ` × ${v.quantity}` : ""}`
      : "ERC-721"}
  </span>
</div>
                </div>

                <div className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {v.nft.name || `#${v.nft.tokenId}`}
                      </div>
                      <div className="mt-1 text-xs text-muted truncate">
                        Seller{" "}
                        <span className="text-foreground/80">
                          {v.seller.username ?? shortAddr(v.seller.address)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[11px] text-muted">Price</div>
                      <div className="text-sm font-semibold">{v.priceLabel}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {loading &&
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`sk-${i}`}
              className="overflow-hidden rounded-[28px] border border-border bg-card/40"
            >
              <Skeleton className="aspect-square w-full" />
              <div className="p-4">
                <Skeleton className="h-4 w-3/5 rounded-lg" />
                <Skeleton className="mt-2 h-3 w-2/5 rounded-lg" />
              </div>
            </div>
          ))}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {cursor ? (
        <div className="mt-6 flex items-center justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={loading} className="rounded-full px-6">
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : (
        <div className="mt-8 text-center text-xs text-muted">You’re all caught up.</div>
      )}
    </>
  );
}