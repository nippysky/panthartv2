// app/create/page.tsx
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import CreateNFTOptions from "@/src/ui/create/CreateNFTOptions";
import { BackButton } from "@/src/ui/BackButton";
import { Container } from "@/src/ui/Container";

export const metadata: Metadata = {
  title: "Create NFTs",
  description:
    "Mint your NFT or launch a collection on Panthart. Choose ERC-721 drops or ERC-721/1155 singles. Built for the Electroneum (ETN) ecosystem.",
  alternates: { canonical: "/create" },
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
    title: "Create on Panthart",
    description:
      "Mint NFTs or launch an ERC-721/1155 collection on the ETN-powered marketplace.",
    url: "/create",
    siteName: "Panthart",
    type: "website",
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Create on Panthart",
    description: "Mint NFTs or launch a collection (ERC-721/1155) with ETN.",
    images: ["/opengraph-image.png"],
    creator: "@decentroneum",
  },
  keywords: [
    "Panthart",
    "Create NFT",
    "Mint NFT",
    "Electroneum",
    "ETN",
    "ERC721",
    "ERC1155",
    "NFT Marketplace",
  ],
  category: "marketplace",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
};

function SoftAmbient() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-28 left-1/2 h-112 w-md -translate-x-1/2 rounded-full blur-3xl opacity-20 bg-linear-to-br from-brand/35 to-brandsec/25" />
      <div className="absolute -bottom-32 -left-28 h-80 w-80 rounded-full blur-3xl opacity-15 bg-linear-to-tr from-brandsec/30 to-brand/20" />
      <div className="absolute -bottom-40 -right-24 h-88 w-88 rounded-full blur-3xl opacity-10 bg-linear-to-tr from-brand/25 to-brandsec/25" />
    </div>
  );
}

function ChecklistCard() {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Before you mint</div>
          <div className="mt-1 text-sm text-muted-foreground">
            A quick checklist so deployment goes smoothly.
          </div>
        </div>
        <div className="shrink-0 rounded-2xl border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground">
          Tip
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Wallet
          </div>
          <div className="mt-1 text-sm">
            Connect a supported wallet (MetaMask / Rabby / Decent Wallet).
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Gas + fee
          </div>
          <div className="mt-1 text-sm">
            Keep a little extra ETN for platform fee + deployment gas.
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Metadata
          </div>
          <div className="mt-1 text-sm">
            Make sure your Base URI is <span className="font-mono">ipfs://&lt;CID&gt;</span>.
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Timing
          </div>
          <div className="mt-1 text-sm">
            Sales times are standardized to <span className="font-semibold">Africa/Lagos</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function CreateNFT() {
  return (
    <section className="relative w-full overflow-x-hidden">
      <SoftAmbient />

      <Container size="lg" className="py-6 sm:py-10">
        {/* Keep everything on a disciplined reading width */}
        <div className="mx-auto w-full max-w-3xl">
          {/* Top bar */}
          <div className="mb-5 flex items-center justify-between">
            <BackButton variant="ghost" className="-ml-2" />
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-card px-3 py-1 font-semibold">
                Electroneum (ETN)
              </span>
              <span className="rounded-full border border-border bg-card px-3 py-1 font-semibold">
                Fast deploy
              </span>
            </div>
          </div>

          {/* Hero */}
     <header className="mb-9 sm:mb-10">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Create
            </h1>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Pick how you want to mint. Collections are ERC-721 drops, while Singles can be ERC-721 or ERC-1155.
            </p>
          </header>

          {/* Options */}
         <div className="mt-2 sm:mt-3 space-y-4">
            <CreateNFTOptions />
          </div>

          {/* Extra structure so the page doesn’t feel “unfinished” on tall screens */}
          <div className="mt-8 sm:mt-10">
            <ChecklistCard />
          </div>

          {/* Bottom spacing for nicer scroll + footer separation */}
          <div className="h-10 sm:h-14" />
        </div>
      </Container>
    </section>
  );
}