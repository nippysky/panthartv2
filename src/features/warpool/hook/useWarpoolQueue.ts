"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWarpoolQueueBySlug } from "@/src/features/warpool/lib/api";
import type {
  WarpoolQueue,
  WarpoolQueueEligibility,
} from "@/src/features/warpool/types";
import { usePolling } from "./usePolling";

export function useWarpoolQueue(
  queueSlug: string,
  walletAddress?: string | null
) {
  const [queue, setQueue] = useState<WarpoolQueue | null>(null);
  const [eligibility, setEligibility] =
    useState<WarpoolQueueEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        if (mode === "initial") setIsLoading(true);
        if (mode === "refresh") setIsRefreshing(true);

        setError(null);
        const data = await fetchWarpoolQueueBySlug(queueSlug, walletAddress);
        setQueue(data.queue);
        setEligibility(data.eligibility);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load queue.";
        setError(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [queueSlug, walletAddress]
  );

  useEffect(() => {
    if (!queueSlug) return;
    void load("initial");
  }, [load, queueSlug]);

  usePolling(() => load("refresh"), {
    enabled: !isLoading && !error && !!queue,
    intervalMs: 15000,
  });

  return {
    queue,
    eligibility,
    isLoading,
    isRefreshing,
    error,
    refetch: () => load("refresh"),
  };
}