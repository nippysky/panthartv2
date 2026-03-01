// app/profile/[address]/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ProfileShell from "../ui/ProfileShell";


type ProfileHeaderDTO = {
  id: string;
  walletAddress: string;

  username: string;
  bio?: string | null;

  profileAvatar?: string | null;
  profileBanner?: string | null;

  website?: string | null;
  x?: string | null;
  instagram?: string | null;
  telegram?: string | null;

  collectedCount?: number | null;
  createdCount?: number | null;
  listedCount?: number | null;
  auctionsCount?: number | null;

  joinedAt?: string | null;
};

type RouteParams = { address: string };

async function getSiteUrl() {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

async function getHeader(address: string): Promise<ProfileHeaderDTO | null> {
  const base = await getSiteUrl();
  const url = `${base}/api/profile/${encodeURIComponent(address)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as ProfileHeaderDTO;
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
  const { address } = await params;
  const header = await getHeader(address);

  const base = (await getSiteUrl()) || "https://panth.art";
  const metadataBase = new URL(base);

  if (!header) {
    return {
      metadataBase,
      title: "Profile — Panth.art",
      description: "Explore profiles on Panth.art",
    };
  }

  const title = `${header.username} — Panth.art`;
  const description =
    (header.bio ?? "").slice(0, 160) || `View ${header.username} on Panth.art`;

  const ogImage =
    (await toAbs(header.profileBanner)) ?? (await toAbs(header.profileAvatar));
  const canonicalPath = `/profile/${header.walletAddress}`;

  return {
    metadataBase,
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      type: "profile",
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
  const { address } = await params;

  const header = await getHeader(address);
  if (!header) return notFound();

  return <ProfileShell header={header} />;
}
