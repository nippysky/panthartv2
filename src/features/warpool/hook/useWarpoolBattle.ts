"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWarpoolBattle } from "@/src/features/warpool/lib/api";
import type {
  WarpoolBattle,
  WarpoolBattleEligibility,
} from "@/src/features/warpool/types";
import { usePolling } from "./usePolling";

export function useWarpoolBattle(
  poolId: string,
  walletAddress?: string | null
) {
  const [battle, setBattle] = useState<WarpoolBattle | null>(null);
  const [eligibility, setEligibility] =
    useState<WarpoolBattleEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        if (mode === "initial") setIsLoading(true);
        if (mode === "refresh") setIsRefreshing(true);

        setError(null);
        const data = await fetchWarpoolBattle(poolId, walletAddress);
        setBattle(data.battle);
        setEligibility(data.eligibility);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load battle.";
        setError(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [poolId, walletAddress]
  );

  useEffect(() => {
    if (!poolId) return;
    void load("initial");
  }, [load, poolId]);

  usePolling(() => load("refresh"), {
    enabled: !isLoading && !error && !!battle,
    intervalMs: 12000,
  });

  return {
    battle,
    eligibility,
    isLoading,
    isRefreshing,
    error,
    refetch: () => load("refresh"),
  };
}