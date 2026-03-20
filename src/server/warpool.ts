/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import prisma, { prismaReady } from "@/src/lib/db";
import type {
  WarpoolBattle,
  WarpoolBattleEligibility,
  WarpoolBattleEntry,
  WarpoolHistoryItem,
  WarpoolQueue,
  WarpoolQueueEligibility,
  WarpoolRecentWinner,
  WarpoolTimelineItem,
} from "@/src/features/warpool/types";

type QueueMeta = {
  title: string;
  format: string;
  highlight: string;
  summary: string;
  rules: string[];
};

const QUEUE_META: Record<string, QueueMeta> = {
  FORGE_SAFEGUARD: {
    title: "Forge Safeguard",
    format: "Tier 1 · Safeguard",
    highlight: "Entry-level live pool with lower pressure and faster visibility.",
    summary:
      "A live Warpool queue backed by on-chain config and worker-synced pool state.",
    rules: [
      "Queue data is sourced from live Warpool config and pool records.",
      "Relic reservation and fighter entry must be executed through wallet-backed on-chain actions.",
      "Battle, settlement, and capture outcomes are reflected from synced chain events.",
    ],
  },
  LEGION_SAFEGUARD: {
    title: "Legion Safeguard",
    format: "Tier 2 · Safeguard",
    highlight:
      "Mid-tier queue with stronger competition and deeper entrant pressure.",
    summary:
      "A real queue derived from the current on-chain configuration and active pool state.",
    rules: [
      "Pool size, stake, and prize path are driven by the live config snapshot.",
      "Entries appear here only after they are indexed from chain events.",
      "Settled outcomes and captures come from the worker + event sync pipeline.",
    ],
  },
  LEGION_VAULTBOUND: {
    title: "Legion Vaultbound",
    format: "Tier 2 · Vaultbound",
    highlight:
      "Vaultbound queue with live stakes, live entrants, and live pool timing.",
    summary:
      "This queue reflects real synced configuration, real active pools, and real battle state.",
    rules: [
      "Queue activity is sourced from worker-synced Warpool tables.",
      "Captured comrades and relist state are chain-backed, not simulated.",
      "Open, locked, battle-ready, and settled states come from real pool lifecycle transitions.",
    ],
  },
  CROWN_VAULTBOUND: {
    title: "Crown Vaultbound",
    format: "Tier 3 · Vaultbound",
    highlight:
      "Top-tier queue with the highest pressure and the strongest relist consequences.",
    summary:
      "A premium Warpool queue reflecting live config, live pools, live battles, and live settlement outcomes.",
    rules: [
      "Prize distribution follows the actual configured bps recorded on the pool.",
      "Battle results come from the worker’s seeded computation pipeline.",
      "History and winner surfaces are built from real settlement records.",
    ],
  },
};

function metaForSlug(slug: string): QueueMeta {
  return (
    QUEUE_META[slug] ?? {
      title: slug.replaceAll("_", " "),
      format: "Live queue",
      highlight: "Live Warpool queue.",
      summary: "Live queue state sourced from the Warpool backend.",
      rules: [
        "This queue is sourced from real Warpool config and pool records.",
        "Entries, battles, and settlements are chain-backed.",
        "Availability depends on the currently active live pool.",
      ],
    }
  );
}

