// app/(pages)/minting-now/page.tsx
import type { Metadata } from "next";

import { getMintingNowPage } from "@/src/lib/server/minting-now";
import type { MintingNowItem } from "@/src/types/minting-now";
import MintingNowClient from "./MintingNowClient";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Minting Now — Live NFT Drops & Presales | Panthart",
  description:
    "See live NFT mints happening right now on Panthart. Track presales, public sales, prices, supply, and time left across the Electroneum (ETN) ecosystem.",
  alternates: { canonical: "/minting-now" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Minting Now | Panthart",
    description:
      "Live NFT drops, presales, and public mints across the Electroneum (ETN) ecosystem.",
    url: "/minting-now",
    siteName: "Panthart",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Panthart — Minting Now",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Minting Now | Panthart",
    description:
      "Explore live NFT drops and presales on Panthart powered by Electroneum (ETN).",
    creator: "@decentroneum",
    images: ["/opengraph-image.png"],
  },
  category: "marketplace",
};

type PagePayload = { items: MintingNowItem[]; nextCursor: string | null };

export default async function MintingNowPage() {
  // ✅ Prevent never[] inference by typing the payload
  let initial: PagePayload = { items: [], nextCursor: null };

  try {
    initial = await getMintingNowPage({ limit: 60, cursor: null });
  } catch (err) {
    console.error("[/minting-now] SSR getMintingNowPage error:", err);
  }

  return (
    <main className="min-h-svh bg-background">
      <section className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8 py-6 md:py-10">
        <div className="flex flex-col gap-2 mb-6">
          <h1 className="font-bold text-[1.7rem] lg:text-[2.1rem] tracking-tight">
            Minting Now
          </h1>
          <p className="text-muted-foreground">
            Discover and claim exclusive digital assets as they go live. Join the
            mint while supplies last.
          </p>
        </div>

        <MintingNowClient initialPage={initial} />
      </section>
    </main>
  );
}