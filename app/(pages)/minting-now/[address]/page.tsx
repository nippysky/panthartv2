// app/(pages)/minting-now/[address]/page.tsx
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/src/ui/Container";
import { fetchMintDetails } from "@/src/lib/server/mint-details";
import type { MintDetails } from "@/src/lib/server/mint-details";

import MintActionClient from "./MintActionClient";
import NFTItemsTab from "@/src/components/shared/NFTitemsTab";


type PageContext = { params: Promise<{ address: string }> };

function ipfsToHttp(uri?: string | null) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    const gw = (process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com/ipfs/").replace(/\/?$/, "/");
    return gw + uri.slice(7);
  }
  return uri;
}

function formatInTZ(iso: string, tz = "Africa/Lagos") {
  const d = new Date(iso);
  const dt = new Intl.DateTimeFormat("en-NG", {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const parts: Record<string, string> = {};
  for (const p of dt) parts[p.type] = p.value;

  return `${parts.month} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute} WAT`;
}



export async function generateMetadata(ctx: PageContext): Promise<Metadata> {
  const { address } = await ctx.params;

  try {
    const details = await fetchMintDetails(address);
    if (!details) return { title: "Mint NFT | Panthart" };

    const name = details?.name || "Mint NFT";
    const title = `Mint ${name} | Panthart`;

    const desc =
      details?.description?.slice?.(0, 220) ??
      `Mint ${name} on Panthart. View price, supply, schedule, and start minting on Electroneum (ETN).`;

    const ogImage = details?.coverUrl || details?.logoUrl || undefined;

    return {
      title,
      description: desc,
      alternates: { canonical: `/minting-now/${address}` },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-snippet": -1,
          "max-image-preview": "large",
          "max-video-preview": -1,
        },
      },
      openGraph: {
        title,
        description: desc,
        url: `/minting-now/${address}`,
        siteName: "Panthart",
        images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: name }] : undefined,
        locale: "en_US",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: desc,
        creator: "@decentroneum",
        images: ogImage ? [ogImage] : undefined,
      },
      category: "marketplace",
      keywords: ["Panthart", "Mint", "NFT mint", "ERC721", "Electroneum", "ETN", "Web3", name],
    };
  } catch {
    return {
      title: "Mint NFT | Panthart",
      description: "Mint NFTs on Panthart. View live mint details, price, and supply on Electroneum (ETN).",
      alternates: { canonical: `/minting-now/${address}` },
      robots: { index: true, follow: true },
    };
  }
}

function Pill({
  children,
  variant = "dark",
}: {
  children: React.ReactNode;
  variant?: "dark" | "glass" | "success" | "warn";
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] md:text-xs font-medium " +
    "ring-1 shadow-sm backdrop-blur-md";

  const styles =
    variant === "success"
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20"
      : variant === "warn"
      ? "bg-amber-500/15 text-amber-200 ring-amber-400/20"
      : variant === "glass"
      ? "bg-white/10 text-white ring-white/15"
      : "bg-neutral-900/70 text-white ring-black/10 dark:ring-white/15";

  return <span className={`${base} ${styles}`}>{children}</span>;
}

