/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { ethers } from "ethers";
import prisma, { prismaReady } from "@/src/lib/db";
import type {
  WarpoolBattle,
  WarpoolBattleEligibility,
  WarpoolHistoryItem,
  WarpoolQueue,
  WarpoolQueueEligibility,
  WarpoolRecentWinner,
  WarpoolTimelineItem,
} from "@/src/features/warpool/types";

type QueueSlug =
  | "FORGE_SAFEGUARD"
  | "LEGION_SAFEGUARD"
  | "LEGION_VAULTBOUND"
  | "CROWN_VAULTBOUND";

type QueueMeta = {
  title: string;
  format: string;
  highlight: string;
  summary: string;
  rules: string[];
};

const QUEUE_ORDER: QueueSlug[] = [
  "FORGE_SAFEGUARD",
  "LEGION_SAFEGUARD",
  "LEGION_VAULTBOUND",
  "CROWN_VAULTBOUND",
];

const LIVE_STATES = ["OPEN", "LOCKED", "BATTLE_READY", "SETTLING"] as const;

const QUEUE_META: Record<QueueSlug, QueueMeta> = {
  FORGE_SAFEGUARD: {
    title: "Forge Safeguard",
    format: "Forge · Safeguard",
    highlight: "Entry-level safeguard pool",
    summary:
      "Fast entry safeguard queue for Forge-tier play. Losing fighters are returned in safeguard mode.",
    rules: [
      "Safeguard mode returns fighters after settlement.",
      "Queue opens and fills toward the configured target size.",
      "If the queue expires below minimum size, all paid stake is refunded.",
    ],
  },
  LEGION_SAFEGUARD: {
    title: "Legion Safeguard",
    format: "Legion · Safeguard",
    highlight: "Mid-tier safeguarded battles",
    summary:
      "Legion queue with safeguard protection. Good for players who want competitive entry without capture risk.",
    rules: [
      "Safeguard mode returns fighters after settlement.",
      "Only eligible fighters from the configured collection may enter.",
      "If the queue expires below minimum size, all paid stake is refunded.",
    ],
  },
  LEGION_VAULTBOUND: {
    title: "Legion Vaultbound",
    format: "Legion · Vaultbound",
    highlight: "Vaultbound with capture pressure",
    summary:
      "Legion vaultbound queue where non-winning selected fighters can be captured after settlement.",
    rules: [
      "Vaultbound mode captures losing selected fighters after settlement.",
      "Prize distribution follows the pool snapshot percentages.",
      "If the queue expires below minimum size, paid stake is refunded and the queue reopens.",
    ],
  },
  CROWN_VAULTBOUND: {
    title: "Crown Vaultbound",
    format: "Crown · Vaultbound",
    highlight: "Top-tier queue with relic mechanics",
    summary:
      "Top-tier vaultbound queue with relic support. Tokens 1–10 use discount seats, while token 11 uses the dedicated god seat.",
    rules: [
      "Only Crown Vaultbound supports relic mechanics.",
      "Discount relics use the 2-seat cap for tokens 1–10.",
      "Token 11 uses the dedicated 1-seat god slot and enters with zero stake.",
      "Vaultbound mode captures losing selected fighters after settlement.",
    ],
  },
};

function pickQueueMeta(slug: string): QueueMeta {
  return QUEUE_META[(slug as QueueSlug) ?? "FORGE_SAFEGUARD"] ?? {
    title: slug,
    format: slug,
    highlight: "",
    summary: "",
    rules: [],
  };
}

function formatDcnt(raw?: any): string {
  try {
    return `${ethers.formatUnits(String(raw ?? 0), 18)} DCNT`;
  } catch {
    return "0 DCNT";
  }
}

