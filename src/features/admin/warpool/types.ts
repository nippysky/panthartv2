// src/features/admin/warpool/types.ts

export type WarpoolAdminContractCard = {
  id: string;
  kind: "CONFIG" | "CORE" | "LENS";
  address: string;
  chainId: number;
  label: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WarpoolAdminConfigSnapshot = {
  id: string;
  chainId: number;
  configContract: string;
  configVersion: bigint;
  comradesCollection: string | null;
  relicsCollection: string | null;
  dcntToken: string | null;
  treasury: string | null;
  workerOperator: string | null;
  entriesPaused: boolean;
  reservationsPaused: boolean;
  settlementsPaused: boolean;
  relicsEnabled: boolean;
  fatigueEnabled: boolean;
  token11FeeShareEnabled: boolean;
  token11FeeShareBps: number;

  relicMinDiscountBps: number | null;
  relicMaxDiscountBps: number | null;
  discountSeatCap: number | null;
  token11SeatCap: number | null;
  reservationTtlSeconds: number | null;

  fatigueMaxConsecutive: number | null;
  fatigueCooldownSeconds: number | null;

  roundsPerMatch: number | null;
  traitPowerMin: number | null;
  traitPowerMax: number | null;
  roundVarianceMax: number | null;
  microMomentumMax: number | null;

  syncedAt: Date;
  createdAt: Date;
};

export type WarpoolAdminQueueCard = {
  slug:
    | "FORGE_SAFEGUARD"
    | "LEGION_SAFEGUARD"
    | "LEGION_VAULTBOUND"
    | "CROWN_VAULTBOUND";
  id: string;
  queueKey: string;
  chainId: number;
  tier: number;
  mode: number;
  enabled: boolean;
  singleEntryPerWallet: boolean;
  targetSize: number;
  minStartSize: number;
  openDurationSeconds: number;
  stakeAmountRaw: string;
  platformFeeBps: number;
  firstPlaceBps: number;
  secondPlaceBps: number;
  thirdPlaceBps: number;
  configVersion: bigint;
  syncedAt: Date;
};

export type WarpoolAdminOverviewStats = {
  totalPools: number;
  openPools: number;
  lockedPools: number;
  battleReadyPools: number;
  settledPools: number;
  expiredRefundedPools: number;
  totalEntries: number;
  totalReservations: number;
  totalCaptures: number;
};

export type WarpoolAdminChainCursor = {
  contract: string;
  lastBlockNumber: number;
};

export type WarpoolMultisigResolutionSource =
  | "CONFIG_OWNER_MATCH"
  | "CONFIG_OWNER_UNREGISTERED"
  | "LATEST_REGISTERED_FALLBACK"
  | "UNAVAILABLE";

export type WarpoolMultisigSummary = {
  contract: string;
  threshold: number;
  ownersCount: number;
};

export type WarpoolAdminMultisigTxItem = {
  id: string;
  nonce: number;
  to: string;
  valueWei: string;
  dataHex: string | null;
  status:
    | "SUBMITTED"
    | "APPROVED"
    | "EXECUTED"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";
  submittedBy: string | null;
  approvalsCount: number;
  executedTxHash: string | null;
  createdAt: Date;
  executedAt: Date | null;
};

export type WarpoolAdminOverviewData = {
  contracts: WarpoolAdminContractCard[];
  latestConfigSnapshot: WarpoolAdminConfigSnapshot | null;
  queueCards: WarpoolAdminQueueCard[];
  stats: WarpoolAdminOverviewStats;
  cursors: WarpoolAdminChainCursor[];
  multisigAddress: string | null;
  multisigResolutionSource: WarpoolMultisigResolutionSource;
  multisigSummary: WarpoolMultisigSummary | null;
  recentMultisigTxs: WarpoolAdminMultisigTxItem[];
};

export type WarpoolWorkerQueueReadinessItem = {
  poolId: string;
  queueSlug: string | null;
  queueKey: string;
  expiresAt: Date;
  entrantCount: number;
  minStartSize: number;
};

export type WarpoolWorkerBattleReadyItem = {
  poolId: string;
  queueSlug: string | null;
  lockedAt: Date | null;
  seedBlockNumber: number | null;
  entrantCount: number;
  runnableSize: number;
};

export type WarpoolWorkerSettlementItem = {
  poolId: string;
  queueSlug: string | null;
  battleReadyAt: Date | null;
  runnableSize: number;
};

export type WarpoolWorkerReservationItem = {
  reservationId: string;
  poolId: string;
  queueSlug: string | null;
  userAddress: string;
  expiresAtOnChain: Date;
};

export type WarpoolWorkerReadinessData = {
  expiredOpenPools: WarpoolWorkerQueueReadinessItem[];
  battleReadyCandidates: WarpoolWorkerBattleReadyItem[];
  settlementCandidates: WarpoolWorkerSettlementItem[];
  expiredReservations: WarpoolWorkerReservationItem[];
};

export type WarpoolRuntimePrefill =
  | {
      type: "PROCESS_EXPIRED_POOL";
      poolId: string;
    }
  | {
      type: "MARK_BATTLE_READY";
      poolId: string;
    }
  | {
      type: "SETTLE_POOL";
      poolId: string;
    }
  | {
      type: "EXPIRE_RESERVATION";
      reservationId: string;
    };

export type WarpoolRuntimePrefillEnvelope = {
  id: string;
  payload: WarpoolRuntimePrefill;
};

export type AdminProposalArea = "WARPOOL";

export type AdminProposalKind = "CONFIG" | "RECOVERY";

export type AdminProposalStatus =
  | "DRAFT"
  | "READY"
  | "SUBMITTED"
  | "APPROVED"
  | "EXECUTED"
  | "CANCELLED"
  | "FAILED";

export type AdminProposalActionStatus =
  | "PENDING"
  | "SUBMITTED"
  | "EXECUTED"
  | "FAILED";

export type AdminProposalSafeSummary = {
  id: string;
  contract: string;
  name: string | null;
  threshold: number;
};

export type AdminProposalSubmittedMultisigTxSummary = {
  id: string;
  nonce: number;
  to: string;
  status:
    | "SUBMITTED"
    | "APPROVED"
    | "EXECUTED"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";
  executedTxHash: string | null;
  createdAt: Date;
  executedAt: Date | null;
};

export type AdminProposalActionItem = {
  id: string;
  proposalId: string;
  orderIndex: number;
  label: string | null;
  summary: string | null;
  target: string;
  valueWei: string;
  tokenAddress: string | null;
  dataHex: string;
  functionName: string | null;
  argsJson: unknown;
  status: AdminProposalActionStatus;
  submittedAt: Date | null;
  executedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminProposalEventActorUser = {
  id: string;
  walletAddress: string;
  username: string;
};

export type AdminProposalEventItem = {
  id: string;
  proposalId: string;
  actorUserId: string | null;
  actorAddress: string | null;
  type: string;
  note: string | null;
  payloadJson: unknown;
  createdAt: Date;
  actorUser: AdminProposalEventActorUser | null;
};

export type AdminProposalListItem = {
  id: string;
  area: AdminProposalArea;
  kind: AdminProposalKind;
  title: string;
  slug: string | null;
  summary: string | null;
  description: string | null;
  safeId: string | null;
  safeContract: string | null;
  chainId: number | null;
  createdByUserId: string | null;
  createdByAddress: string | null;
  lastEditedByUserId: string | null;
  lastEditedByAddress: string | null;
  basedOnConfigVersion: bigint | null;
  runtimeReferenceId: string | null;
  status: AdminProposalStatus;
  actionCount: number;
  submittedMultisigTxId: string | null;
  submittedMultisigNonce: number | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  executedAt: Date | null;
  cancelledAt: Date | null;
  failedAt: Date | null;
  snapshotJson: unknown;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;

  safe: AdminProposalSafeSummary | null;
  submittedMultisigTx: AdminProposalSubmittedMultisigTxSummary | null;
  _count: {
    actions: number;
    events: number;
  };
};

export type AdminProposalDetail = {
  id: string;
  area: AdminProposalArea;
  kind: AdminProposalKind;
  title: string;
  slug: string | null;
  summary: string | null;
  description: string | null;
  safeId: string | null;
  safeContract: string | null;
  chainId: number | null;
  createdByUserId: string | null;
  createdByAddress: string | null;
  lastEditedByUserId: string | null;
  lastEditedByAddress: string | null;
  basedOnConfigVersion: bigint | null;
  runtimeReferenceId: string | null;
  status: AdminProposalStatus;
  actionCount: number;
  submittedMultisigTxId: string | null;
  submittedMultisigNonce: number | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  executedAt: Date | null;
  cancelledAt: Date | null;
  failedAt: Date | null;
  snapshotJson: unknown;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;

  safe: AdminProposalSafeSummary | null;
  createdByUser: {
    id: string;
    walletAddress: string;
    username: string;
  } | null;
  lastEditedByUser: {
    id: string;
    walletAddress: string;
    username: string;
  } | null;
  submittedMultisigTx:
    | {
        id: string;
        nonce: number;
        to: string;
        valueWei: string;
        dataHex: string | null;
        status:
          | "SUBMITTED"
          | "APPROVED"
          | "EXECUTED"
          | "FAILED"
          | "CANCELLED"
          | "EXPIRED";
        executedTxHash: string | null;
        createdAt: Date;
        executedAt: Date | null;
        approvals: Array<{
          id: string;
          ownerAddress: string;
          signature: string | null;
          createdAt: Date;
        }>;
      }
    | null;
  actions: AdminProposalActionItem[];
  events: AdminProposalEventItem[];
};

export type CreateAdminProposalActionInput = {
  orderIndex: number;
  label?: string | null;
  summary?: string | null;
  target: string;
  valueWei: string;
  tokenAddress?: string | null;
  dataHex: string;
  functionName?: string | null;
  argsJson?: unknown;
};

export type CreateAdminProposalInput = {
  area: AdminProposalArea;
  kind: AdminProposalKind;
  title: string;
  slug?: string | null;
  summary?: string | null;
  description?: string | null;
  safeContract?: string | null;
  chainId?: number | null;
  basedOnConfigVersion?: string | null;
  runtimeReferenceId?: string | null;
  snapshotJson?: unknown;
  metadataJson?: unknown;
  actions: CreateAdminProposalActionInput[];
};

export type AdminProposalCreateResult = {
  proposal: AdminProposalDetail;
};

export type AdminProposalListResult = {
  proposals: AdminProposalListItem[];
};

export type WarpoolConfigProposalSavePayload = {
  title: string;
  summary?: string | null;
  description?: string | null;
  basedOnConfigVersion?: string | null;
  snapshotJson: unknown;
  actions: CreateAdminProposalActionInput[];
  safeContract?: string | null;
};

export type AdminProposalStats = {
  total: number;
  draft: number;
  ready: number;
  submitted: number;
  approved: number;
  executed: number;
  failed: number;
  cancelled: number;
};

export type WarpoolAdminProposalListItem = {
  id: string;
  area: "WARPOOL";
  kind: "CONFIG" | "RECOVERY";
  title: string;
  slug: string | null;
  summary: string | null;
  status:
    | "DRAFT"
    | "READY"
    | "SUBMITTED"
    | "APPROVED"
    | "EXECUTED"
    | "CANCELLED"
    | "FAILED";
  actionCount: number;
  submittedMultisigNonce: number | null;
  safeContract: string | null;
  createdByAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  approvedAt: Date | null;
  executedAt: Date | null;
  submittedActionsCount: number;
  approvedActionsCount: number;
  executedActionsCount: number;
};

export type WarpoolAdminProposalListResult = {
  items: WarpoolAdminProposalListItem[];
};