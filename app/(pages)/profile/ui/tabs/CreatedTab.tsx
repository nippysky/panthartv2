// app/profile/[address]/ui/tabs/CreatedTab.tsx
"use client";

import { useState } from "react";
import ProfileCollectionGrid from "../widgets/ProfileCollectionGrid";


export default function CreatedTab({ address }: { address: string }) {
  const [search, setSearch] = useState("");

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative w-full">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collections…"
              className="w-full rounded-2xl border border-border bg-card px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
        </div>
      </div>

      <ProfileCollectionGrid address={address} query={{ search }} />
    </div>
  );
}
