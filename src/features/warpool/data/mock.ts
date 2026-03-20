import type {
  WarpoolBattle,
  WarpoolBattleEligibility,
  WarpoolHistoryItem,
  WarpoolQueue,
  WarpoolQueueEligibility,
  WarpoolRecentWinner,
} from "@/src/features/warpool/types";

export const warpoolQueues: WarpoolQueue[] = [
  {
    id: "q-bronze-1v1",
    slug: "bronze-1v1",
    title: "Bronze Duel Queue",
    format: "1v1",
    stake: "25 DCNT",
    fee: "2 DCNT",
    entrants: 12,
    maxEntrants: 20,
    eta: "3 min",
    status: "Open",
    highlight: "Fast entry. Lower risk. Great for first battles.",
    summary:
      "Fast low-stakes head-to-head queue for quick entry and fast battle turnover.",
    rules: [
      "Reserve a slot with a connected wallet.",
      "Entry becomes active once queue fills and pool is formed.",
      "Winning side receives the prize pool after platform logic resolves.",
    ],
  },
  {
    id: "q-silver-2v2",
    slug: "silver-2v2",
    title: "Silver Squads Queue",
    format: "2v2",
    stake: "75 DCNT",
    fee: "4 DCNT",
    entrants: 14,
    maxEntrants: 16,
    eta: "1 min",
    status: "Filling",
    highlight: "Nearly full. Team pressure with stronger rewards.",
    summary:
      "Small squad combat with higher conviction and faster fill velocity.",
    rules: [
      "Reserve before the final slots close.",
      "Queue state locks shortly before pool creation.",
      "Players follow battle state from the live pool page once matched.",
    ],
  },
  {
    id: "q-gold-royale",
    slug: "gold-royale",
    title: "Gold Royale Queue",
    format: "8-player",
    stake: "150 DCNT",
    fee: "7 DCNT",
    entrants: 6,
    maxEntrants: 8,
    eta: "5 min",
    status: "Starting Soon",
    highlight: "High-stakes bracket with premium relist pressure.",
    summary:
      "Premium bracket queue for larger prize pools and higher pressure entries.",
    rules: [
      "Large-format battle with premium pool sizing.",
      "Final entrants trigger pool creation flow.",
      "History records outcome and winning wallet after settlement.",
    ],
  },
];

export const warpoolRecentWinners: WarpoolRecentWinner[] = [
  {
    id: "2041",
    label: "Bronze Duel #2041",
    winner: "0x92f4...93ee",
    prize: "46.8 DCNT",
    time: "8 mins ago",
  },
  {
    id: "2038",
    label: "Silver Squads #2038",
    winner: "0xa44d...1a09",
    prize: "138.0 DCNT",
    time: "17 mins ago",
  },
  {
    id: "2032",
    label: "Gold Royale #2032",
    winner: "0x7c1a...ee72",
    prize: "552.0 DCNT",
    time: "31 mins ago",
  },
];

export const warpoolHistory: WarpoolHistoryItem[] = [
  {
    id: "2041",
    queue: "Bronze Duel Queue",
    winner: "0x92f4...93ee",
    prize: "46.8 DCNT",
    status: "Settled",
    time: "Today · 18:24 WAT",
  },
  {
    id: "2038",
    queue: "Silver Squads Queue",
    winner: "0xa44d...1a09",
    prize: "138.0 DCNT",
    status: "Settled",
    time: "Today · 18:15 WAT",
  },
  {
    id: "2032",
    queue: "Gold Royale Queue",
    winner: "0x7c1a...ee72",
    prize: "552.0 DCNT",
    status: "Settled",
    time: "Today · 17:58 WAT",
  },
];

export const warpoolBattleById: Record<string, WarpoolBattle> = {
  "2041": {
    poolId: "2041",
    queue: "Bronze Duel Queue",
    state: "Live",
    stake: "25 DCNT",
    prizePool: "46.8 DCNT",
    startedAt: "Today · 18:12 WAT",
    round: "Round 1",
    arena: "Comrade Arena Alpha",
    fighters: [
      {
        side: "Comrade A",
        wallet: "0x92f4...93ee",
        health: 68,
        status: "Advancing",
      },
      {
        side: "Comrade B",
        wallet: "0x31a2...88cf",
        health: 41,
        status: "Under pressure",
      },
    ],
    timeline: [
      "Pool locked and battle initialized.",
      "Entry validation completed.",
      "Round 1 action committed.",
      "Settlement pending final outcome.",
    ],
  },
  "2038": {
    poolId: "2038",
    queue: "Silver Squads Queue",
    state: "Settled",
    stake: "75 DCNT",
    prizePool: "138.0 DCNT",
    startedAt: "Today · 17:58 WAT",
    round: "Complete",
    arena: "Comrade Arena Sigma",
    fighters: [
      {
        side: "Squad A",
        wallet: "0xa44d...1a09",
        health: 100,
        status: "Winner",
      },
      {
        side: "Squad B",
        wallet: "0x88ab...cd91",
        health: 0,
        status: "Eliminated",
      },
    ],
    timeline: [
      "Pool locked and battle initialized.",
      "Team validation completed.",
      "Battle resolved successfully.",
      "Winner settlement completed.",
    ],
  },
};

export function getWarpoolQueueBySlug(slug: string) {
  return warpoolQueues.find((item) => item.slug === slug) ?? null;
}

export function getWarpoolBattleById(poolId: string) {
  return warpoolBattleById[poolId] ?? null;
}

export function getWarpoolQueueEligibility(
  slug: string,
  walletAddress?: string | null
): WarpoolQueueEligibility | null {
  const queue = getWarpoolQueueBySlug(slug);
  if (!queue) return null;

  if (!walletAddress) {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: false,
      reservationExpiresAt: null,
      reason: "wallet_required",
    };
  }

  if (queue.entrants >= queue.maxEntrants) {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: false,
      reservationExpiresAt: null,
      reason: "queue_full",
    };
  }

  if (queue.status === "Starting Soon") {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: false,
      reservationExpiresAt: null,
      reason: "queue_locked",
    };
  }

  return {
    walletRequired: true,
    canReserve: true,
    isReservedByViewer: false,
    reservationExpiresAt: new Date(
      Date.now() + 8 * 60 * 1000
    ).toISOString(),
    reason: "ok",
  };
}

export function getWarpoolBattleEligibility(
  poolId: string,
  walletAddress?: string | null
): WarpoolBattleEligibility | null {
  const battle = getWarpoolBattleById(poolId);
  if (!battle) return null;

  if (!walletAddress) {
    return {
      walletRequired: true,
      isParticipant: false,
      isWinner: false,
      canConfirm: false,
      canClaim: false,
      claimableAt: null,
      reason: "wallet_required",
    };
  }

  if (poolId === "2041") {
    return {
      walletRequired: true,
      isParticipant: true,
      isWinner: false,
      canConfirm: true,
      canClaim: false,
      claimableAt: new Date(
        Date.now() + 12 * 60 * 1000
      ).toISOString(),
      reason: "ok",
    };
  }

  if (poolId === "2038") {
    return {
      walletRequired: true,
      isParticipant: true,
      isWinner: true,
      canConfirm: false,
      canClaim: true,
      claimableAt: new Date(Date.now() - 60 * 1000).toISOString(),
      reason: "ok",
    };
  }

  return {
    walletRequired: true,
    isParticipant: false,
    isWinner: false,
    canConfirm: false,
    canClaim: false,
    claimableAt: null,
    reason: "not_participant",
  };
}