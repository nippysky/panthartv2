export type ListingActiveItem = {
  id: string; // chain listingId as string
  sellerAddress: string | null;
  currency?: { symbol?: string | null } | null;
  price?: { unit?: string | null } | null;
  quantity?: number | null;
  startTime?: string | null; // ISO
  endTime?: string | null; // ISO
  isLive?: boolean | null;
};

export type AuctionActiveItem = {
  id: string; // chain auctionId as string
  seller?: { address?: string | null } | null;
  currency?: { symbol?: string | null; decimals?: number | null } | null;
  price?: { current?: string | null } | null;
  startTime?: string | null; // ISO
  endTime?: string | null; // ISO
};

export type OwnerMode = "none" | "list" | "auction" | "transfer";

export type CurrencyOption = {
  id: string;
  symbol: string;
  decimals: number;
  kind: "NATIVE" | "ERC20";
  tokenAddress: string | null;
};
