import CollectionHeader from "./CollectionHeader";
import CollectionOwnerActions from "./CollectionOwnerActions";
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

  ownerAddress?: string | null;

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
      <CollectionHeader
        header={header}
        actionsSlot={<CollectionOwnerActions header={header} />}
      />

      <div className="mx-auto w-full max-w-7xl px-4 pb-16">
        <CollectionTabsClient header={header} />
      </div>
    </div>
  );
}
