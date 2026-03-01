// app/(PAGES)/listing/page.tsx
import type { Metadata } from "next";
import { Container } from "@/src/ui/Container";
import { getActiveListings } from "@/src/lib/server/listings/getActiveListings";
import ListingGridClient from "@/src/components/shared/ListingGridClient";

export const revalidate = 30;

const TITLE = "Listings | Panthart";
const DESCRIPTION =
  "Browse live fixed-price listings across ERC-721 and ERC-1155. Fast server-rendered grid with smooth infinite scroll.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/listing" },
  openGraph: {
    type: "website",
    url: "/listing",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
};

export default async function ListingPage() {
  const { items, nextCursor } = await getActiveListings({ take: 24 });

  return (
    <section className="pt-20 sm:pt-24 pb-16">
      <Container>
        <header className="max-w-2xl">
          <div className="text-xs font-semibold text-muted">Market</div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            Listings
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted leading-relaxed">
            All active fixed-price listings across ERC-721 and ERC-1155.
          </p>
        </header>

        <div className="mt-6 sm:mt-8">
          <ListingGridClient initialItems={items} initialCursor={nextCursor} />
        </div>
      </Container>
    </section>
  );
}