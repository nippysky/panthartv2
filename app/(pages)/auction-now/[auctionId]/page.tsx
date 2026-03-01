/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";

import NFTAuctionNowPage from "@/src/components/shared/NFTAuctionNowPage";
import type { Metadata } from "next";
import { headers } from "next/headers";

/* ----------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */
type PageContext = {
  params: Promise<{ auctionId: string }>;
};

type AuctionLite = {
  nft?: {
    contract?: string;
    tokenId?: string;
    standard?: string;
    name?: string | null;
    image?: string | null;
  } | null;
  amounts?: {
    startPrice?: string | null;
    highestBid?: string | null;
  } | null;
  endTime?: string | null;
  active?: boolean;
};

async function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (base) return `${base}${path}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (host && host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

const toNum = (x: unknown) => {
  const n = Number((x as any)?.toString?.() ?? x);
  return Number.isFinite(n) ? n : undefined;
};

function formatEndsIn(endISO?: string | null): string | undefined {
  if (!endISO) return;
  const end = new Date(endISO).getTime();
  if (!Number.isFinite(end)) return;
  const now = Date.now();
  const ms = Math.max(0, end - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/* ----------------------------------------------------------------------------
 * SEO
 * -------------------------------------------------------------------------- */
export async function generateMetadata(ctx: PageContext): Promise<Metadata> {
  const { auctionId } = await ctx.params;

  let auction: AuctionLite | null = null;

  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
    if (base) {
      const r = await fetch(`${base}/api/auction/${auctionId}`, {
        cache: "no-store",
      });
      if (r.ok) {
        const j = await r.json();
        auction = (j?.auction as AuctionLite) ?? null;
      }
    }
  } catch {
    /* noop */
  }

  const nftName =
    auction?.nft?.name ||
    (auction?.nft?.contract && auction?.nft?.tokenId
      ? `${auction.nft.contract.slice(0, 6)}…${auction.nft.contract.slice(-4)} #${auction.nft.tokenId}`
      : `Auction ${auctionId}`);

  const highest = toNum(auction?.amounts?.highestBid);
  const start = toNum(auction?.amounts?.startPrice);
  const priceLine =
    highest != null
      ? `Highest bid: ${highest}.`
      : start != null
        ? `Starting at ${start}.`
        : undefined;

  const endsIn = formatEndsIn(auction?.endTime);
  const endLine = endsIn ? ` Ends in ${endsIn}.` : "";

  const desc = `Live NFT auction on Panthart. ${priceLine ?? ""}${endLine}`.trim();

  const ogImage = auction?.nft?.image ?? "/opengraph-image.png";
  const pagePath = `/auction-now/${auctionId}`;

  return {
    title: `${nftName} • Auction Now`,
    description: desc,
    alternates: { canonical: pagePath },
    openGraph: {
      title: `${nftName} • Auction Now`,
      description: desc,
      url: pagePath,
      siteName: "Panthart",
      type: "website",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${nftName} • Auction Now`,
      description: desc,
      images: [ogImage],
      creator: "@decentroneum",
    },
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
    keywords: [
      "NFT auction",
      "Panthart auction",
      "Electroneum",
      "ETN",
      "Web3",
      "NFT marketplace",
      "digital collectibles",
    ],
    category: "marketplace",
  };
}

/* ----------------------------------------------------------------------------
 * Page (Server)
 * -------------------------------------------------------------------------- */
export default async function AuctionNowDetails(ctx: PageContext) {
  const { auctionId } = await ctx.params;

  let jsonLdProduct: any = null;
  let escrowed = false;
  let initialAuction: any = null;

  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
    if (base) {
      const r = await fetch(`${base}/api/auction/${auctionId}`, {
        cache: "no-store",
      });
      if (r.ok) {
        const j = await r.json();
        const a = j?.auction;
        initialAuction = a ?? null;

        const pageUrl = await absoluteUrl(`/auction-now/${auctionId}`);

        jsonLdProduct = {
          "@context": "https://schema.org",
          "@type": "Product",
          name:
            a?.nft?.name ||
            (a?.nft?.contract && a?.nft?.tokenId
              ? `NFT ${a.nft.contract.slice(0, 6)}…${a.nft.contract.slice(-4)} #${a.nft.tokenId}`
              : `Auction ${auctionId}`),
          description: "Live NFT auction on Panthart (Electroneum / ETN).",
          offers: {
            "@type": "Offer",
            url: pageUrl,
            priceCurrency: "ETN",
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        };

        // Escrow badge check (best-effort)
        if (a?.nft?.contract && a?.nft?.tokenId) {
          try {
            const infoRes = await fetch(
              `${base}/api/nft/${a.nft.contract}/${a.nft.tokenId}`,
              { cache: "no-store" }
            );
            if (infoRes.ok) {
              const info = await infoRes.json();
              const ownerAddr = (info?.owner?.walletAddress || "").toLowerCase();
              const mkt = (process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS || "").toLowerCase();
              escrowed = !!ownerAddr && !!mkt && ownerAddr === mkt;
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  return (
    <>
      {jsonLdProduct && (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdProduct) }}
        />
      )}

      {/* ✅ Remove the old mt-20; spacing is handled inside the client page for consistency */}
      <NFTAuctionNowPage initialAuction={initialAuction} />
    </>
  );
}