function formatBps(bps?: number | null) {
  const value = Number(bps ?? 0) / 100;
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}%`;
}

function formatWhen(value?: Date | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(value);
}

function isExpiredOpenPool(pool: any) {
  if (!pool) return false;
  if (pool.state !== "OPEN") return false;
  if (!pool.expiresAt) return false;
  return new Date(pool.expiresAt).getTime() <= Date.now();
}

function queueStatusFromPool(pool: any): WarpoolQueue["status"] {
  if (!pool) return "Closed";

  if (isExpiredOpenPool(pool)) {
    return "Closed";
  }

  switch (pool.state) {
    case "OPEN":
      return pool.entrantCount > 0 ? "Filling" : "Open";
    case "LOCKED":
      return "Locked";
    case "BATTLE_READY":
    case "SETTLING":
      return "Battle Ready";
    case "SETTLED":
    case "CLOSED":
      return "Settled";
    case "EXPIRED_REFUNDED":
    default:
      return "Closed";
  }
}

function battleStateFromPool(pool: any, battle: any): WarpoolBattle["state"] {
  if (battle?.status === "SETTLED" || pool?.state === "CLOSED") return "Settled";
  if (pool?.state === "BATTLE_READY" || pool?.state === "SETTLING") {
    return "Battle Ready";
  }
  if (pool?.state === "LOCKED") return "Locked";
  if (pool?.state === "OPEN") return isExpiredOpenPool(pool) ? "Expired" : "Open";
  if (pool?.state === "EXPIRED_REFUNDED") return "Expired";
  return "Closed";
}

function makeQueuePayload(config: any, pool: any): WarpoolQueue {
  const slug = String(pool?.queueSlug ?? config?.slug ?? "");
  const meta = pickQueueMeta(slug);
  const status = queueStatusFromPool(pool);

  const targetSize = Number(pool?.targetSize ?? config?.targetSize ?? 0);
  const entrants = Number(pool?.entrantCount ?? 0);

  const isStaleExpired = isExpiredOpenPool(pool);

  const remainingSpots = isStaleExpired ? 0 : Math.max(0, targetSize - entrants);
  const acceptsRelics =
    Number(pool?.tier ?? config?.tier ?? 0) === 3 &&
    Number(pool?.mode ?? config?.mode ?? 0) === 2;

  const discountRemaining = pool
    ? Math.max(
        0,
        Number(pool.discountSeatCap ?? 0) -
          Number(pool.discountSeatsUsed ?? 0) -
          Number(pool.discountSeatsReserved ?? 0)
      )
    : acceptsRelics
      ? 2
      : null;

  const token11Remaining = pool
    ? Math.max(
        0,
        Number(pool.token11SeatCap ?? 0) - Number(pool.token11SeatsUsed ?? 0)
      )
    : acceptsRelics
      ? 1
      : null;

  return {
    id: String(pool?.id ?? config?.id ?? slug),
    slug,
    title: meta.title,
    format: meta.format,
    stake: formatDcnt(pool?.stakeAmountRaw ?? config?.stakeAmountRaw),
    fee: formatBps(pool?.platformFeeBps ?? config?.platformFeeBps),
    entrants,
    maxEntrants: targetSize,
    eta: isStaleExpired
      ? "Processing expiry"
      : pool?.expiresAt
        ? formatWhen(pool.expiresAt)
        : "No live pool",
    status,
    highlight: meta.highlight,
    summary: meta.summary,
    rules: meta.rules,

    poolId: isStaleExpired ? null : pool?.id ? String(pool.id) : null,
    poolIdOnChain: isStaleExpired
      ? null
      : pool?.poolIdOnChain
        ? String(pool.poolIdOnChain)
        : null,
    queueKey: String(pool?.queueKey ?? config?.queueKey ?? ""),
    openedAt: pool?.openedAt ? pool.openedAt.toISOString() : null,
    expiresAt: isStaleExpired
      ? null
      : pool?.expiresAt
        ? pool.expiresAt.toISOString()
        : null,
    lockedAt: pool?.lockedAt ? pool.lockedAt.toISOString() : null,
    battleReadyAt: pool?.battleReadyAt ? pool.battleReadyAt.toISOString() : null,
    settledAt: pool?.settledAt ? pool.settledAt.toISOString() : null,
    configVersion: String(pool?.configVersion ?? config?.configVersion ?? ""),

    singleEntryPerWallet: Boolean(
      pool?.singleEntryPerWallet ?? config?.singleEntryPerWallet ?? true
    ),
    acceptsRelics,
    remainingSpots,
    discountSeatsRemaining: acceptsRelics ? discountRemaining : null,
    token11SeatsRemaining: acceptsRelics ? token11Remaining : null,
  };
}

async function getLatestQueueConfigs() {
  await prismaReady;

  const rows = await prisma.warpoolQueueConfig.findMany({
    orderBy: [{ slug: "asc" }, { configVersion: "desc" }, { syncedAt: "desc" }],
  });

  const map = new Map<string, any>();

  for (const row of rows) {
    const slug = String(row.slug);
    if (!map.has(slug)) {
      map.set(slug, row);
    }
  }

  return map;
}

async function getActivePoolsBySlug() {
  await prismaReady;

  const rows = await prisma.warpoolPool.findMany({
    where: {
      state: { in: [...LIVE_STATES] as any[] },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const map = new Map<string, any>();

  for (const row of rows) {
    const slug = row.queueSlug ? String(row.queueSlug) : "";
    if (slug && !map.has(slug)) {
      map.set(slug, row);
    }
  }

  return map;
}

export async function listWarpoolQueues(): Promise<WarpoolQueue[]> {
  const [configs, activePools] = await Promise.all([
    getLatestQueueConfigs(),
    getActivePoolsBySlug(),
  ]);

  const result: WarpoolQueue[] = [];

  for (const slug of QUEUE_ORDER) {
    const config = configs.get(slug) ?? null;
    const pool = activePools.get(slug) ?? null;

    if (!config && !pool) continue;
    result.push(makeQueuePayload(config, pool));
  }

  return result;
}

export async function getWarpoolQueueBySlug(
  slug: string
): Promise<WarpoolQueue | null> {
  const normalized = String(slug).toUpperCase();

  const [config, pool] = await Promise.all([
    prisma.warpoolQueueConfig.findFirst({
      where: { slug: normalized as any },
      orderBy: [{ configVersion: "desc" }, { syncedAt: "desc" }],
    }),
    prisma.warpoolPool.findFirst({
      where: {
        queueSlug: normalized as any,
        state: { in: [...LIVE_STATES] as any[] },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  if (!config && !pool) return null;
  return makeQueuePayload(config, pool);
}

export async function getWarpoolQueueEligibility(
  slug: string,
  walletAddress?: string | null
): Promise<WarpoolQueueEligibility | null> {
  const queue = await getWarpoolQueueBySlug(slug);

  if (!queue) {
    return null;
  }

  if (!walletAddress) {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: false,
      reservationExpiresAt: null,
      reason: "wallet_required",
    };
  }

  if (!queue.poolId || !queue.poolIdOnChain || queue.status === "Closed") {
    return {
      walletRequired: false,
      canReserve: false,
      isReservedByViewer: false,
      reservationExpiresAt: null,
      reason: "live_pool_unavailable",
    };
  }

  const activeReservation = await prisma.warpoolReservation.findFirst({
    where: {
      poolId: queue.poolId,
      userAddress: walletAddress,
      status: "ACTIVE",
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (queue.status === "Locked" || queue.status === "Battle Ready") {
    return {
      walletRequired: false,
      canReserve: false,
      isReservedByViewer: !!activeReservation,
      reservationExpiresAt: activeReservation?.expiresAtOnChain?.toISOString() ?? null,
      reason: "queue_locked",
    };
  }

  if (queue.remainingSpots <= 0) {
    return {
      walletRequired: false,
      canReserve: false,
      isReservedByViewer: !!activeReservation,
      reservationExpiresAt: activeReservation?.expiresAtOnChain?.toISOString() ?? null,
      reason: "queue_full",
    };
  }

  if (activeReservation) {
    return {
      walletRequired: false,
      canReserve: false,
      isReservedByViewer: true,
      reservationExpiresAt: activeReservation.expiresAtOnChain?.toISOString() ?? null,
      reason: "already_reserved",
    };
  }

  return {
    walletRequired: false,
    canReserve: queue.acceptsRelics,
    isReservedByViewer: false,
    reservationExpiresAt: null,
    reason: "ok",
  };
}

export async function listWarpoolRecentWinners(): Promise<WarpoolRecentWinner[]> {
  await prismaReady;

  const battles = await prisma.warpoolBattle.findMany({
    where: { status: "SETTLED" },
    orderBy: [{ settledAt: "desc" }, { updatedAt: "desc" }],
    take: 4,
    include: {
      pool: {
        include: {
          entries: true,
        },
      },
    },
  });

  return battles.map((battle) => {
    const winner = battle.pool.entries.find((entry) => entry.placement === 1);
    const queueMeta = pickQueueMeta(String(battle.pool.queueSlug ?? ""));

    return {
      id: String(battle.pool.id),
      label: queueMeta.title,
      winner: winner?.userAddress
        ? `${winner.userAddress.slice(0, 6)}…${winner.userAddress.slice(-4)}`
        : "Unknown",
      prize: formatDcnt(winner?.prizeAmountRaw ?? battle.prizePoolRaw ?? 0),
      time: formatWhen(battle.settledAt ?? battle.pool.settledAt ?? battle.updatedAt),
      settledAt:
        battle.settledAt?.toISOString() ??
        battle.pool.settledAt?.toISOString() ??
        null,
    };
  });
}

export async function listWarpoolHistory(): Promise<WarpoolHistoryItem[]> {
  await prismaReady;

  const battles = await prisma.warpoolBattle.findMany({
    where: { status: "SETTLED" },
    orderBy: [{ settledAt: "desc" }, { updatedAt: "desc" }],
    include: {
      pool: {
        include: {
          entries: true,
        },
      },
    },
  });

  return battles.map((battle) => {
    const winner = battle.pool.entries.find((entry) => entry.placement === 1);
    const queueMeta = pickQueueMeta(String(battle.pool.queueSlug ?? ""));

    return {
      id: String(battle.pool.id),
      queue: queueMeta.title,
      winner: winner?.userAddress
        ? `${winner.userAddress.slice(0, 6)}…${winner.userAddress.slice(-4)}`
        : "Unknown",
      prize: formatDcnt(winner?.prizeAmountRaw ?? battle.prizePoolRaw ?? 0),
      status: "Settled",
      time: formatWhen(battle.settledAt ?? battle.pool.settledAt ?? battle.updatedAt),
      settledAt:
        battle.settledAt?.toISOString() ??
        battle.pool.settledAt?.toISOString() ??
        null,
    };
  });
}

function timelineLabel(activity: any) {
  switch (activity.type) {
    case "POOL_OPENED":
      return "Pool opened";
    case "POOL_LOCKED":
      return "Pool locked for battle";
    case "POOL_BATTLE_READY":
      return "Battle ready";
    case "POOL_SETTLED":
      return "Pool settled";
    case "POOL_REOPENED":
      return "Queue reopened";
    case "POOL_EXPIRED_REFUNDED":
      return "Pool expired and refunded";
    case "ENTRY_JOINED":
      return "A fighter joined the pool";
    case "ENTRY_SELECTED":
      return "Entry selected for battle";
    case "ENTRY_REFUNDED":
      return "Entry refunded";
    case "ENTRY_CAPTURED":
      return "Captured fighter transferred";
    case "PRIZE_PAID":
      return "Prize distributed";
    default:
      return String(activity.type).replaceAll("_", " ");
  }
}

export async function getWarpoolBattleByPoolId(
  poolId: string
): Promise<WarpoolBattle | null> {
  await prismaReady;

  const pool = await prisma.warpoolPool.findFirst({
    where: { id: poolId },
    include: {
      battle: {
        include: {
          matches: true,
        },
      },
      entries: {
        include: {
          nft: true,
        },
        orderBy: [{ placement: "asc" }, { joinedAt: "asc" }],
      },
      activities: {
        orderBy: [{ timestamp: "desc" }],
        take: 12,
      },
    },
  });

  if (!pool) return null;

  const battle = pool.battle;
  const queueMeta = pickQueueMeta(String(pool.queueSlug ?? ""));

  const entries = pool.entries.map((entry) => ({
    id: String(entry.id),
    entryIdOnChain: String(entry.entryIdOnChain),
    wallet: entry.userAddress,
    comradeTokenId: String(entry.comradeTokenId),
    comradeImageUrl: entry.nft?.imageUrl ?? null,
    comradeName: entry.nft?.name ?? `Comrade #${entry.comradeTokenId}`,
    relicTokenId: entry.relicTokenId ? String(entry.relicTokenId) : null,
    relicType: String(entry.relicType),
    selectedForBattle: entry.selectedForBattle,
    placement: entry.placement ?? null,
    status: String(entry.status),
    paidStake: formatDcnt(entry.paidStakeAmountRaw),
  }));

  const timeline: WarpoolTimelineItem[] = pool.activities.map((activity) => ({
    id: String(activity.id),
    label: timelineLabel(activity),
    time: formatWhen(activity.timestamp),
  }));

  const first = pool.entries.find((entry) => entry.placement === 1);
  const second = pool.entries.find((entry) => entry.placement === 2);
  const third = pool.entries.find((entry) => entry.placement === 3);

  const round =
    pool.runnableSize > 0
      ? `${pool.runnableSize}-fighter bracket`
      : battle?.matches?.length
        ? `${battle.matches.length} matches`
        : "Battle flow";

  return {
    poolId: String(pool.id),
    queue: queueMeta.title,
    state: battleStateFromPool(pool, battle),
    stake: formatDcnt(pool.stakeAmountRaw),
    prizePool: formatDcnt(battle?.prizePoolRaw ?? 0),
    startedAt: formatWhen(pool.openedAt),
    round,
    arena: `${pool.entrantCount}/${pool.targetSize} fighters entered`,
    entries,
    timeline,
    firstPlaceWallet: first?.userAddress ?? null,
    secondPlaceWallet: second?.userAddress ?? null,
    thirdPlaceWallet: third?.userAddress ?? null,
  };
}

export async function getWarpoolBattleEligibility(
  poolId: string,
  walletAddress?: string | null
): Promise<WarpoolBattleEligibility | null> {
  await prismaReady;

  const pool = await prisma.warpoolPool.findFirst({
    where: { id: poolId },
    include: {
      battle: true,
      entries: true,
    },
  });

  if (!pool) return null;

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

  const participant = pool.entries.find(
    (entry) => entry.userAddress.toLowerCase() === walletAddress.toLowerCase()
  );

  if (!participant) {
    return {
      walletRequired: false,
      isParticipant: false,
      isWinner: false,
      canConfirm: false,
      canClaim: false,
      claimableAt: null,
      reason: "not_participant",
    };
  }

  const settled =
    pool.battle?.status === "SETTLED" ||
    pool.state === "CLOSED" ||
    pool.state === "SETTLED";

  const isWinner =
    participant.placement === 1 ||
    participant.placement === 2 ||
    participant.placement === 3;

  return {
    walletRequired: false,
    isParticipant: true,
    isWinner,
    canConfirm: false,
    canClaim: false,
    claimableAt: pool.settledAt?.toISOString() ?? null,
    reason: settled ? "already_claimed" : "battle_not_settled",
  };
}