// src/app/page.tsx
import Link from "next/link";
import { Container } from "@/src/ui/Container";
import { Button } from "@/src/ui/Button";

export default function HomePage() {
  return (
    <div className="page-enter">
      <section className="pt-14 sm:pt-18">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            {/* Left: hero copy */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground/90">
                <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                Panthart • NFT Marketplace
              </div>

              <h1 className="mt-4 text-3xl sm:text-5xl font-semibold tracking-tight">
                Mint, trade, and discover NFTs on Electroneum EVM.
              </h1>

              <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">
                A creator-first marketplace built for speed, clarity, and trust —
                with a Decentroneum-grade experience across the ecosystem.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Button href="/explore" variant="primary" size="md">
                  Explore
                </Button>
                <Button href="/collections" variant="secondary" size="md">
                  Collections
                </Button>
                <Button href="/create" variant="ghost" size="md">
                  Create
                </Button>
              </div>

              <div className="mt-6 text-xs text-muted">
                Non-custodial. Built for the Electroneum ecosystem.
              </div>
            </div>

            {/* Right: lightweight “status” card */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
              <div className="text-sm font-semibold tracking-tight">
                Quick access
              </div>

              <div className="mt-4 grid gap-3">
                <Link
                  href="/minting-now"
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground/90 hover:bg-card transition"
                >
                  Minting Now
                  <div className="mt-1 text-xs font-normal text-muted">
                    See what’s actively minting.
                  </div>
                </Link>

                <Link
                  href="/auction"
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground/90 hover:bg-card transition"
                >
                  Live Auctions
                  <div className="mt-1 text-xs font-normal text-muted">
                    Bid in real time.
                  </div>
                </Link>

                <Link
                  href="/submit-collection"
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground/90 hover:bg-card transition"
                >
                  Submit a Collection
                  <div className="mt-1 text-xs font-normal text-muted">
                    Get featured in the directory.
                  </div>
                </Link>
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-background px-4 py-3">
                <div className="text-xs text-muted">Docs</div>
                <a
                  href="https://docs.panth.art"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex text-sm font-semibold underline-offset-4 hover:underline"
                >
                  Read the documentation
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Subtle divider spacing before footer (footer is in layout) */}
      <div className="h-12 sm:h-16" />
    </div>
  );
}
