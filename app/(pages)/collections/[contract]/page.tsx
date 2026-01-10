// app/collections/[contract]/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CollectionShell from "./ui/CollectionShell";

type HeaderDTO = {
  id?: string;
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
  ownerAddress?: string | null;


  listingActiveCount?: number | null;
  auctionActiveCount?: number | null;

  rarityEnabled?: boolean | null;
  rarityPopulation?: number | null;
};

type RouteParams = { contract: string };

async function getSiteUrl() {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");

  // Next.js (newer) exposes headers() as async
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000"; // safe fallback for local dev
  return `${proto}://${host}`;
}

async function getHeader(contract: string): Promise<HeaderDTO | null> {
  const base = await getSiteUrl();
  const url = `${base}/api/collections/${contract}?header=1`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  return (await res.json()) as HeaderDTO;
}

async function toAbs(maybeUrl?: string | null) {
  if (!maybeUrl) return null;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;

  if (maybeUrl.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${maybeUrl.replace("ipfs://", "")}`;
  }

  const base = await getSiteUrl();
  return base ? new URL(maybeUrl, base).toString() : maybeUrl;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { contract } = await params;

  const header = await getHeader(contract);

  const base = (await getSiteUrl()) || "https://panth.art";
  const metadataBase = new URL(base);

  if (!header) {
    return {
      metadataBase,
      title: "Collection — Panth.art",
      description: "Explore collections on Panth.art",
    };
  }

  const name = header.name ?? "Collection";
  const title = `${name} — Panth.art`;
  const description =
    header.description?.slice(0, 160) || `View ${name} on Panth.art`;

  const ogImage =
    (await toAbs(header.coverUrl)) ?? (await toAbs(header.logoUrl));
  const canonicalPath = `/collections/${header.contract}`;

  return {
    metadataBase,
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalPath,
      images: ogImage ? [{ url: ogImage }] : [],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { contract } = await params;

  const header = await getHeader(contract);
  if (!header) return notFound();

  return <CollectionShell header={header} />;
}
