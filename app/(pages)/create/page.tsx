// app/create/page.tsx
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { BackButton } from "@/src/ui/BackButton";
import { Container } from "@/src/ui/Container";
import CreateNFTOptions from "@/src/ui/create/CreateNFTOptions";

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
      <div className="absolute -top-44 left-1/2 h-120 w-6xl -translate-x-1/2 rounded-full bg-linear-to-br from-brand/20 via-brandsec/12 to-transparent blur-3xl" />
      <div className="absolute -bottom-56 -left-28 h-96 w-[24rem] rounded-full bg-linear-to-tr from-brandsec/16 to-transparent blur-3xl" />
      <div className="absolute -bottom-56 -right-28 h-96 w-[24rem] rounded-full bg-linear-to-tl from-brand/14 to-transparent blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_50%_-10%,rgba(255,255,255,0.05),transparent_55%)] dark:bg-[radial-gradient(900px_520px_at_50%_-10%,rgba(255,255,255,0.035),transparent_55%)]" />
    </div>
  );
}

function TopChips() {
  return (
    <div className="hidden flex-wrap items-center gap-2 md:flex">
      <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur">
        Electroneum (ETN)
      </span>
      <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur">
        Fast deploy
      </span>
    </div>
  );
}

function HeroHeader() {
  return (
    <header className="relative overflow-hidden rounded-[30px] border border-border bg-card/70 backdrop-blur">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_280px_at_15%_0%,rgba(56,189,248,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_90%_100%,rgba(168,85,247,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.015)_40%,rgba(255,255,255,0.04)_100%)] dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0.14)_40%,rgba(0,0,0,0.34)_100%)]" />
      </div>

      <div className="relative p-5 sm:p-7 lg:p-9">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
              Create
            </div>

            <h1 className="mt-2 max-w-[12ch] text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[3.1rem] lg:leading-[1.02]">
              Mint something real.
            </h1>

            <p className="mt-4 max-w-[62ch] text-sm leading-7 text-muted-foreground sm:text-[15px] lg:text-base">
              Choose a path: launch an{" "}
              <span className="font-semibold text-foreground/90">
                ERC-721 drop
              </span>{" "}
              for a collection, or mint a{" "}
              <span className="font-semibold text-foreground/90">single</span>{" "}
              as ERC-721 or ERC-1155. Built for smooth, fast creation on
              Electroneum.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
                Collections
              </span>
              <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
                Singles
              </span>
              <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
                Low fees
              </span>
            </div>
          </div>

          <div className="hidden xl:block">
            <div className="rounded-[26px] border border-border bg-background/45 p-4 backdrop-blur">
              <div className="text-sm font-semibold text-foreground">
                Best practice
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use drops for polished launches, allowlists, presales, and
                public mint flows.
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default async function CreateNFTPage() {
  return (
    <section className="relative w-full overflow-x-hidden">
      <SoftAmbient />

      <Container size="xl" className="py-6 sm:py-10 lg:py-12">
        <div className="mb-5 flex items-center justify-between gap-4">
          <BackButton variant="ghost" className="-ml-2" />
          <TopChips />
        </div>

        <div className="mx-auto max-w-305">
          <HeroHeader />

          <div className="mt-6 sm:mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold sm:text-[15px]">
                Choose what to create
              </div>
              <div className="text-xs text-muted-foreground">3 options</div>
            </div>

            <div className="rounded-[30px] border border-border bg-card/40 p-3 backdrop-blur sm:p-4 md:p-5 lg:p-6">
              <CreateNFTOptions />
            </div>
          </div>
        </div>

        <div className="h-8 sm:h-12" />
      </Container>
    </section>
  );
}