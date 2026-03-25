// src/features/admin/warpool/multisig-types.ts

export type WarpoolQueueSlug =
  | "FORGE_SAFEGUARD"
  | "LEGION_SAFEGUARD"
  | "LEGION_VAULTBOUND"
  | "CROWN_VAULTBOUND";

export type WarpoolComposerQueueDraft = {
  slug: WarpoolQueueSlug;
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
};

export type WarpoolComposerBattleDraft = {
  roundsPerMatch: number;
  traitPowerMin: number;
  traitPowerMax: number;
  roundVarianceMax: number;
  microMomentumMax: number;
};

export type WarpoolComposerRelicDraft = {
  minDiscountBps: number;
  maxDiscountBps: number;
  discountSeatCap: number;
  token11SeatCap: number;
  reservationTtlSeconds: number;
};

export type WarpoolComposerFatigueDraft = {
  maxConsecutiveEntries: number;
  cooldownSeconds: number;
};

export type WarpoolComposerGlobalDraft = {
  treasury: string | null;
  workerOperator: string | null;
  entriesPaused: boolean;
  reservationsPaused: boolean;
  settlementsPaused: boolean;
  relicsEnabled: boolean;
  fatigueEnabled: boolean;
  token11FeeShareEnabled: boolean;
  token11FeeShareBps: number;
  relic: WarpoolComposerRelicDraft;
  fatigue: WarpoolComposerFatigueDraft;
  battle: WarpoolComposerBattleDraft;
};

export type WarpoolConfigProposalDraft = {
  mode: "warpool-config-draft";
  basedOnConfigVersion: string | null;
  global: WarpoolComposerGlobalDraft;
  queues: WarpoolComposerQueueDraft[];
};

export type EncodedConfigAction = {
  id: string;
  target: string;
  value: string;
  functionName:
    | "setTreasury"
    | "setWorkerOperator"
    | "setPauseFlags"
    | "setGlobalFlags"
    | "setRelicConfig"
    | "setFatigueConfig"
    | "setBattleConfig"
    | "setQueueConfig";
  args: unknown[];
  data: string;
  summary: string;
};

export type EncodedConfigPlan = {
  target: string;
  actions: EncodedConfigAction[];
  warnings: string[];
  summaryLines: string[];
};