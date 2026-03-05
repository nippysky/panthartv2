// app/create/page.tsx
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { BackButton } from "@/src/ui/BackButton";
import { Container } from "@/src/ui/Container";
import CreateNFTOptions from "@/src/ui/create/CreateNFTOptions";
import { cn } from "@/src/lib/utils";

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
    description: "Mint NFTs or launch an ERC-721/1155 collection on the ETN-powered marketplace.",
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
  keywords: ["Panthart", "Create NFT", "Mint NFT", "Electroneum", "ETN", "ERC721", "ERC1155", "NFT Marketplace"],
  category: "marketplace",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
};


/** Softer, premium ambient that doesn’t “blob” over content */
function SoftAmbient() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Top wash */}
      <div className="absolute -top-48 left-1/2 h-130 w-225 -translate-x-1/2 rounded-full blur-3xl opacity-25 bg-linear-to-br from-brand/35 via-brandsec/20 to-transparent" />
      {/* Side glows */}
      <div className="absolute -bottom-56 -left-40 h-130 w-130 rounded-full blur-3xl opacity-20 bg-linear-to-tr from-brandsec/28 to-transparent" />
      <div className="absolute -bottom-56 -right-40 h-130 w-130 rounded-full blur-3xl opacity-15 bg-linear-to-tl from-brand/28 to-transparent" />
      {/* Subtle vignette */}
      <div className="absolute inset-0 [background:radial-gradient(900px_520px_at_50%_-10%,rgba(255,255,255,0.08),transparent_55%),linear-gradient(to_bottom,rgba(0,0,0,0.02),rgba(0,0,0,0.00),rgba(0,0,0,0.02))] dark:[background:radial-gradient(900px_520px_at_50%_-10%,rgba(255,255,255,0.05),transparent_55%),linear-gradient(to_bottom,rgba(0,0,0,0.45),rgba(0,0,0,0.15),rgba(0,0,0,0.45))]" />
    </div>
  );
}

function Chips() {
  return (
    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
      <span className="rounded-full border border-border bg-card/70 px-3 py-1 font-semibold backdrop-blur">
        Electroneum (ETN)
      </span>
      <span className="rounded-full border border-border bg-card/70 px-3 py-1 font-semibold backdrop-blur">
        Fast deploy
      </span>
      <span className="rounded-full border border-border bg-card/70 px-3 py-1 font-semibold backdrop-blur">
        Africa/Lagos
      </span>
    </div>
  );
}

function QuickChecklist() {
  type ChecklistItem = { k: string; v: string; mono?: boolean };

  const items: ChecklistItem[] = [
    { k: "Wallet connected", v: "MetaMask / Rabby / Decent Wallet" },
    { k: "Enough balance", v: "Keep a little extra ETN for gas + fees" },
    { k: "Metadata ready", v: "ipfs://<CID>", mono: true },
    { k: "Time zone", v: "Sale schedules show Africa/Lagos (WAT)" },
  ];

  return (
    <aside className="rounded-[28px] border border-border bg-card/60 backdrop-blur shadow-[0_1px_0_rgba(255,255,255,0.06)]">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Quick checklist</div>
            <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Tiny stuff that prevents 90% of “why did this fail?” moments.
            </div>
          </div>

          <span className="shrink-0 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            Helpful
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {items.map((it) => (
            <div
              key={it.k}
              className="rounded-2xl border border-border bg-background/55 px-4 py-3 flex items-start justify-between gap-4"
            >
              <div className="text-sm text-foreground/85">{it.k}</div>
              <div className={cn("text-sm text-muted-foreground text-right", it.mono ? "font-mono text-[12px] sm:text-sm" : "")}>
                {it.v}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-background/55 px-3 py-1">
            Tip: keep images under ~25MB for fastest IPFS pinning.
          </span>
          <Link className="rounded-full border border-border bg-background/55 px-3 py-1 hover:bg-background/80" href="https://docs.panth.art/creators/create-nft" target="_blank" rel="noopener">
            Read docs
          </Link>
        </div>
      </div>
    </aside>
  );
}
function HeroHeader() {
  return (
    <header className="relative overflow-hidden rounded-[28px] border border-border bg-card/70 backdrop-blur">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(900px_340px_at_20%_10%,rgba(56,189,248,0.14),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_340px_at_85%_85%,rgba(168,85,247,0.14),transparent_60%)]" />
        <div className="absolute inset-0 [background:linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.02)_45%,rgba(255,255,255,0.08)_100%)] dark:[background:linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.20)_45%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      <div className="relative p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-muted-foreground">Create</div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
              Mint something real.
            </h1>
            <p className="mt-2 text-sm sm:text-[15px] text-muted-foreground leading-relaxed max-w-[72ch]">
              Choose a path: launch an <span className="text-foreground/90 font-semibold">ERC-721 drop</span> for a
              collection, or mint a <span className="text-foreground/90 font-semibold">single</span> as ERC-721 / ERC-1155.
              Built for fast, smooth creation on Electroneum (ETN).
            </p>
          </div>

          <div className="hidden md:block">
            <div className="rounded-3xl border border-border bg-background/50 px-4 py-3 text-sm text-muted-foreground">
              <div className="font-semibold text-foreground">Best practice</div>
              <div className="mt-1 max-w-[26ch] leading-relaxed">
                Drops are perfect for public mints & allowlists.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
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
    </header>
  );
}

export default async function CreateNFT() {
  return (
    <section className="relative w-full overflow-x-hidden">
      <SoftAmbient />

      <Container size="xl" className="py-6 sm:py-10">
        {/* Top bar */}
        <div className="mb-5 flex items-center justify-between">
          <BackButton variant="ghost" className="-ml-2" />
          <Chips />
        </div>

        {/* Modern layout: hero + (options + checklist) */}
        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr] items-start">
          {/* LEFT: hero + options */}
          <div className="min-w-0">
            <HeroHeader />

            {/* Options (keep your existing component) */}
            <div className="mt-6">
              {/* Tiny label to reduce “packed” feeling */}
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Choose what to create</div>
                <div className="text-xs text-muted-foreground">3 options</div>
              </div>

              <div className="rounded-[28px] border border-border bg-card/40 backdrop-blur p-3 sm:p-4">
                <CreateNFTOptions />
              </div>
            </div>
          </div>

          {/* RIGHT: sticky helper rail */}
          <div className="min-w-0">
            <div className="lg:sticky lg:top-24">
              <QuickChecklist />

              {/* small footer note */}
              <div className="mt-4 rounded-3xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">Need inspiration?</div>
                <div className="mt-1 leading-relaxed">
                  Explore what’s trending, then come back and mint with the same clean metadata style.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/minting-now"
                    className="rounded-full border border-border bg-background/60 px-4 py-2 text-xs font-semibold text-foreground hover:bg-background/80"
                  >
                    Minting Now
                  </Link>
                  <Link
                    href="/auction-now"
                    className="rounded-full border border-border bg-background/60 px-4 py-2 text-xs font-semibold text-foreground hover:bg-background/80"
                  >
                    Live auctions
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-10 sm:h-14" />
      </Container>
    </section>
  );
}