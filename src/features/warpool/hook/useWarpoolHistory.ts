"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWarpoolHistory } from "@/src/features/warpool/lib/api";
import { matchesHistoryFilter } from "@/src/features/warpool/lib/helpers";

import type {
  HistoryFilterValue,
  WarpoolHistoryItem,
} from "@/src/features/warpool/types";
import { usePolling } from "./usePolling";

export function useWarpoolHistory() {
  const [items, setItems] = useState<WarpoolHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<HistoryFilterValue>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setIsLoading(true);
      if (mode === "refresh") setIsRefreshing(true);

      setError(null);
      const data = await fetchWarpoolHistory();
      setItems(data.items);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load history.";
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
    intervalMs: 20000,
  });

  const filteredItems = useMemo(
    () => items.filter((item) => matchesHistoryFilter(item, search, filter)),
    [items, search, filter]
  );

  return {
    items,
    filteredItems,
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