/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuctionActiveItem, ListingActiveItem } from "../types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pickFirstItem<T>(data: unknown): T | null {
  if (!data) return null;

  if (isRecord(data) && Array.isArray((data as any).items)) {
    return ((data as any).items[0] as T) ?? null;
  }

  if (Array.isArray(data)) {
    return (data[0] as T) ?? null;
  }

  return null;
}

/** chain ids should be pure digits; anything else is not safe for BigInt() */
function isChainIdString(id: unknown): id is string {
  if (typeof id !== "string") return false;
  const s = id.trim();
  if (!s) return false;
  return /^[0-9]+$/.test(s);
}

function normalizeListing(x: unknown): ListingActiveItem | null {
  if (!x || !isRecord(x)) return null;

  // MUST be chain id for on-chain actions
  const id = (x as any).id;
  if (!isChainIdString(id)) return null;

  // Scheduled listings have isLive=false and must remain visible.
  return x as ListingActiveItem;
}

function normalizeAuction(x: unknown): AuctionActiveItem | null {
  if (!x || !isRecord(x)) return null;

  const id = (x as any).id;
  if (!isChainIdString(id)) return null;

  // prefer seller.address, fallback to sellerAddress
  const sellerObj = (x as any).seller;
  const sellerAddressCompat = (x as any).sellerAddress;

  if (!sellerObj || !isRecord(sellerObj)) {
    (x as any).seller = {
      address: typeof sellerAddressCompat === "string" ? sellerAddressCompat : null,
      username: null,
    };
  } else if (!(sellerObj as any).address && typeof sellerAddressCompat === "string") {
    (x as any).seller = { ...(sellerObj as any), address: sellerAddressCompat };
  }

  return x as AuctionActiveItem;
}

function rawLooksPresentButRejected(raw: unknown, norm: unknown) {
  return raw != null && norm == null;
}

export function useMarketState(args: {
  contract: string;
  tokenId: string;
  onAfterRefreshReset?: () => void;
}) {
  const { contract, tokenId, onAfterRefreshReset } = args;

  const [listing, setListing] = useState<ListingActiveItem | null>(null);
  const [auction, setAuction] = useState<AuctionActiveItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reqIdRef = useRef(0);

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, [contract, tokenId]);

  const urlListing = useMemo(() => {
    // ✅ IMPORTANT: NO strictOwner on token page.
    return `/api/listing/active?contract=${encodeURIComponent(
      contract
    )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&chain=1`;
  }, [contract, tokenId]);

  const urlAuction = useMemo(() => {
    // ✅ IMPORTANT: NO strictOwner on token page.
    return `/api/auction/active?contract=${encodeURIComponent(
      contract
    )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&chain=1`;
  }, [contract, tokenId]);

  const fetchState = useCallback(async () => {
    const [lRes, aRes] = await Promise.all([
      fetch(urlListing, { cache: "no-store" }),
      fetch(urlAuction, { cache: "no-store" }),
    ]);

    const [lJson, aJson] = await Promise.all([
      lRes.json().catch(() => null),
      aRes.json().catch(() => null),
    ]);

    const liRaw = pickFirstItem<ListingActiveItem>(lJson);
    const auRaw = pickFirstItem<AuctionActiveItem>(aJson);

    const li = normalizeListing(liRaw);
    const au = normalizeAuction(auRaw);

    return {
      liRaw,
      auRaw,
      li,
      au,
      bad: !lRes.ok || !aRes.ok,
    };
  }, [urlListing, urlAuction]);

  const refresh = useCallback(async () => {
    setErr(null);
    const myReq = ++reqIdRef.current;

    try {
      const { liRaw, auRaw, li, au, bad } = await fetchState();
      if (!aliveRef.current) return;
      if (myReq !== reqIdRef.current) return;

      setListing(li ?? null);
      setAuction(au ?? null);

      if (bad) {
        setErr("Failed to load market state.");
      } else {
        const rejectedListing = rawLooksPresentButRejected(liRaw, li);
        const rejectedAuction = rawLooksPresentButRejected(auRaw, au);
        if (rejectedListing || rejectedAuction) {
          setErr("Market data looked inconsistent. Please refresh.");
        }
      }

      onAfterRefreshReset?.();
    } catch {
      if (!aliveRef.current) return;
      if (myReq !== reqIdRef.current) return;

      setErr("Failed to load market state.");
      setListing(null);
      setAuction(null);
      onAfterRefreshReset?.();
    }
  }, [fetchState, onAfterRefreshReset]);

  useEffect(() => {
    const t = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(t);
  }, [refresh]);

  useEffect(() => {
    let interval: number | null = null;

    const start = () => {
      if (interval != null) return;
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, 15000);
    };

    const stop = () => {
      if (interval == null) return;
      window.clearInterval(interval);
      interval = null;
    };

    const onFocus = () => void refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    if (document.visibilityState === "visible") start();

    return () => {
      stop();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  return { listing, auction, err, setErr, refresh };
}