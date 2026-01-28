"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Currency = {
  id: string | null;
  kind: "NATIVE" | "ERC20";
  symbol: string;
  decimals: number;
  tokenAddress: string | null;
};

type ListingItem = {
  id: string;
  nft: {
    contract: string;
    tokenId: string;
    name: string;
    image: string | null;
    standard: string;
  };
  startTime: string;
  endTime: string | null;
  isLive: boolean;
  currency: Currency;
  price: {
    unitWei: string | null;
    unit: string | null;
    totalWei: string | null;
    total: string | null;
  };
  sellerAddress: string | null;
  quantity: number;
};

type AuctionItem = {
  id: string;
  startTime: string;
  endTime: string;
  quantity: number;
  seller: {
    address: string | null;
    username: string | null;
  };
  nft: {
    contract: string;
    tokenId: string;
    name: string;
    image: string | null;
    standard: string;
  };
  currency: Currency;
  price: {
    currentWei?: string;
    current?: string;
  };
};

type ListingResp = { items: ListingItem[]; nextCursor?: string | null } | null;
type AuctionResp = { items: AuctionItem[]; nextCursor?: string | null } | null;

async function getJson<T>(url: string): Promise<T | null> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return null;
  try {
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function canPoll() {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}

export function useMarketplaceLive(opts: {
  contract: string;
  tokenId: string | number;
  account?: string | null;
}) {
  const { contract, tokenId } = opts;
  const tokenIdStr = String(tokenId);
  const qc = useQueryClient();

  const listingsQ = useQuery({
    queryKey: ["activeListings", contract, tokenIdStr],
    queryFn: () =>
      getJson<ListingResp>(
        `/api/listing/active?contract=${encodeURIComponent(
          contract
        )}&tokenId=${encodeURIComponent(tokenIdStr)}&limit=1&strictOwner=1`
      ),
    refetchInterval: canPoll() ? 20_000 : false,
  });

  const auctionsQ = useQuery({
    queryKey: ["activeAuctions", contract, tokenIdStr],
    queryFn: () =>
      getJson<AuctionResp>(
        `/api/auction/active?contract=${encodeURIComponent(
          contract
        )}&tokenId=${encodeURIComponent(tokenIdStr)}&limit=1&strictOwner=1`
      ),
    refetchInterval: canPoll() ? 20_000 : false,
  });

  const listing = listingsQ.data?.items?.[0] ?? null;
  const auction = auctionsQ.data?.items?.[0] ?? null;

  const hasAnyListings = Boolean(listingsQ.data?.items?.length);
  const hasAnyAuctions = Boolean(auctionsQ.data?.items?.length);

  const setHasAnyListingsOptimistic = useCallback(
    (value: boolean) => {
      qc.setQueryData<ListingResp>(["activeListings", contract, tokenIdStr], () => {
        if (!value) return { items: [] };

        const optimistic: ListingItem = {
          id: "optimistic",
          nft: {
            contract,
            tokenId: tokenIdStr,
            name: `#${tokenIdStr}`,
            image: null,
            standard: "ERC721",
          },
          startTime: new Date().toISOString(),
          endTime: null,
          isLive: true,
          currency: {
            id: null,
            kind: "NATIVE",
            symbol: "ETN",
            decimals: 18,
            tokenAddress: null,
          },
          price: {
            unitWei: "0",
            unit: "0",
            totalWei: "0",
            total: "0",
          },
          sellerAddress: null,
          quantity: 1,
        };

        return { items: [optimistic] };
      });
    },
    [qc, contract, tokenIdStr]
  );

  const setHasAnyAuctionsOptimistic = useCallback(
    (value: boolean) => {
      qc.setQueryData<AuctionResp>(["activeAuctions", contract, tokenIdStr], () => {
        if (!value) return { items: [] };

        const optimistic: AuctionItem = {
          id: "optimistic",
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60_000).toISOString(),
          quantity: 1,
          seller: { address: null, username: null },
          nft: {
            contract,
            tokenId: tokenIdStr,
            name: `#${tokenIdStr}`,
            image: null,
            standard: "ERC721",
          },
          currency: {
            id: null,
            kind: "NATIVE",
            symbol: "ETN",
            decimals: 18,
            tokenAddress: null,
          },
          price: { currentWei: "0", current: "0" },
        };

        return { items: [optimistic] };
      });
    },
    [qc, contract, tokenIdStr]
  );

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["activeListings", contract, tokenIdStr] }),
      qc.invalidateQueries({ queryKey: ["activeAuctions", contract, tokenIdStr] }),
    ]);
  }, [qc, contract, tokenIdStr]);

  return {
    // flags
    hasAnyListings,
    hasAnyAuctions,

    // top items (for real market UI)
    listing,
    auction,

    // state
    isFetching: listingsQ.isFetching || auctionsQ.isFetching,

    // optimistic helpers
    setHasAnyListingsOptimistic,
    setHasAnyAuctionsOptimistic,
    invalidateAll,
  };
}
