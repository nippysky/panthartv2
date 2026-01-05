// src/app/collections/page.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Container } from "@/src/ui/Container";
import CollectionsClient from "@/src/ui/collections/CollectionsClient";

type SearchParams = Record<string, string | string[] | undefined>;

function pick(sp: SearchParams, key: string) {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function canonicalUrl(params: URLSearchParams) {
  const base = "https://panth.art/collections";
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = (await searchParams) ?? {};
  const q = (pick(sp, "q") || "").trim();
  const sort = (pick(sp, "sort") || "volume_desc").trim();
  const standard = (pick(sp, "standard") || "").trim();
  const indexed = pick(sp, "indexed") === "1";

  const titleBits = [
    "Collections",
    standard ? standard : null,
    indexed ? "Indexed" : null,
    q ? `Search: ${q}` : null,
  ].filter(Boolean);

  const title = `${titleBits.join(" • ")} • Panthart`;
  const description =
    "Browse Electroneum EVM NFT collections on Panthart. Filter by standard, indexing status, and sort by volume, floor, or newest.";

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort && sort !== "volume_desc") params.set("sort", sort);
  if (standard) params.set("standard", standard);
  if (indexed) params.set("indexed", "1");

  const canonical = canonicalUrl(params);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Panthart",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (pick(sp, "q") || "").trim();
  const sort = (pick(sp, "sort") || "volume_desc").trim();
  const standard = (pick(sp, "standard") || "").trim();
  const indexed = pick(sp, "indexed") === "1";

  // JSON-LD (CollectionPage + SearchAction)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Panthart Collections",
    url: "https://panth.art/collections",
    isPartOf: {
      "@type": "WebSite",
      name: "Panthart",
      url: "https://panth.art",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://panth.art/collections?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  };

  return (
    <div className="page-enter">
      <Script
        id="ld-collections"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="pt-10 sm:pt-12">
        <Container>
          {/* Real, crawlable H1 for SEO */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Collections
            </h1>
            <p className="text-sm text-muted max-w-[70ch]">
              Discover NFT collections on Electroneum EVM. Sort by volume, floor,
              or newest — and filter down to exactly what you want.
            </p>
          </div>

          {/* Client: filters + infinite list */}
          <div className="mt-6">
            <CollectionsClient
              initialFilters={{
                q,
                sort,
                standard,
                indexed,
              }}
            />
          </div>
        </Container>
      </section>

      <div className="h-12 sm:h-16" />
    </div>
  );
}
