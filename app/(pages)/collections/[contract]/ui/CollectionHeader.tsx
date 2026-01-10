/* eslint-disable @typescript-eslint/no-explicit-any */
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

  ownerAddress?: string | null;

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

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function safeUrl(u?: string | null) {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function shortAddr(a: string) {
  if (!a) return "";
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function compact(n: any) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: v < 10 ? 2 : 1,
  }).format(v);
}

function fmt2(n: any) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
}

function SocialPill({ href, label }: { href?: string | null; label: string }) {
  const u = safeUrl(href);
  if (!u) return null;
  return (
    <a
      href={u}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
    >
      {label}
    </a>
  );
}

function Stat({
  label,
  value,
  suffix,
  subtle,
}: {
  label: string;
  value: string;
  suffix?: string;
  subtle?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-border bg-background/70 p-3",
        subtle && "bg-background/50"
      )}
    >
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-base font-semibold tracking-[-0.01em]">{value}</div>
        {suffix ? <div className="text-[11px] text-muted-foreground">{suffix}</div> : null}
      </div>
    </div>
  );
}

export default function CollectionHeader({
  header,
  actionsSlot,
}: {
  header: HeaderDTO;
  actionsSlot?: React.ReactNode;
}) {
  const name = header.name ?? "Collection";
  const items = header.itemsCount ?? header.supply ?? null;

  const links = [
    header.website ? { k: "website", label: "Website", href: header.website } : null,
    header.x ? { k: "x", label: "X", href: header.x } : null,
    header.discord ? { k: "discord", label: "Discord", href: header.discord } : null,
    header.telegram ? { k: "telegram", label: "Telegram", href: header.telegram } : null,
    header.instagram ? { k: "instagram", label: "Instagram", href: header.instagram } : null,
  ].filter(Boolean) as Array<{ k: string; label: string; href: string }>;

  const desc = (header.description ?? "").trim();
  const showToggle = desc.length > 220;

  return (
    <div className="relative">
      <div className="relative h-44 w-full overflow-hidden sm:h-60 md:h-72">
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
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(77,238,84,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent)]" />
        )}

        <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/25 to-background" />
        <div className="absolute inset-0 [background:radial-gradient(900px_circle_at_30%_18%,rgba(77,238,84,0.12),transparent_55%)]" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="-mt-9 rounded-[28px] border border-border bg-card/75 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:-mt-12 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span className="opacity-60">/</span>
            <Link href="/collections" className="hover:text-foreground">
              Collections
            </Link>
            <span className="opacity-60">/</span>
            <span className="text-foreground/90 wrap-break-word">{name}</span>
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-background sm:h-16 sm:w-16 md:h-20 md:w-20">
                {header.logoUrl ? (
                  <Image
                    src={header.logoUrl}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="80px"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted" />
                )}
              </div>

              <div className="min-w-0">
                <h1 className="text-[20px] font-semibold tracking-[-0.02em] sm:text-[24px] md:text-[28px] wrap-break-word">
                  {name}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs">
                    {shortAddr(header.contract)}
                  </span>
                  <CopyButton value={header.contract} />
                </div>

                {desc ? (
                  <div className="mt-3 max-w-2xl">
                    {showToggle ? (
                      <details className="group">
                        <p className="text-sm leading-relaxed text-muted-foreground wrap-break-word line-clamp-4 group-open:line-clamp-none">
                          {desc}
                        </p>
                        <summary className="mt-2 cursor-pointer list-none text-sm font-semibold text-foreground/90 hover:opacity-90">
                          <span className="group-open:hidden">Read more</span>
                          <span className="hidden group-open:inline">Read less</span>
                        </summary>
                      </details>
                    ) : (
                      <p className="text-sm leading-relaxed text-muted-foreground wrap-break-word">
                        {desc}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">—</p>
                )}

                {links.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {links.slice(0, 5).map((l) => (
                      <SocialPill key={l.k} href={l.href} label={l.label} />
                    ))}
                  </div>
                ) : null}

                {actionsSlot ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {actionsSlot}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:w-105">
              <Stat
                label="Floor"
                value={header.floorPrice != null ? fmt2(header.floorPrice) : "—"}
                suffix="ETN"
              />
              <Stat
                label="Volume"
                value={header.volume != null ? compact(header.volume) : "—"}
                suffix="ETN"
              />
              <Stat label="Items" value={items != null ? compact(items) : "—"} />
              <Stat label="Owners" value={header.ownersCount != null ? compact(header.ownersCount) : "—"} subtle />
              <Stat label="Listed" value={header.listingActiveCount != null ? compact(header.listingActiveCount) : "—"} subtle />
              <Stat label="Auctions" value={header.auctionActiveCount != null ? compact(header.auctionActiveCount) : "—"} subtle />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
