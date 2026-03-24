"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWarpoolQueues } from "@/src/features/warpool/lib/api";
import type {
  WarpoolQueue,
  WarpoolRecentWinner,
} from "@/src/features/warpool/types";
import { usePolling } from "./usePolling";

export function useWarpoolQueues() {
  const [queues, setQueues] = useState<WarpoolQueue[]>([]);
  const [recentWinners, setRecentWinners] = useState<WarpoolRecentWinner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setIsLoading(true);
      if (mode === "refresh") setIsRefreshing(true);

      setError(null);
      const data = await fetchWarpoolQueues();
      setQueues(data.queues);
      setRecentWinners(data.recentWinners);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load queues.";
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  usePolling(() => load("refresh"), {
    enabled: !isLoading && !error,
    intervalMs: 10000,
  });

  const liveQueueCount = useMemo(
    () =>
      queues.filter(
        (q) =>
          q.status === "Open" ||
          q.status === "Filling" ||
          q.status === "Locked" ||
          q.status === "Battle Ready"
      ).length,
    [queues]
  );

  return {
    queues,
    recentWinners,
    liveQueueCount,
    isLoading,
    isRefreshing,
    error,
    refetch: () => load("refresh"),
  };
}