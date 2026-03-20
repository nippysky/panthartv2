import {
  warpoolBattleById,
  warpoolHistory,
  warpoolQueues,
  warpoolRecentWinners,
} from "@/src/features/warpool/data/mock";
import type {
  WarpoolBattle,
  WarpoolBattleEligibility,
  WarpoolHistoryItem,
  WarpoolQueue,
  WarpoolQueueEligibility,
  WarpoolRecentWinner,
} from "@/src/features/warpool/types";

type ReservationMap = Record<string, Record<string, string>>;
type ConfirmMap = Record<string, Record<string, true>>;
type ClaimMap = Record<string, Record<string, true>>;

type DevState = {
  queues: WarpoolQueue[];
  battles: Record<string, WarpoolBattle>;
  history: WarpoolHistoryItem[];
  recentWinners: WarpoolRecentWinner[];
  reservations: ReservationMap;
  confirmations: ConfirmMap;
  claims: ClaimMap;
};

const globalForWarpool = globalThis as typeof globalThis & {
  __warpoolDevState?: DevState;
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeAddress(address?: string | null) {
  return address?.trim().toLowerCase() ?? "";
}

function getInitialState(): DevState {
  return {
    queues: deepClone(warpoolQueues),
    battles: deepClone(warpoolBattleById),
    history: deepClone(warpoolHistory),
    recentWinners: deepClone(warpoolRecentWinners),
    reservations: {},
    confirmations: {},
    claims: {},
  };
}

function getState() {
  if (!globalForWarpool.__warpoolDevState) {
    globalForWarpool.__warpoolDevState = getInitialState();
  }

  return globalForWarpool.__warpoolDevState;
}

function cleanupExpiredReservationsForQueue(queueSlug: string) {
  const state = getState();
  const walletMap = state.reservations[queueSlug];
  if (!walletMap) return;

  const now = Date.now();

  for (const [wallet, expiresAt] of Object.entries(walletMap)) {
    const ts = Date.parse(expiresAt);
    if (Number.isNaN(ts) || ts <= now) {
      delete walletMap[wallet];
    }
  }

  if (Object.keys(walletMap).length === 0) {
    delete state.reservations[queueSlug];
  }
}

function activeReservationCount(queueSlug: string) {
  cleanupExpiredReservationsForQueue(queueSlug);
  const state = getState();
  return Object.keys(state.reservations[queueSlug] ?? {}).length;
}

function getQueueBaseBySlug(queueSlug: string) {
  const state = getState();
  return state.queues.find((q) => q.slug === queueSlug) ?? null;
}

function withComputedQueue(queue: WarpoolQueue): WarpoolQueue {
  const extraReservations = activeReservationCount(queue.slug);

  return {
    ...queue,
    entrants: Math.min(queue.maxEntrants, queue.entrants + extraReservations),
  };
}

export function listDevQueues() {
  const state = getState();
  return state.queues.map(withComputedQueue);
}

export function listDevRecentWinners() {
  return getState().recentWinners;
}

export function listDevHistory() {
  return getState().history;
}

export function getDevQueueBySlug(queueSlug: string) {
  const queue = getQueueBaseBySlug(queueSlug);
  return queue ? withComputedQueue(queue) : null;
}

export function getDevBattleById(poolId: string) {
  const state = getState();
  return state.battles[poolId] ?? null;
}

export function getDevQueueEligibility(
  queueSlug: string,
  walletAddress?: string | null
): WarpoolQueueEligibility | null {
  const queue = getDevQueueBySlug(queueSlug);
  if (!queue) return null;

  const wallet = normalizeAddress(walletAddress);

  if (!wallet) {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: false,
      reservationExpiresAt: null,
      reason: "wallet_required",
    };
  }

  cleanupExpiredReservationsForQueue(queueSlug);
  const state = getState();
  const existingExpiry = state.reservations[queueSlug]?.[wallet] ?? null;

  if (existingExpiry) {
    return {
      walletRequired: true,
      canReserve: false,
      isReservedByViewer: true,
      reservationExpiresAt: existingExpiry,
      reason: "already_reserved",
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
    reservationExpiresAt: null,
    reason: "ok",
  };
}

export function reserveDevQueueSlot(
  queueSlug: string,
  walletAddress?: string | null
) {
  const queue = getDevQueueBySlug(queueSlug);
  if (!queue) {
    return { ok: false, message: "Queue not found." };
  }

  const wallet = normalizeAddress(walletAddress);
  if (!wallet) {
    return { ok: false, message: "Connect your wallet to reserve a queue slot." };
  }

  const eligibility = getDevQueueEligibility(queueSlug, wallet);
  if (!eligibility?.canReserve) {
    switch (eligibility?.reason) {
      case "already_reserved":
        return { ok: false, message: "You already have an active reservation." };
      case "queue_full":
        return { ok: false, message: "This queue is already full." };
      case "queue_locked":
        return { ok: false, message: "This queue is locked and starting soon." };
      default:
        return { ok: false, message: "Reservation is currently unavailable." };
    }
  }

  const state = getState();
  const expiresAt = new Date(Date.now() + 8 * 60 * 1000).toISOString();

  if (!state.reservations[queueSlug]) {
    state.reservations[queueSlug] = {};
  }

  state.reservations[queueSlug][wallet] = expiresAt;

  return {
    ok: true,
    message: `Queue slot reserved for ${queue.title}.`,
    reservationExpiresAt: expiresAt,
  };
}

export function getDevBattleEligibility(
  poolId: string,
  walletAddress?: string | null
): WarpoolBattleEligibility | null {
  const battle = getDevBattleById(poolId);
  if (!battle) return null;

  const wallet = normalizeAddress(walletAddress);

  if (!wallet) {
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

  const state = getState();
  const confirmed = !!state.confirmations[poolId]?.[wallet];
  const claimed = !!state.claims[poolId]?.[wallet];

  if (battle.state === "Live" || battle.state === "Pending") {
    return {
      walletRequired: true,
      isParticipant: true,
      isWinner: false,
      canConfirm: !confirmed,
      canClaim: false,
      claimableAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
      reason: confirmed ? "already_confirmed" : "ok",
    };
  }

  if (battle.state === "Settled") {
    return {
      walletRequired: true,
      isParticipant: true,
      isWinner: true,
      canConfirm: false,
      canClaim: !claimed,
      claimableAt: new Date(Date.now() - 60 * 1000).toISOString(),
      reason: claimed ? "already_claimed" : "ok",
    };
  }

  return {
    walletRequired: true,
    isParticipant: false,
    isWinner: false,
    canConfirm: false,
    canClaim: false,
    claimableAt: null,
    reason: "unknown",
  };
}

export function confirmDevBattleParticipation(
  poolId: string,
  walletAddress?: string | null
) {
  const battle = getDevBattleById(poolId);
  if (!battle) {
    return { ok: false, message: "Battle not found." };
  }

  const wallet = normalizeAddress(walletAddress);
  if (!wallet) {
    return { ok: false, message: "Connect your wallet to confirm participation." };
  }

  const eligibility = getDevBattleEligibility(poolId, wallet);
  if (!eligibility?.canConfirm) {
    if (eligibility?.reason === "already_confirmed") {
      return { ok: false, message: "Participation already confirmed." };
    }
    return { ok: false, message: "Participation cannot be confirmed right now." };
  }

  const state = getState();
  if (!state.confirmations[poolId]) {
    state.confirmations[poolId] = {};
  }

  state.confirmations[poolId][wallet] = true;

  if (!state.battles[poolId].timeline.includes("Viewer confirmation recorded.")) {
    state.battles[poolId].timeline = [
      ...state.battles[poolId].timeline,
      "Viewer confirmation recorded.",
    ];
  }

  return {
    ok: true,
    message: `Participation confirmed for Pool #${poolId}.`,
  };
}

export function claimDevBattleResult(
  poolId: string,
  walletAddress?: string | null
) {
  const battle = getDevBattleById(poolId);
  if (!battle) {
    return { ok: false, message: "Battle not found." };
  }

  const wallet = normalizeAddress(walletAddress);
  if (!wallet) {
    return { ok: false, message: "Connect your wallet to claim battle result." };
  }

  const eligibility = getDevBattleEligibility(poolId, wallet);
  if (!eligibility?.canClaim) {
    switch (eligibility?.reason) {
      case "already_claimed":
        return { ok: false, message: "Reward already claimed." };
      case "battle_not_settled":
        return { ok: false, message: "Battle is not settled yet." };
      default:
        return { ok: false, message: "Claim is not available right now." };
    }
  }

  const state = getState();
  if (!state.claims[poolId]) {
    state.claims[poolId] = {};
  }

  state.claims[poolId][wallet] = true;

  if (!state.battles[poolId].timeline.includes("Viewer claim recorded.")) {
    state.battles[poolId].timeline = [
      ...state.battles[poolId].timeline,
      "Viewer claim recorded.",
    ];
  }

  return {
    ok: true,
    message: `Claim flow started for Pool #${poolId}.`,
  };
}