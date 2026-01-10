/* eslint-disable @typescript-eslint/no-explicit-any */
// app/collections/[contract]/ui/CollectionHeader.tsx
import Image from "next/image";
import Link from "next/link";
import CopyButton from "./CopyButton";

type HeaderDTO = {
  name?: string | null;
  description?: string | null;
  contract: string;
  logoUrl?: string | null;
  coverUrl?: string | null;

  website?: string | null;
  instagram?: string | null;
  x?: string | null;
  discord?: string | null;
  telegram?: string | null;

  floorPrice?: number | null;
  volume?: number | null;

  supply?: number | null;
  itemsCount?: number | null;
  ownersCount?: number | null;

  listingActiveCount?: number | null;
  auctionActiveCount?: number | null;

  rarityEnabled?: boolean | null;
  rarityPopulation?: number | null;
};

function compact(n: any) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  // compact notation but still “premium”
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: v < 10 ? 2 : 1,
  }).format(v);
}

function fmt2(n: any) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(v);
}

function shortAddr(a: string) {
  if (!a) return "";
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function SocialLink({ href, label }: { href?: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background/60"
    >
      {label}
    </a>
  );
}

export default function CollectionHeader({ header }: { header: HeaderDTO }) {
  const name = header.name ?? "Collection";
  const items = header.itemsCount ?? header.supply ?? null;

  return (
    <div className="relative">
      {/* Cover */}
      <div className="relative h-55 w-full overflow-hidden sm:h-70">
        {header.coverUrl ? (
          <Image
            src={header.coverUrl}
            alt={name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(77,238,84,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]" />
        )}

        {/* Darken / soften */}
        <div className="absolute inset-0 bg-linear-to-b from-black/35 via-black/30 to-background" />
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="-mt-10 rounded-[28px] border border-border bg-card/80 p-5 backdrop-blur md:-mt-14 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-border bg-background md:h-20 md:w-20">
                {header.logoUrl ? (
                  <Image
                    src={header.logoUrl}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold md:text-2xl">
                    {name}
                  </h1>

                  {header.rarityEnabled ? (
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold">
                      Rarity: {compact(header.rarityPopulation ?? 0)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="rounded-full border border-border bg-background px-2 py-1 text-xs">
                    {shortAddr(header.contract)}
                  </span>
                  <CopyButton value={header.contract} />

                  <Link
                    href="/collections"
                    className="text-xs underline decoration-border underline-offset-4 hover:decoration-foreground/40"
                  >
                    Browse collections
                  </Link>
                </div>

                <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {header.description || "—"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <SocialLink href={header.website} label="Website" />
                  <SocialLink href={header.x} label="X" />
                  <SocialLink href={header.discord} label="Discord" />
                  <SocialLink href={header.telegram} label="Telegram" />
                  <SocialLink href={header.instagram} label="Instagram" />
                </div>
              </div>
            </div>

            {/* Premium stats pills */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:w-105">
              <Stat label="Floor" value={header.floorPrice != null ? fmt2(header.floorPrice) : "—"} suffix="ETN" />
              <Stat label="Volume" value={header.volume != null ? compact(header.volume) : "—"} suffix="ETN" />
              <Stat label="Items" value={items != null ? compact(items) : "—"} />
              <Stat label="Owners" value={header.ownersCount != null ? compact(header.ownersCount) : "—"} />
              <Stat label="Listed" value={header.listingActiveCount != null ? compact(header.listingActiveCount) : "—"} />
              <Stat label="Auctions" value={header.auctionActiveCount != null ? compact(header.auctionActiveCount) : "—"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-base font-semibold">{value}</div>
        {suffix ? <div className="text-[11px] text-muted-foreground">{suffix}</div> : null}
      </div>
    </div>
  );
}
