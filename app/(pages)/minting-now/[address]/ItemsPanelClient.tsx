// app/(pages)/minting-now/[address]/ItemsPanelClient.tsx
"use client";

import * as React from "react";
import NFTItemsTab from "@/src/components/shared/NFTitemsTab";

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-square bg-muted animate-pulse" />
          <div className="p-3">
            <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ItemsPanelClient({
  contract,
  collectionName,
}: {
  contract: string;
  collectionName: string;
}) {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return <SkeletonGrid />;

  return <NFTItemsTab contract={contract} title={collectionName} />;
}