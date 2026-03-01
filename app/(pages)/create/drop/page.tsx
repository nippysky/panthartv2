// app/create/drop/page.tsx
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import DropWizard from "@/src/components/drop/DropWizard";
import { BackButton } from "@/src/ui/BackButton";
import { Container } from "@/src/ui/Container";

/* ───────────── SEO ───────────── */
const TITLE = "Create ERC-721 Drop — Launch a Collection | Panthart";
const DESCRIPTION =
  "Deploy an ERC-721 Drop on Electroneum (ETN). Name your collection, set supply, royalties, and mint price—then launch with our guided wizard.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/create/drop" },
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
    "Create Drop",
    "ERC-721 Drop",
    "NFT Drop",
    "Launch Collection",
    "Electroneum",
    "ETN",
    "Royalties",
    "Mint Price",
    "Web3",
  ],
  openGraph: {
    type: "website",
    url: "/create/drop",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Panthart — Create ERC-721 Drop",
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

export default function DropCreatePage() {
  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Create", item: "/create" },
      { "@type": "ListItem", position: 3, name: "ERC-721 Drop", item: "/create/drop" },
    ],
  };

  const jsonLdHowTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to create an ERC-721 Drop on Panthart",
    description:
      "Use the Drop Wizard to configure and deploy an ERC-721 collection on Electroneum (ETN).",
    supply: [{ "@type": "HowToSupply", name: "ETN for deployment & fees" }],
    tool: [{ "@type": "HowToTool", name: "Web3 wallet (MetaMask / Rabby)" }],
    step: [
      { "@type": "HowToStep", name: "Connect wallet", text: "Connect your wallet from the page header." },
      { "@type": "HowToStep", name: "Collection details", text: "Enter name, symbol, description, and upload logo/cover." },
      { "@type": "HowToStep", name: "Mint configuration", text: "Choose total supply, mint price in ETN, and max per wallet." },
      { "@type": "HowToStep", name: "Royalties & payout", text: "Set royalty percentage and payout address." },
      { "@type": "HowToStep", name: "Deploy & verify", text: "Confirm the transaction, wait for confirmations, and verify on-chain." },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdHowTo) }}
      />

      {/* No header here — project root already renders the revamped header */}
      <section className="relative w-full overflow-hidden">
        {/* soft ambient */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-28 h-72 w-72 rounded-full blur-3xl opacity-20 bg-linear-to-br from-brand/30 to-brandsec/25" />
          <div className="absolute -bottom-40 -right-24 h-80 w-80 rounded-full blur-3xl opacity-15 bg-linear-to-tr from-brandsec/30 to-brand/25" />
        </div>

        <Container className="py-7 sm:py-10" size="lg">
          {/* Top row */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <BackButton fallbackHref="/create" variant="ghost" className="px-0" />

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                Electroneum (ETN)
              </span>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                Africa/Lagos
              </span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-4xl">
            <DropWizard />
          </div>
        </Container>
      </section>
    </>
  );
}