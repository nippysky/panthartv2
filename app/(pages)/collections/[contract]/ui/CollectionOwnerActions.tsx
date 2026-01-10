"use client";

import * as React from "react";
import EditCollectionSheet from "./EditCollectionSheet";
import WithdrawProceedsDialog from "./WithdrawProceedsDialog";
import { useUnifiedAccount } from "@/src/lib/useUnifiedAccount";

type HeaderDTO = {
  contract: string;
  name?: string | null;
  ownerAddress?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;

  website?: string | null;
  instagram?: string | null;
  x?: string | null;
  discord?: string | null;
  telegram?: string | null;
};

export default function CollectionOwnerActions({ header }: { header: HeaderDTO }) {
  const acct = useUnifiedAccount();

  const my = (acct.address || "").toLowerCase();
  const owner = (header.ownerAddress || "").toLowerCase();
  const isOwner = !!my && !!owner && my === owner;

  if (!isOwner) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <WithdrawProceedsDialog
        contract={header.contract}
        collectionName={header.name ?? "Collection"}
      />
      <EditCollectionSheet
        collection={{
          contract: header.contract,
          name: header.name ?? "Collection",
          ownerAddress: header.ownerAddress!,
          description: header.description ?? null,
          logoUrl: header.logoUrl ?? null,
          coverUrl: header.coverUrl ?? null,
          website: header.website ?? null,
          instagram: header.instagram ?? null,
          x: header.x ?? null,
          telegram: header.telegram ?? null,
          discord: header.discord ?? null,
        }}
      />
    </div>
  );
}
