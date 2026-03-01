// app/(PAGES)/auction/page.tsx
export const dynamic = "force-dynamic"; // dynamic route, no SSG

import { headers } from "next/headers";
import type { Metadata } from "next";
import { AuctionGridItem } from "@/src/components/shared/AuctionGrid";
import AuctioningNowComponent from "@/src/components/shared/AuctionNowPage";

/* ----------------------------------------------------------------------------
 * SEO
 * ---------------------------------------------------------------------------- */
export const metadata: Metadata = {
  title: "Live NFT Auctions | Panthart",
  description:
    "Bid on live NFT auctions on Panthart. Timed auctions, smooth UX, and low fees on Electroneum (ETN).",
  alternates: { canonical: "/auction" },
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
    title: "Live NFT Auctions | Panthart",
    description: "Explore and bid on active NFT auctions on the ETN-powered marketplace.",
    url: "/auction",
    siteName: "Panthart",
    type: "website",
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Live NFT Auctions | Panthart",
    description: "Explore and bid on active NFT auctions on the ETN-powered marketplace.",
    images: ["/opengraph-image.png"],
    creator: "@decentroneum",
  },
  keywords: [
    "NFT auctions",
    "Panthart auctions",
    "Electroneum",
    "ETN",
    "Web3",
    "Timed auctions",
    "NFT marketplace",
  ],
  category: "marketplace",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
};

const AUCTION_DATA_REVALIDATE = 30;
const AUCTION_FETCH_TIMEOUT_MS = 8000;

/* ------------------------------------------------------------------ */
/* absoluteUrl – same origin logic                                    */
/* ------------------------------------------------------------------ */
async function absoluteUrl(path: string): Promise<string> {
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;

  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (envBase) return `${envBase}${trimmedPath}`;

  const vercelUrl = process.env.VERCEL_URL?.replace(/\/+$/, "");
  if (vercelUrl) {
    const origin = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
    return `${origin}${trimmedPath}`;
  }

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}${trimmedPath}`;
    }
  } catch {
    // ignore
  }

  return `http://localhost:3000${trimmedPath}`;
}

type InitialPage = {
  items: AuctionGridItem[];
  nextCursor: string | null;
};

/**
 * Server-side bootstrap: fetch first page (items + cursor)
 * so hydration is instant, then client takes over.
 *
 * ✅ IMPORTANT: Use chain=1 so “Current bid” is on-chain accurate
 * (DB can lag behind bids).
 */
async function fetchInitialAuctions(limit = 30): Promise<InitialPage> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUCTION_FETCH_TIMEOUT_MS);

  try {
    const url = await absoluteUrl(`/api/auction/active?limit=${limit}&chain=1`);

    const res = await fetch(url, {
      next: { revalidate: AUCTION_DATA_REVALIDATE },
      signal: controller.signal,
    });

    if (!res.ok) return { items: [], nextCursor: null };
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return { items: [], nextCursor: null };

    const json = await res.json();
    if (!json || !Array.isArray(json.items)) return { items: [], nextCursor: null };

    return {
      items: json.items as AuctionGridItem[],
      nextCursor: json.nextCursor ?? null,
    };
  } catch (e) {
    console.error("[/auction] initial auctions fetch error:", e);
    return { items: [], nextCursor: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

/* ----------------------------------------------------------------------------
 * Page (Server Component)
 * ---------------------------------------------------------------------------- */
export default async function AuctionsPage() {
  const initialPage = await fetchInitialAuctions(30);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Live NFT Auctions",
    description:
      "Browse live NFT auctions on Panthart. Discover trending assets and place competitive bids on Electroneum (ETN).",
    url: "https://panth.art/auction",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://panth.art/" },
        { "@type": "ListItem", position: 2, name: "Auctions", item: "https://panth.art/auction" },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AuctioningNowComponent initialPage={initialPage} />
    </>
  );
}