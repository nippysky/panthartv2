export type ListingActiveItem = {
  id: string; // chain listingId as string
  dbId?: string; // prisma id (cursor/internal)

  sellerAddress: string | null;
  seller?: { address?: string | null; username?: string | null } | null;

  currency?: { symbol?: string | null; decimals?: number | null } | null;
  price?: { unit?: string | null; total?: string | null } | null;

  quantity?: number | null;
  startTime?: string | null; // ISO
  endTime?: string | null; // ISO
  isLive?: boolean | null;
};

export type AuctionActiveItem = {
  id: string; // chain auctionId as string
  dbId?: string; // prisma id (cursor/internal)

  // keep both styles for compatibility
  sellerAddress?: string | null;
  seller?: { address?: string | null; username?: string | null } | null;

  currency?: { symbol?: string | null; decimals?: number | null } | null;
  price?: { current?: string | null; currentWei?: string | null } | null;

  quantity?: number | null;
  startTime?: string | null; // ISO
  endTime?: string | null; // ISO
  isLive?: boolean | null;

  highestBidder?: string | null;
  bidsCount?: number | null;
};

export type OwnerMode = "none" | "list" | "auction" | "transfer";

export type CurrencyOption = {
  id: string;
  symbol: string;
  decimals: number;
  kind: "NATIVE" | "ERC20";
  tokenAddress: string | null;
};