function shortAddr(a: string) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function HeroSSR({ details, address }: { details: MintDetails; address: string }) {
  const coverHttp = ipfsToHttp(details.coverUrl || details.logoUrl);
  const logoHttp = ipfsToHttp(details.logoUrl || details.coverUrl);

  const status =
    details.flags.soldOut
      ? "Sold Out"
      : details.flags.presaleActive
      ? "Presale Live"
      : details.flags.publicLive
      ? "Public Live"
      : "Upcoming";

  const statusVariant =
    status === "Public Live"
      ? "success"
      : status === "Presale Live"
      ? "warn"
      : status === "Sold Out"
      ? "dark"
      : "glass";

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border">
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src={coverHttp}
          alt={details.name}
          fill
          sizes="100vw"
          className="object-cover"
          priority={false}
        />

        {/* ✅ Premium readability stack */}
        {/* Base dim */}
        <div className="absolute inset-0 bg-black/35" />
        {/* Vignette (edges darker) */}
        <div className="absolute inset-0 [background:radial-gradient(1200px_500px_at_25%_20%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(900px_450px_at_85%_35%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(900px_450px_at_50%_120%,rgba(0,0,0,0.65),transparent_55%)]" />
        {/* Bottom/Top scrim for text */}
        <div className="absolute inset-0 [background:linear-gradient(180deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.35)_40%,rgba(0,0,0,0.82)_100%)]" />
      </div>

      <div className="relative p-4 md:p-6 text-white">
        {/* ✅ Two-column layout: info left, art still visible right */}
        <div className="grid gap-5 md:gap-6 lg:grid-cols-[1.1fr_.9fr] items-start">
          {/* LEFT: Glass info card */}
          <div className="rounded-3xl border border-white/12 bg-white/8 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="p-4 md:p-6">
              {/* Top row: logo + status + contract */}
              <div className="flex items-start gap-4">
                <div className="relative h-14 w-14 md:h-16 md:w-16 rounded-2xl overflow-hidden ring-1 ring-white/20 bg-black/20 shrink-0">
                  <Image
                    src={logoHttp}
                    alt={`${details.name} logo`}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill variant={statusVariant}>{status.toUpperCase()}</Pill>

                    {/* contract */}
                    <span
                      className="text-[11px] md:text-xs text-white/80 truncate"
                      title={address}
                    >
                      Contract:{" "}
                      <span className="font-semibold text-white/90">
                        {shortAddr(address)}
                      </span>
                    </span>
                  </div>

                  <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight leading-[1.12]">
                    {details.name}
                  </h1>
                </div>
              </div>

              {/* Description */}
              {details.description ? (
                <p className="mt-3 text-sm md:text-[15px] text-white/85 leading-relaxed max-w-[60ch]">
                  {details.description}
                </p>
              ) : null}

              {/* Schedule */}
              <div className="mt-5 grid gap-2 text-xs md:text-sm text-white/85">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white/60">Public:</span>
                  <span className="font-semibold tabular-nums">
                    {formatInTZ(details.publicSale.startISO)}
                  </span>
                </div>

                {details.presale ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white/60">Presale:</span>
                    <span className="font-semibold tabular-nums">
                      {formatInTZ(details.presale.startISO)} → {formatInTZ(details.presale.endISO)}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Creator strip */}
              <div className="mt-5 pt-4 border-t border-white/12 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-9 w-9 rounded-full overflow-hidden ring-1 ring-white/15 bg-white/10">
                    <Image
                      src={
                        details.creator.profileAvatar ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${details.creator.walletAddress}`
                      }
                      alt={details.creator.username}
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/profile/${details.creator.walletAddress}`}
                      className="font-semibold leading-tight truncate block hover:underline"
                      title={details.creator.username}
                    >
                      {details.creator.username}
                    </Link>
                    <div className="text-[11px] text-white/65 truncate">
                      {shortAddr(details.creator.walletAddress)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {details.social?.x ? (
                    <a
                      href={details.social.x}
                      target="_blank"
                      className="h-9 px-3 rounded-2xl bg-white/10 hover:bg-white/15 ring-1 ring-white/10 text-xs inline-flex items-center"
                      rel="noreferrer"
                    >
                      X
                    </a>
                  ) : null}
                  {details.social?.website ? (
                    <a
                      href={details.social.website}
                      target="_blank"
                      className="h-9 px-3 rounded-2xl bg-white/10 hover:bg-white/15 ring-1 ring-white/10 text-xs inline-flex items-center"
                      rel="noreferrer"
                    >
                      Web
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: keep space for art to “breathe” (no text clutter) */}
          <div className="hidden lg:block">
            <div className="h-full min-h-65 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function MintAddressPage(ctx: PageContext) {
  const { address } = await ctx.params;

  const details = await fetchMintDetails(address);
  if (!details) notFound();

  return (
    <Container size="xl" className="py-6 md:py-10">
      <nav className="mb-5 text-sm text-muted">
        <Link className="hover:underline" href="/">Home</Link>
        <span className="mx-2 opacity-60">/</span>
        <Link className="hover:underline" href="/minting-now">Minting Now</Link>
        <span className="mx-2 opacity-60">/</span>
        <span className="text-foreground/80">{details.name}</span>
      </nav>

      <HeroSSR details={details} address={details.contract} />

      {/* ✅ isolate creates a clean stacking context so sticky z-index behaves */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[.92fr,1.08fr] items-start isolate">
        {/* ✅ Mint first (sticky) */}
        <div className="order-1 lg:order-1 relative z-30">
          <div className="lg:sticky lg:top-24 z-30">
            {/* ✅ solid surface so nothing shows through */}
            <div className="rounded-[28px] bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 ring-1 ring-border shadow-sm">
              <div className="p-4 md:p-5">
                <MintActionClient address={details.contract} details={details} />
              </div>
            </div>
          </div>
        </div>

   {/* ✅ Items second */}
<div className="order-2 lg:order-2 relative z-0">
  <div className="mb-3 text-sm font-semibold">Items</div>

  <div className="rounded-[28px] border border-border bg-card p-4 md:p-5 relative z-0">
    <NFTItemsTab contract={details.contract} title={details.name} />
  </div>
</div>
      </section>
    </Container>
  );
}

