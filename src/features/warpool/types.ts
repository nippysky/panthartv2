export type QueueStatus =
  | "Open"
  | "Filling"
  | "Locked"
  | "Battle Ready"
  | "Settled"
  | "Closed";

export type BattleState =
  | "Open"
  | "Locked"
  | "Battle Ready"
  | "Settled"
  | "Closed"
  | "Expired";

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

  poolId: string | null;
  poolIdOnChain: string | null;
  queueKey: string | null;
  openedAt: string | null;
  expiresAt: string | null;
  lockedAt: string | null;
  battleReadyAt: string | null;
  settledAt: string | null;
  configVersion: string | null;

  singleEntryPerWallet: boolean;
  acceptsRelics: boolean;
  remainingSpots: number;
  discountSeatsRemaining: number | null;
  token11SeatsRemaining: number | null;
};

export type WarpoolHistoryItem = {
  id: string;
  poolIdOnChain: string | null;
  queue: string;
  winner: string;
  prize: string;
  status: "Settled" | "Pending" | "Expired";
  time: string;
  settledAt: string | null;
};

export type WarpoolRecentWinner = {
  id: string;
  label: string;
  winner: string;
  prize: string;
  time: string;
  settledAt: string | null;
};

export type WarpoolBattleEntry = {
  id: string;
  entryIdOnChain: string;
  wallet: string;
  username: string | null;
  comradeTokenId: string;
  comradeImageUrl: string | null;
  comradeName: string | null;
  relicTokenId: string | null;
  relicType: string;
  selectedForBattle: boolean;
  placement: number | null;
  status: string;
  paidStake: string;
  prizeAmount: string | null;
};

export type WarpoolTimelineItem = {
  id: string;
  label: string;
  time: string;
};

export type WarpoolBattleRoundResult = {
  round: number;
  aScore: number;
  bScore: number;
  winner: string;
  suddenDeath?: boolean;
};

export type WarpoolBattleMatch = {
  id: string;
  roundNumber: number;
  matchNumber: number;
  status: string;
  stage: string;
  slotAEntryId: string | null;
  slotBEntryId: string | null;
  winnerEntryId: string | null;
  loserEntryId: string | null;
  rounds: WarpoolBattleRoundResult[];
  summary: {
    aWins?: number;
    bWins?: number;
    winnerId?: string;
    loserId?: string;
  } | null;
};

export type WarpoolBattlePlacements = {
  firstEntryId: string | null;
  secondEntryId: string | null;
  thirdEntryId: string | null;
  firstPlaceWallet: string | null;
  secondPlaceWallet: string | null;
  thirdPlaceWallet: string | null;
  firstPlaceUsername: string | null;
  secondPlaceUsername: string | null;
  thirdPlaceUsername: string | null;
};

export type WarpoolBattle = {
  poolId: string;
  poolIdOnChain: string | null;
  queue: string;
  state: BattleState;
  stake: string;
  prizePool: string;
  startedAt: string;
  round: string;
  arena: string;
  entries: WarpoolBattleEntry[];
  timeline: WarpoolTimelineItem[];
  matches: WarpoolBattleMatch[];
  placements: WarpoolBattlePlacements;
  computedAt: string | null;
  settledAt: string | null;
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
    | "live_pool_unavailable"
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

export type WarpoolOwnedAsset = {
  nftId: string;
  contract: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
  rarityScore: string | null;

  isLockedInWarpool?: boolean;
  lockReason?: string | null;
  lockPoolId?: string | null;
  lockQueueTitle?: string | null;

  fatigueUntil?: string | null;
  isFatigued?: boolean;
  consecutiveEntries?: number | null;
  lastSettledPoolId?: string | null;
};

export type WarpoolQueueAssetsPayload = {
  comrades: WarpoolOwnedAsset[];
  relics: WarpoolOwnedAsset[];
};

export type WarpoolLensPreviewPayload = {
  queueSlug: string;
  poolId: string;
  poolIdOnChain: string;
  activeReservationIdOnChain: string | null;
  activeReservationExpiresAt: string | null;
  canReserveRelic: boolean;
  reserveReason: string;
  canEnter: boolean;
  enterReason: string;
  queueAcceptsRelics: boolean;
  expectedStake: string;
  discountBps: number | null;
  discountSeatsRemaining: number | null;
  token11SeatsRemaining: number | null;
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

export type QueueFilterValue = "all" | QueueStatus;
export type HistoryFilterValue = "all" | "Settled" | "Pending" | "Expired";