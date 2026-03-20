export type QueueStatus = "Open" | "Filling" | "Starting Soon";
export type BattleState = "Live" | "Pending" | "Settled";

export type WarpoolQueue = {
  id?: string;
  slug: string;
  title: string;
  format: string;
  stake: string;
  fee: string;
  entrants: number;
  maxEntrants: number;
  eta: string;
  status: QueueStatus;
  highlight: string;
  summary: string;
  rules: string[];
};

export type WarpoolHistoryItem = {
  id: string;
  queue: string;
  winner: string;
  prize: string;
  status: "Settled" | "Pending";
  time: string;
};

export type WarpoolRecentWinner = {
  id: string;
  label: string;
  winner: string;
  prize: string;
  time: string;
};

export type WarpoolFighter = {
  side: string;
  wallet: string;
  health: number;
  status: string;
};

export type WarpoolQueueEligibility = {
  walletRequired: boolean;
  canReserve: boolean;
  isReservedByViewer: boolean;
  reservationExpiresAt: string | null;
  reason:
    | "ok"
    | "wallet_required"
    | "queue_full"
    | "already_reserved"
    | "queue_locked"
    | "unknown";
};

export type WarpoolBattleEligibility = {
  walletRequired: boolean;
  isParticipant: boolean;
  isWinner: boolean;
  canConfirm: boolean;
  canClaim: boolean;
  claimableAt: string | null;
  reason:
    | "ok"
    | "wallet_required"
    | "not_participant"
    | "already_confirmed"
    | "not_claimable_yet"
    | "already_claimed"
    | "battle_not_settled"
    | "unknown";
};

export type WarpoolBattle = {
  poolId: string;
  queue: string;
  state: BattleState;
  stake: string;
  prizePool: string;
  startedAt: string;
  round: string;
  arena: string;
  fighters: WarpoolFighter[];
  timeline: string[];
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  message?: string;
};

export type ApiError = {
  ok: false;
  message: string;
  code?: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type WarpoolQueuesPayload = {
  queues: WarpoolQueue[];
  recentWinners: WarpoolRecentWinner[];
};

export type WarpoolQueuePayload = {
  queue: WarpoolQueue | null;
  eligibility: WarpoolQueueEligibility | null;
};

export type WarpoolHistoryPayload = {
  items: WarpoolHistoryItem[];
  nextCursor?: string | null;
};

export type WarpoolBattlePayload = {
  battle: WarpoolBattle | null;
  eligibility: WarpoolBattleEligibility | null;
};

export type WarpoolActionResult = {
  ok: boolean;
  message: string;
};

export type QueueFilterValue = "all" | QueueStatus;
export type HistoryFilterValue = "all" | "Settled" | "Pending";