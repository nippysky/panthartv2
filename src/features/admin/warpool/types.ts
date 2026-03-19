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
  syncedAt: Date;
  createdAt: Date;
};

export type WarpoolAdminQueueCard = {
  id: string;
  slug:
    | "FORGE_SAFEGUARD"
    | "LEGION_SAFEGUARD"
    | "LEGION_VAULTBOUND"
    | "CROWN_VAULTBOUND";
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