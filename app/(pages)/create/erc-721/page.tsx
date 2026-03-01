// app/create/single-erc721/page.tsx
export const dynamic = "force-dynamic";

import type { Metadata } from "next";


import SingleERC721Wizard from "@/src/components/single-ERC721/SingleERC721Wizard";
import { BackButton } from "@/src/ui/BackButton";


/* ───────────── SEO ───────────── */
const TITLE = "Create Single NFT (ERC-721) — Mint a 1/1 | Panthart";
const DESCRIPTION =
  "Mint a one-of-one ERC-721 NFT on Electroneum (ETN). Upload media, set metadata and royalties, then mint or list directly—all in a guided flow.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/create/single-erc721" },
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
    "Panthart",
    "Create Single NFT",
    "ERC-721",
    "One of One",
    "1/1 NFT",
    "Electroneum",
    "ETN",
    "Mint NFT",
    "Royalties",
    "Web3",
  ],
  openGraph: {
    type: "website",
    url: "/create/single-erc721",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Panthart — Create Single ERC-721 NFT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image.png"],
    site: "@decentroneum",
    creator: "@decentroneum",
  },
  category: "marketplace",
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { telephone: false, email: false, address: false },
};

export default function CreateSingleERC721() {
  // JSON-LD (Breadcrumbs + HowTo)
  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Create", item: "/create" },
      { "@type": "ListItem", position: 3, name: "Single (ERC-721)", item: "/create/single-erc721" },
    ],
  };

  const jsonLdHowTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to mint a single ERC-721 NFT on Panthart",
    description:
      "Use the Single ERC-721 flow to upload media, set metadata and royalties, then mint on Electroneum (ETN).",
    supply: [{ "@type": "HowToSupply", name: "ETN for gas & fees" }],
    tool: [{ "@type": "HowToTool", name: "Web3 wallet (MetaMask / Rabby)" }],
    step: [
      { "@type": "HowToStep", name: "Connect wallet", text: "Connect your wallet from the page header." },
      { "@type": "HowToStep", name: "Upload media", text: "Upload your artwork (image, video, or animation)." },
      { "@type": "HowToStep", name: "Add metadata", text: "Enter name, description, and attributes." },
      { "@type": "HowToStep", name: "Set royalties", text: "Choose a royalty percentage and payout address." },
      {
        "@type": "HowToStep",
        name: "Mint & (optionally) list",
        text: "Confirm the transaction, wait for confirmations, and optionally list on the marketplace.",
      },
    ],
  };

  return (
    <>
      {/* Structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdHowTo) }} />
      {/* Page body */}
      <main className="min-h-svh bg-background">
        <section className="mx-auto w-full max-w-5xl px-4 md:px-6 lg:px-8 py-6 md:py-10">
          {/* Back */}
          <div className="mb-6">
       <BackButton fallbackHref="/create" variant="ghost" className="px-0" />
          </div>

          {/* Hero */}
          <header className="mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Single mint • ERC-721 • Electroneum (ETN)
            </div>

            <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Create Single NFT
            </h1>

            <p className="mt-3 max-w-2xl text-sm md:text-base text-muted-foreground">
              Upload your media, pin metadata to IPFS, then deploy. The flow is optimized for a clean 1/1 mint with
              sensible defaults and tight validation.
            </p>

            {/* “Apple-airy” divider */}
            <div className="mt-6 h-px w-full bg-border" />
          </header>

          {/* Wizard/Form */}
          <div className="page-enter">
            <SingleERC721Wizard />
          </div>

          {/* Subtle footer note */}
          <p className="mt-10 text-xs text-muted-foreground">
            Tip: Keep royalties ≤ 10% and use a payout address you control. Your wallet will pay gas + the one-time
            deployment fee.
          </p>
        </section>
      </main>
    </>
  );
}