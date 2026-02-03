"use client";

import { useEffect, useState } from "react";
import { marketplace } from "@/src/lib/services/marketplace";

function toChainIdBigInt(id?: string | null): bigint | null {
  const s = (id ?? "").trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return null; // guard: reject prisma cuid / hex / junk
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

export function useChainMirrors(args: { listingId?: string | null; auctionId?: string | null }) {
  const { listingId, auctionId } = args;

  const [chainListing, setChainListing] = useState<{
    id: bigint;
    startSec: number;
    endSec: number;
  } | null>(null);

  const [chainAuction, setChainAuction] = useState<{
    id: bigint;
    startSec: number;
    endSec: number;
    settled: boolean;
    bidsCount: number;
    startPrice: bigint;
    minIncrement: bigint;
    highestBid: bigint;
    currency: `0x${string}`;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const id = toChainIdBigInt(listingId);
      if (id == null) {
        setChainListing(null);
        return;
      }

      try {
        const on = await marketplace.readListingById(id);
        if (!alive) return;

        if (!on) {
          setChainListing(null);
          return;
        }

        setChainListing({
          id: on.id,
          startSec: Number(on.row.start),
          endSec: Number(on.row.end),
        });
      } catch {
        if (!alive) return;
        setChainListing(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [listingId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const id = toChainIdBigInt(auctionId);
      if (id == null) {
        setChainAuction(null);
        return;
      }

      try {
        const on = await marketplace.readAuctionById(id);
        if (!alive) return;

        if (!on) {
          setChainAuction(null);
          return;
        }

        setChainAuction({
          id: on.id,
          startSec: Number(on.row.start),
          endSec: Number(on.row.end),
          settled: Boolean(on.row.settled),
          bidsCount: Number(on.row.bidsCount || 0),
          startPrice: on.row.startPrice,
          minIncrement: on.row.minIncrement,
          highestBid: on.row.highestBid,
          currency: on.row.currency,
        });
      } catch {
        if (!alive) return;
        setChainAuction(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [auctionId]);

  return { chainListing, chainAuction };
}
