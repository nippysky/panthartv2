/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuctionActiveItem, ListingActiveItem } from "../types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
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

  // avoid setting state after unmount / param change
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetchState = useCallback(async () => {
    const [lRes, aRes] = await Promise.all([
      fetch(
        `/api/listing/active?contract=${encodeURIComponent(
          contract
        )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&chain=1`,
        { cache: "no-store" }
      ).then((r) => r.json().catch(() => null)),
      fetch(
        `/api/auction/active?contract=${encodeURIComponent(
          contract
        )}&tokenId=${encodeURIComponent(tokenId)}&limit=1&chain=1`,
        { cache: "no-store" }
      ).then((r) => r.json().catch(() => null)),
    ]);

    const li =
      lRes && isRecord(lRes) && Array.isArray((lRes as any).items)
        ? ((lRes as any).items[0] as ListingActiveItem) ?? null
        : null;

    const au =
      aRes && isRecord(aRes) && Array.isArray((aRes as any).items)
        ? ((aRes as any).items[0] as AuctionActiveItem) ?? null
        : null;

    // IMPORTANT:
    // Do NOT null out listing/auction just because isLive === false.
    // Scheduled items must still show with disabled CTA + countdown.
    return { li, au };
  }, [contract, tokenId]);

  // Imperative refresh for UI actions (buttons, after tx, etc.)
  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const { li, au } = await fetchState();
      if (!aliveRef.current) return;

      setListing(li ?? null);
      setAuction(au ?? null);
      onAfterRefreshReset?.();
    } catch {
      if (!aliveRef.current) return;

      setErr("Failed to load market state.");
      setListing(null);
      setAuction(null);
      onAfterRefreshReset?.();
    }
  }, [fetchState, onAfterRefreshReset]);

  // Initial + param-change load (async inside effect)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setErr(null);
      try {
        const { li, au } = await fetchState();
        if (cancelled || !aliveRef.current) return;

        setListing(li ?? null);
        setAuction(au ?? null);
        onAfterRefreshReset?.();
      } catch {
        if (cancelled || !aliveRef.current) return;

        setErr("Failed to load market state.");
        setListing(null);
        setAuction(null);
        onAfterRefreshReset?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchState, onAfterRefreshReset]);

  // Better UX: refresh when user returns to tab + gentle polling while visible
  useEffect(() => {
    let interval: number | null = null;

    const start = () => {
      if (interval != null) return;
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, 15000); // 15s gentle poll
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

    // initial
    if (document.visibilityState === "visible") start();

    return () => {
      stop();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  return { listing, auction, err, setErr, refresh };
}