function shortAddress(address?: string | null) {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function normalizeAddress(address?: string | null) {
  return address?.trim().toLowerCase() ?? "";
}

function formatWAT(value?: Date | string | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAgo(value?: Date | string | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hr${diffH === 1 ? "" : "s"} ago`;

  const diffD = Math.floor(diffH / 24);
  return `${diffD} day${diffD === 1 ? "" : "s"} ago`;
}

function formatDurationToExpiry(expiresAt?: Date | null) {
  if (!expiresAt) return "—";

  const diff = expiresAt.getTime() - Date.now();
  if (diff <= 0) return "Closing now";

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;

  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;

  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function toBigIntSafe(value: unknown): bigint {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(Math.trunc(value));
    if (typeof value === "string") return BigInt(value);
    if (
      value &&
      typeof value === "object" &&
      "toString" in value &&
      typeof value.toString === "function"
    ) {
      return BigInt(value.toString());
    }
    return BigInt(0);
  } catch {
    return BigInt(0);
  }
}

function formatTokenAmount(
  raw?: string | number | bigint | { toString(): string } | null,
  decimals = 18
) {
  const value = toBigIntSafe(raw);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;

  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, 2)
    .replace(/0+$/, "");

  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

function deriveQueueStatus(
  state: string | null | undefined,
  entrants: number,
  maxEntrants: number
) {
  if (state === "LOCKED") return "Locked" as const;
  if (state === "BATTLE_READY" || state === "SETTLING") {
    return "Battle Ready" as const;
  }
  if (
    state === "SETTLED" ||
    state === "CLOSED" ||
    state === "EXPIRED_REFUNDED"
  ) {
    return "Settled" as const;
  }

  if (maxEntrants > 0) {
    const pct = entrants / maxEntrants;
    if (pct >= 0.7) return "Filling" as const;
  }

  return "Open" as const;
}

async function getDcntDecimals(tokenAddress?: string | null) {
  if (!tokenAddress) return 18;

  const currency = await prisma.currency.findUnique({
    where: { tokenAddress },
    select: { decimals: true },
  });

  return currency?.decimals ?? 18;
}

async function getLatestQueueConfigs() {
  await prismaReady;

  const rows = await prisma.warpoolQueueConfig.findMany({
    orderBy: [{ syncedAt: "desc" }],
  });

  const seen = new Set<string>();
  const latest: typeof rows = [];

  for (const row of rows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    latest.push(row);
  }

  return latest;
}

async function getActivePoolsBySlug() {
  await prismaReady;

  const rows = await prisma.warpoolPool.findMany({
    where: {
      state: {
        in: ["OPEN", "LOCKED", "BATTLE_READY", "SETTLING"],
      },
    },
    orderBy: [{ openedAt: "desc" }],
  });

  const map = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!row.queueSlug) continue;
    if (!map.has(row.queueSlug)) {
      map.set(row.queueSlug, row);
    }
  }

  return map;
}

function buildQueueFromConfigAndPool(args: {
  config: Awaited<ReturnType<typeof getLatestQueueConfigs>>[number];
  pool: Awaited<ReturnType<typeof getActivePoolsBySlug>> extends Map<any, infer V>
    ? V | null
    : never;
  dcntDecimals: number;
}): WarpoolQueue {
  const { config, pool, dcntDecimals } = args;
  const meta = metaForSlug(config.slug);

  const entrants = pool?.entrantCount ?? 0;
  const maxEntrants = pool?.targetSize ?? config.targetSize;

  return {
    id: pool?.id ?? config.id,
    slug: config.slug,
    title: meta.title,
    format: meta.format,
    stake: `${formatTokenAmount(
      pool?.stakeAmountRaw ?? config.stakeAmountRaw,
      dcntDecimals
    )} DCNT`,
    fee: `${(config.platformFeeBps / 100).toFixed(2)}%`,
    entrants,
    maxEntrants,
    eta: pool?.expiresAt ? formatDurationToExpiry(pool.expiresAt) : "Waiting",
    status: deriveQueueStatus(pool?.state, entrants, maxEntrants),
    highlight: meta.highlight,
    summary: meta.summary,
    rules: meta.rules,
    poolId: pool?.id ?? null,
    queueKey: pool?.queueKey ?? config.queueKey,
    openedAt: pool?.openedAt?.toISOString() ?? null,
    expiresAt: pool?.expiresAt?.toISOString() ?? null,
    configVersion: String(pool?.configVersion ?? config.configVersion),
  };
}

export async function listWarpoolQueues(): Promise<WarpoolQueue[]> {
  const [configs, activePools, latestGlobal] = await Promise.all([
    getLatestQueueConfigs(),
    getActivePoolsBySlug(),
    prisma.warpoolGlobalConfigSnapshot.findFirst({
      orderBy: [{ syncedAt: "desc" }],
      select: { dcntToken: true },
    }),
  ]);

  const dcntDecimals = await getDcntDecimals(latestGlobal?.dcntToken ?? null);

  return configs.map((config) =>
    buildQueueFromConfigAndPool({
      config,
      pool: activePools.get(config.slug) ?? null,
      dcntDecimals,
    })
  );
}

export async function listWarpoolRecentWinners(): Promise<WarpoolRecentWinner[]> {
  await prismaReady;

  const rows = await prisma.warpoolBattle.findMany({
    where: {
      status: "SETTLED",
    },
    orderBy: [{ settledAt: "desc" }, { updatedAt: "desc" }],
    take: 3,
    select: {
      poolId: true,
      settledAt: true,
      updatedAt: true,
      prizePoolRaw: true,
      firstEntryId: true,
    },
  });

  const poolIds = rows.map((row) => row.poolId);
  const firstEntryIds = rows
    .map((row) => row.firstEntryId)
    .filter((value): value is string => !!value);

  const [pools, firstEntries] = await Promise.all([
    prisma.warpoolPool.findMany({
      where: {
        id: { in: poolIds },
      },
      select: {
        id: true,
        queueSlug: true,
        firstPlaceBps: true,
        entrantCount: true,
        stakeAmountRaw: true,
      },
    }),
    firstEntryIds.length
      ? prisma.warpoolEntry.findMany({
          where: {
            id: { in: firstEntryIds },
          },
          select: {
            id: true,
            userAddress: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const poolMap = new Map(pools.map((pool) => [pool.id, pool]));
  const entryMap = new Map(firstEntries.map((entry) => [entry.id, entry]));

  return rows.map((row) => {
    const pool = poolMap.get(row.poolId);
    const firstEntry = row.firstEntryId
      ? entryMap.get(row.firstEntryId) ?? null
      : null;

    const queueLabel = metaForSlug(pool?.queueSlug ?? "UNKNOWN").title;

    let prize = "—";
    if (row.prizePoolRaw) {
      prize = `${formatTokenAmount(row.prizePoolRaw)} DCNT`;
    } else if (pool?.stakeAmountRaw && pool?.firstPlaceBps != null) {
      const totalStake =
        toBigIntSafe(pool.stakeAmountRaw) * BigInt(pool.entrantCount || 0);
      const firstPrize =
        (totalStake * BigInt(pool.firstPlaceBps)) / BigInt(10000);
      prize = `${formatTokenAmount(firstPrize)} DCNT`;
    }

    return {
      id: row.poolId,
      label: `${queueLabel} · Pool`,
      winner: shortAddress(firstEntry?.userAddress ?? null),
      prize,
      time: formatAgo(row.settledAt ?? row.updatedAt),
    };
  });
}

export async function getWarpoolQueueBySlug(
  slug: string
): Promise<WarpoolQueue | null> {
  const queues = await listWarpoolQueues();
  return queues.find((q) => q.slug === slug) ?? null;
}

export async function getWarpoolQueueEligibility(
  slug: string,
  walletAddress?: string | null
): Promise<WarpoolQueueEligibility | null> {
  const queue = await getWarpoolQueueBySlug(slug);
  if (!queue) return null;

  const normalizedWallet = normalizeAddress(walletAddress);

  if (!normalizedWallet) {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: false,
      reservationExpiresAt: null,
      reason: "wallet_required",
    };
  }

  if (!queue.poolId) {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: false,
      reservationExpiresAt: null,
      reason: "live_pool_unavailable",
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

  if (
    queue.status === "Locked" ||
    queue.status === "Battle Ready" ||
    queue.status === "Settled"
  ) {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: false,
      reservationExpiresAt: null,
      reason: "queue_locked",
    };
  }

  const existing = await prisma.warpoolReservation.findFirst({
    where: {
      pool: {
        queueSlug: slug as never,
        state: "OPEN",
      },
      userAddress: normalizedWallet,
      status: "ACTIVE",
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      expiresAtOnChain: true,
    },
  });

  if (existing) {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: true,
      reservationExpiresAt: existing.expiresAtOnChain.toISOString(),
      reason: "already_reserved",
    };
  }

  return {
    walletRequired: true,
    canReserve: true,
    isReservedByViewer: false,
    reservationExpiresAt: null,
    reason: "ok",
  };
}

export async function listWarpoolHistory(): Promise<WarpoolHistoryItem[]> {
  await prismaReady;

  const rows = await prisma.warpoolPool.findMany({
    where: {
      state: {
        in: ["CLOSED", "SETTLED", "EXPIRED_REFUNDED"],
      },
    },
    orderBy: [{ closedAt: "desc" }, { settledAt: "desc" }, { updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      state: true,
      queueSlug: true,
      closedAt: true,
      settledAt: true,
      updatedAt: true,
      stakeAmountRaw: true,
      entrantCount: true,
      firstPlaceBps: true,
      battle: {
        select: {
          status: true,
          firstEntryId: true,
        },
      },
    },
  });

  const firstEntryIds = rows
    .map((row) => row.battle?.firstEntryId)
    .filter((value): value is string => !!value);

  const winnerEntries = firstEntryIds.length
    ? await prisma.warpoolEntry.findMany({
        where: {
          id: { in: firstEntryIds },
        },
        select: {
          id: true,
          userAddress: true,
        },
      })
    : [];

  const winnerEntryMap = new Map(
    winnerEntries.map((entry) => [entry.id, entry])
  );

  return rows.map((row) => {
    const queueTitle = metaForSlug(row.queueSlug ?? "UNKNOWN").title;
    const winnerEntry = row.battle?.firstEntryId
      ? winnerEntryMap.get(row.battle.firstEntryId) ?? null
      : null;

    const winnerPrize =
      row.state === "EXPIRED_REFUNDED"
        ? "Refunded"
        : `${formatTokenAmount(
            (toBigIntSafe(row.stakeAmountRaw) *
              BigInt(row.firstPlaceBps) *
              BigInt(row.entrantCount || 0)) /
              BigInt(10000)
          )} DCNT`;

    return {
      id: row.id,
      queue: queueTitle,
      winner:
        row.state === "EXPIRED_REFUNDED"
          ? "No winner"
          : shortAddress(winnerEntry?.userAddress ?? null),
      prize: winnerPrize,
      status:
        row.state === "EXPIRED_REFUNDED"
          ? "Expired"
          : row.battle?.status === "SETTLED"
          ? "Settled"
          : "Pending",
      time: formatWAT(row.closedAt ?? row.settledAt ?? row.updatedAt),
    };
  });
}

function activityLabel(type: string) {
  switch (type) {
    case "POOL_OPENED":
      return "Pool opened";
    case "POOL_LOCKED":
      return "Pool locked";
    case "POOL_BATTLE_READY":
      return "Battle ready";
    case "POOL_SETTLED":
      return "Pool settled";
    case "POOL_REOPENED":
      return "Pool reopened";
    case "POOL_EXPIRED_REFUNDED":
      return "Pool expired and refunded";
    case "RESERVATION_CREATED":
      return "Relic reservation created";
    case "RESERVATION_CONSUMED":
      return "Reservation consumed";
    case "RESERVATION_EXPIRED":
      return "Reservation expired";
    case "ENTRY_JOINED":
      return "Entry joined";
    case "ENTRY_SELECTED":
      return "Entry selected for battle";
    case "ENTRY_REFUNDED":
      return "Entry refunded";
    case "ENTRY_CAPTURED":
      return "Captured comrade transferred to worker";
    case "ENTRY_RETURNED":
      return "Captured comrade returned";
    case "PRIZE_PAID":
      return "Prize paid";
    case "RELIC_RETURNED":
      return "Relic returned";
    default:
      return type;
  }
}

export async function getWarpoolBattleByPoolId(
  poolId: string
): Promise<WarpoolBattle | null> {
  await prismaReady;

  const pool = await prisma.warpoolPool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      state: true,
      queueSlug: true,
      lockedAt: true,
      openedAt: true,
      stakeAmountRaw: true,
      battle: {
        select: {
          id: true,
          prizePoolRaw: true,
          firstEntryId: true,
          secondEntryId: true,
          thirdEntryId: true,
          matches: {
            orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
            select: {
              roundNumber: true,
              matchNumber: true,
            },
          },
        },
      },
      entries: {
        orderBy: [{ joinedAt: "asc" }],
        select: {
          id: true,
          entryIdOnChain: true,
          userAddress: true,
          comradeTokenId: true,
          relicTokenId: true,
          relicType: true,
          selectedForBattle: true,
          placement: true,
          status: true,
          paidStakeAmountRaw: true,
          nft: {
            select: {
              imageUrl: true,
              name: true,
            },
          },
        },
      },
      activities: {
        orderBy: [{ timestamp: "asc" }],
        select: {
          id: true,
          type: true,
          timestamp: true,
        },
      },
    },
  });

  if (!pool) return null;

  const entries: WarpoolBattleEntry[] = pool.entries.map((entry) => ({
    id: entry.id,
    entryIdOnChain: entry.entryIdOnChain.toString(),
    wallet: entry.userAddress,
    comradeTokenId: entry.comradeTokenId,
    comradeImageUrl: entry.nft?.imageUrl ?? null,
    comradeName: entry.nft?.name ?? `Comrade #${entry.comradeTokenId}`,
    relicTokenId: entry.relicTokenId ?? null,
    relicType: entry.relicType,
    selectedForBattle: entry.selectedForBattle,
    placement: entry.placement ?? null,
    status: entry.status,
    paidStake: `${formatTokenAmount(entry.paidStakeAmountRaw)} DCNT`,
  }));

  const timeline: WarpoolTimelineItem[] = pool.activities.map((item) => ({
    id: item.id,
    label: activityLabel(item.type),
    time: formatWAT(item.timestamp),
  }));

  const battleState: WarpoolBattle["state"] =
    pool.state === "OPEN" || pool.state === "LOCKED"
      ? "Pending"
      : pool.state === "BATTLE_READY" || pool.state === "SETTLING"
      ? "Live"
      : pool.state === "EXPIRED_REFUNDED"
      ? "Expired"
      : "Settled";

  const round =
    pool.battle?.matches && pool.battle.matches.length > 0
      ? `Resolved rounds: ${new Set(
          pool.battle.matches.map((m) => m.roundNumber)
        ).size}`
      : battleState === "Pending"
      ? "Awaiting bracket"
      : battleState === "Live"
      ? "Battle in progress"
      : "Complete";

  const podiumEntryIds = [
    pool.battle?.firstEntryId,
    pool.battle?.secondEntryId,
    pool.battle?.thirdEntryId,
  ].filter((value): value is string => !!value);

  const podiumEntries = podiumEntryIds.length
    ? await prisma.warpoolEntry.findMany({
        where: {
          id: { in: podiumEntryIds },
        },
        select: {
          id: true,
          userAddress: true,
        },
      })
    : [];

  const podiumEntryMap = new Map(
    podiumEntries.map((entry) => [entry.id, entry])
  );

  return {
    poolId: pool.id,
    queue: metaForSlug(pool.queueSlug ?? "UNKNOWN").title,
    state: battleState,
    stake: `${formatTokenAmount(pool.stakeAmountRaw)} DCNT`,
    prizePool: pool.battle?.prizePoolRaw
      ? `${formatTokenAmount(pool.battle.prizePoolRaw)} DCNT`
      : "—",
    startedAt: formatWAT(pool.lockedAt ?? pool.openedAt),
    round,
    arena: `${metaForSlug(pool.queueSlug ?? "UNKNOWN").title} Arena`,
    entries,
    timeline,
    firstPlaceWallet: pool.battle?.firstEntryId
      ? (podiumEntryMap.get(pool.battle.firstEntryId)?.userAddress ?? null)
      : null,
    secondPlaceWallet: pool.battle?.secondEntryId
      ? (podiumEntryMap.get(pool.battle.secondEntryId)?.userAddress ?? null)
      : null,
    thirdPlaceWallet: pool.battle?.thirdEntryId
      ? (podiumEntryMap.get(pool.battle.thirdEntryId)?.userAddress ?? null)
      : null,
  };
}

export async function getWarpoolBattleEligibility(
  poolId: string,
  walletAddress?: string | null
): Promise<WarpoolBattleEligibility | null> {
  const battle = await getWarpoolBattleByPoolId(poolId);
  if (!battle) return null;

  const normalizedWallet = normalizeAddress(walletAddress);

  if (!normalizedWallet) {
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

  const isParticipant = battle.entries.some(
    (entry) => normalizeAddress(entry.wallet) === normalizedWallet
  );

  const isWinner =
    normalizeAddress(battle.firstPlaceWallet) === normalizedWallet;

  return {
    walletRequired: true,
    isParticipant,
    isWinner,
    canConfirm: false,
    canClaim: false,
    claimableAt: null,
    reason: isParticipant ? "ok" : "not_participant",
  };
}