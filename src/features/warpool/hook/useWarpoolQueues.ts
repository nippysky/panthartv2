"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWarpoolQueues } from "@/src/features/warpool/lib/api";
import { matchesQueueFilter } from "@/src/features/warpool/lib/helpers";
import type {
  QueueFilterValue,
  WarpoolQueue,
  WarpoolRecentWinner,
} from "@/src/features/warpool/types";
import { usePolling } from "./usePolling";

export function useWarpoolQueues() {
  const [queues, setQueues] = useState<WarpoolQueue[]>([]);
  const [recentWinners, setRecentWinners] = useState<WarpoolRecentWinner[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<QueueFilterValue>("all");
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
    intervalMs: 15000,
  });

  const filteredQueues = useMemo(
    () => queues.filter((queue) => matchesQueueFilter(queue, search, filter)),
    [queues, search, filter]
  );

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
    filteredQueues,
    recentWinners,
    liveQueueCount,
    search,
    setSearch,
    filter,
    setFilter,
    isLoading,
    isRefreshing,
    error,
    refetch: () => load("refresh"),
  };
}