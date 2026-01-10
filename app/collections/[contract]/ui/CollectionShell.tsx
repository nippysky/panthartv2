// app/collections/[contract]/ui/CollectionShell.tsx

import CollectionHeader from "./CollectionHeader";
import CollectionTabsClient from "./CollectionTabsClient";


type HeaderDTO = {
  name?: string | null;
  description?: string | null;
  contract: string;
  logoUrl?: string | null;
  coverUrl?: string | null;

  website?: string | null;
  instagram?: string | null;
  x?: string | null;
  discord?: string | null;
  telegram?: string | null;

  floorPrice?: number | null;
  volume?: number | null;

  supply?: number | null;
  itemsCount?: number | null;
  ownersCount?: number | null;

  listingActiveCount?: number | null;
  auctionActiveCount?: number | null;

  rarityEnabled?: boolean | null;
  rarityPopulation?: number | null;
};

export default function CollectionShell({ header }: { header: HeaderDTO }) {
  return (
    <div className="min-h-screen">
      {/* Server-rendered hero + stats = fast + SEO */}
      <CollectionHeader header={header} />

      {/* Client tabs only (Items / Activity / About) */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-16">
        <CollectionTabsClient header={header} />
      </div>
    </div>
  );
}
