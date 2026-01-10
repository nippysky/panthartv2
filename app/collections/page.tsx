// app/collections/page.tsx
import type { Metadata } from "next";
import CollectionsClient from "@/src/ui/collections/CollectionsClient";
import { getCollectionsPage, normalizeCollectionsQuery } from "@/src/lib/collections";

export const metadata: Metadata = {
  title: "Collections • Panthart",
  description: "Browse NFT collections on Electroneum EVM. Floor is based on active listings. Volume is all-time.",
  alternates: { canonical: "/collections" },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const { sort, currency } = normalizeCollectionsQuery(sp);

  const first = await getCollectionsPage({
    sort,
    currency,
    limit: 24,
    cursor: null,
  });

  return (
    <CollectionsClient
      initialItems={first.items}
      initialNextCursor={first.nextCursor}
      initialSort={sort}
      initialCurrency={currency}
    />
  );
}
