// src/types/minting-now.ts
export type MediaType = "image" | "video" | "unknown";

export type MintingNowItem = {
  id: string;
  kind: "erc721" | "erc1155";
  name: string;
  description?: string | null;
  contract: string;
  href: string;

  logoUrl: string;
  coverUrl: string;

  // ✅ deterministic media (computed server-side)
  logoMediaType: MediaType;
  coverMediaType: MediaType;

  supply: number;
  minted: number;
  mintedPct: number;

  status: "presale" | "public" | "upcoming";

  publicSale: {
    startISO: string;
    priceEtnWei: string;
  };

  presale?: {
    startISO: string;
    endISO: string;
    priceEtnWei: string;
  };
};