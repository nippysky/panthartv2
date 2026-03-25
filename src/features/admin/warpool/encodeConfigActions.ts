// src/features/admin/warpool/encodeConfigActions.ts

import { ethers } from "ethers";
import type {
  EncodedConfigAction,
  EncodedConfigPlan,
  WarpoolConfigProposalDraft,
  WarpoolQueueSlug,
} from "@/src/features/admin/warpool/multisig-types";
import { WARPOOL_QUEUE_META } from "@/src/features/admin/warpool/constants";
import { WARPOOL_CONFIG_ABI } from "@/src/lib/abis/warpoolConfigAbi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const UINT96_MAX = (BigInt(1) << BigInt(96)) - BigInt(1);

const QUEUE_ENUM_MAP: Record<WarpoolQueueSlug, { tier: number; mode: number }> = {
  FORGE_SAFEGUARD: { tier: 1, mode: 1 },
  LEGION_SAFEGUARD: { tier: 2, mode: 1 },
  LEGION_VAULTBOUND: { tier: 2, mode: 2 },
  CROWN_VAULTBOUND: { tier: 3, mode: 2 },
};

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return ethers.getAddress(trimmed);
}

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0;
}

function validateQueueBps(queue: WarpoolConfigProposalDraft["queues"][number]) {
  return (
    queue.platformFeeBps +
      queue.firstPlaceBps +
      queue.secondPlaceBps +
      queue.thirdPlaceBps ===
    10_000
  );
}

function makeQueueKey(tier: number, mode: number) {
  return ethers.keccak256(
    ethers.solidityPacked(["uint8", "uint8"], [tier, mode])
  );
}

function queueEqual(
  a: WarpoolConfigProposalDraft["queues"][number] | undefined,
  b: WarpoolConfigProposalDraft["queues"][number]
) {
  if (!a) return false;

  return (
    a.enabled === b.enabled &&
    a.singleEntryPerWallet === b.singleEntryPerWallet &&
    a.targetSize === b.targetSize &&
    a.minStartSize === b.minStartSize &&
    a.openDurationSeconds === b.openDurationSeconds &&
    a.stakeAmountRaw === b.stakeAmountRaw &&
    a.platformFeeBps === b.platformFeeBps &&
    a.firstPlaceBps === b.firstPlaceBps &&
    a.secondPlaceBps === b.secondPlaceBps &&
    a.thirdPlaceBps === b.thirdPlaceBps
  );
}

function relicEqual(
  a: WarpoolConfigProposalDraft["global"]["relic"] | undefined,
  b: WarpoolConfigProposalDraft["global"]["relic"]
) {
  if (!a) return false;

  return (
    a.minDiscountBps === b.minDiscountBps &&
    a.maxDiscountBps === b.maxDiscountBps &&
    a.discountSeatCap === b.discountSeatCap &&
    a.token11SeatCap === b.token11SeatCap &&
    a.reservationTtlSeconds === b.reservationTtlSeconds
  );
}

function fatigueEqual(
  a: WarpoolConfigProposalDraft["global"]["fatigue"] | undefined,
  b: WarpoolConfigProposalDraft["global"]["fatigue"]
) {
  if (!a) return false;

  return (
    a.maxConsecutiveEntries === b.maxConsecutiveEntries &&
    a.cooldownSeconds === b.cooldownSeconds
  );
}

function battleEqual(
  a: WarpoolConfigProposalDraft["global"]["battle"] | undefined,
  b: WarpoolConfigProposalDraft["global"]["battle"]
) {
  if (!a) return false;

  return (
    a.roundsPerMatch === b.roundsPerMatch &&
    a.traitPowerMin === b.traitPowerMin &&
    a.traitPowerMax === b.traitPowerMax &&
    a.roundVarianceMax === b.roundVarianceMax &&
    a.microMomentumMax === b.microMomentumMax
  );
}

function pushAction(params: {
  actions: EncodedConfigAction[];
  iface: ethers.Interface;
  target: string;
  functionName: EncodedConfigAction["functionName"];
  args: unknown[];
  summary: string;
}) {
  const { actions, iface, target, functionName, args, summary } = params;
  const data = iface.encodeFunctionData(functionName, args);

  actions.push({
    id: `${functionName}-${actions.length}`,
    target,
    value: "0",
    functionName,
    args,
    data,
    summary,
  });
}

export function encodeWarpoolConfigActions(params: {
  configAddress: string;
  current: WarpoolConfigProposalDraft | null;
  next: WarpoolConfigProposalDraft;
}): EncodedConfigPlan {
  const { configAddress, current, next } = params;

  if (!ethers.isAddress(configAddress)) {
    throw new Error("Invalid Warpool config contract address.");
  }

  const target = ethers.getAddress(configAddress);
  const iface = new ethers.Interface(WARPOOL_CONFIG_ABI);

  const warnings: string[] = [];
  const summaryLines: string[] = [];
  const actions: EncodedConfigAction[] = [];

  const normalizedTreasury = normalizeAddress(next.global.treasury);
  const normalizedWorker = normalizeAddress(next.global.workerOperator);

  if (!normalizedTreasury) {
    warnings.push("Treasury address is missing or invalid.");
  }

  if (next.global.workerOperator && !normalizedWorker) {
    warnings.push("Worker operator address is invalid.");
  }

  if (next.global.token11FeeShareBps < 0 || next.global.token11FeeShareBps > 10_000) {
    warnings.push("Token11 fee share BPS must be between 0 and 10,000.");
  }

  if (next.global.relic.minDiscountBps < 0 || next.global.relic.minDiscountBps > 10_000) {
    warnings.push("Relic config: min discount BPS must be between 0 and 10,000.");
  }

  if (next.global.relic.maxDiscountBps < 0 || next.global.relic.maxDiscountBps > 10_000) {
    warnings.push("Relic config: max discount BPS must be between 0 and 10,000.");
  }

  if (next.global.relic.minDiscountBps > next.global.relic.maxDiscountBps) {
    warnings.push("Relic config: min discount BPS cannot exceed max discount BPS.");
  }

  if (next.global.relic.discountSeatCap < 0 || next.global.relic.discountSeatCap > 255) {
    warnings.push("Relic config: discount seat cap must fit uint8.");
  }

  if (next.global.relic.token11SeatCap < 0 || next.global.relic.token11SeatCap > 255) {
    warnings.push("Relic config: token11 seat cap must fit uint8.");
  }

  if (next.global.relic.reservationTtlSeconds <= 0) {
    warnings.push("Relic config: reservation TTL must be greater than zero.");
  }

  if (
    next.global.fatigue.maxConsecutiveEntries <= 0 ||
    next.global.fatigue.maxConsecutiveEntries > 255
  ) {
    warnings.push("Fatigue config: max consecutive entries must be between 1 and 255.");
  }

  if (next.global.fatigue.cooldownSeconds < 0) {
    warnings.push("Fatigue config: cooldown seconds cannot be negative.");
  }

  if (next.global.battle.roundsPerMatch <= 0) {
    warnings.push("Battle config: rounds per match must be greater than zero.");
  }

  if (next.global.battle.traitPowerMin <= 0) {
    warnings.push("Battle config: trait power min must be greater than zero.");
  }

  if (next.global.battle.traitPowerMax <= 0) {
    warnings.push("Battle config: trait power max must be greater than zero.");
  }

  if (next.global.battle.traitPowerMin > next.global.battle.traitPowerMax) {
    warnings.push("Battle config: trait power min cannot exceed trait power max.");
  }

  if (next.global.battle.roundVarianceMax < 0) {
    warnings.push("Battle config: round variance max cannot be negative.");
  }

  if (next.global.battle.microMomentumMax < 0) {
    warnings.push("Battle config: micro momentum max cannot be negative.");
  }

  for (const queue of next.queues) {
    if (!isPowerOfTwo(queue.targetSize)) {
      warnings.push(`${queue.slug}: target size must be a power of two.`);
    }
    if (!isPowerOfTwo(queue.minStartSize)) {
      warnings.push(`${queue.slug}: min start size must be a power of two.`);
    }
    if (queue.minStartSize > queue.targetSize) {
      warnings.push(`${queue.slug}: min start size cannot exceed target size.`);
    }
    if (queue.openDurationSeconds <= 0) {
      warnings.push(`${queue.slug}: open duration must be greater than zero.`);
    }
    if (!/^\d+$/.test(queue.stakeAmountRaw)) {
      warnings.push(`${queue.slug}: stakeAmountRaw must be an integer string.`);
    } else {
      try {
        const stake = BigInt(queue.stakeAmountRaw);
        if (stake <= BigInt(0)) {
          warnings.push(`${queue.slug}: stake amount must be greater than zero.`);
        }
        if (stake > UINT96_MAX) {
          warnings.push(`${queue.slug}: stake amount exceeds uint96.`);
        }
      } catch {
        warnings.push(`${queue.slug}: invalid raw stake amount.`);
      }
    }

    if (!validateQueueBps(queue)) {
      warnings.push(`${queue.slug}: payout + platform fee BPS must total 10,000.`);
    }
  }

  const currentQueues = new Map((current?.queues ?? []).map((queue) => [queue.slug, queue]));

  if (
    normalizedTreasury &&
    normalizedTreasury !== normalizeAddress(current?.global.treasury) &&
    normalizedTreasury !== ZERO_ADDRESS
  ) {
    pushAction({
      actions,
      iface,
      target,
      functionName: "setTreasury",
      args: [normalizedTreasury],
      summary: `Update treasury to ${normalizedTreasury}`,
    });
    summaryLines.push(`Treasury → ${normalizedTreasury}`);
  }

  if (
    normalizedWorker &&
    normalizedWorker !== normalizeAddress(current?.global.workerOperator) &&
    normalizedWorker !== ZERO_ADDRESS
  ) {
    pushAction({
      actions,
      iface,
      target,
      functionName: "setWorkerOperator",
      args: [normalizedWorker],
      summary: `Update worker operator to ${normalizedWorker}`,
    });
    summaryLines.push(`Worker operator → ${normalizedWorker}`);
  }

  if (
    current == null ||
    current.global.entriesPaused !== next.global.entriesPaused ||
    current.global.reservationsPaused !== next.global.reservationsPaused ||
    current.global.settlementsPaused !== next.global.settlementsPaused
  ) {
    pushAction({
      actions,
      iface,
      target,
      functionName: "setPauseFlags",
      args: [
        next.global.entriesPaused,
        next.global.reservationsPaused,
        next.global.settlementsPaused,
      ],
      summary: "Update pause flags",
    });
    summaryLines.push(
      `Pause flags → entries:${next.global.entriesPaused ? "paused" : "live"}, reservations:${next.global.reservationsPaused ? "paused" : "live"}, settlements:${next.global.settlementsPaused ? "paused" : "live"}`
    );
  }

  if (
    current == null ||
    current.global.relicsEnabled !== next.global.relicsEnabled ||
    current.global.fatigueEnabled !== next.global.fatigueEnabled ||
    current.global.token11FeeShareEnabled !== next.global.token11FeeShareEnabled ||
    current.global.token11FeeShareBps !== next.global.token11FeeShareBps
  ) {
    pushAction({
      actions,
      iface,
      target,
      functionName: "setGlobalFlags",
      args: [
        next.global.relicsEnabled,
        next.global.fatigueEnabled,
        next.global.token11FeeShareEnabled,
        next.global.token11FeeShareBps,
      ],
      summary: "Update global Warpool flags",
    });
    summaryLines.push(
      `Global flags → relics:${next.global.relicsEnabled ? "enabled" : "disabled"}, fatigue:${next.global.fatigueEnabled ? "enabled" : "disabled"}, token11 fee share:${next.global.token11FeeShareEnabled ? `${next.global.token11FeeShareBps} bps` : "disabled"}`
    );
  }

  if (!relicEqual(current?.global.relic, next.global.relic)) {
    pushAction({
      actions,
      iface,
      target,
      functionName: "setRelicConfig",
      args: [
        {
          minDiscountBps: next.global.relic.minDiscountBps,
          maxDiscountBps: next.global.relic.maxDiscountBps,
          discountSeatCap: next.global.relic.discountSeatCap,
          token11SeatCap: next.global.relic.token11SeatCap,
          reservationTtlSeconds: next.global.relic.reservationTtlSeconds,
        },
      ],
      summary: "Update relic config",
    });
    summaryLines.push(
      `Relic config → ${next.global.relic.minDiscountBps}-${next.global.relic.maxDiscountBps} bps, discount seats ${next.global.relic.discountSeatCap}, token11 seats ${next.global.relic.token11SeatCap}, TTL ${next.global.relic.reservationTtlSeconds}s`
    );
  }

  if (!fatigueEqual(current?.global.fatigue, next.global.fatigue)) {
    pushAction({
      actions,
      iface,
      target,
      functionName: "setFatigueConfig",
      args: [
        {
          maxConsecutiveEntries: next.global.fatigue.maxConsecutiveEntries,
          cooldownSeconds: next.global.fatigue.cooldownSeconds,
        },
      ],
      summary: "Update fatigue config",
    });
    summaryLines.push(
      `Fatigue config → max consecutive ${next.global.fatigue.maxConsecutiveEntries}, cooldown ${next.global.fatigue.cooldownSeconds}s`
    );
  }

  if (!battleEqual(current?.global.battle, next.global.battle)) {
    pushAction({
      actions,
      iface,
      target,
      functionName: "setBattleConfig",
      args: [
        {
          roundsPerMatch: next.global.battle.roundsPerMatch,
          traitPowerMin: next.global.battle.traitPowerMin,
          traitPowerMax: next.global.battle.traitPowerMax,
          roundVarianceMax: next.global.battle.roundVarianceMax,
          microMomentumMax: next.global.battle.microMomentumMax,
        },
      ],
      summary: "Update battle config",
    });
    summaryLines.push(
      `Battle config → rounds ${next.global.battle.roundsPerMatch}, trait ${next.global.battle.traitPowerMin}-${next.global.battle.traitPowerMax}, variance ${next.global.battle.roundVarianceMax}, momentum ${next.global.battle.microMomentumMax}`
    );
  }

  for (const queue of next.queues) {
    const currentQueue = currentQueues.get(queue.slug);
    if (queueEqual(currentQueue, queue)) continue;

    const meta = QUEUE_ENUM_MAP[queue.slug];
    const key = makeQueueKey(meta.tier, meta.mode);

    pushAction({
      actions,
      iface,
      target,
      functionName: "setQueueConfig",
      args: [
        key,
        {
          enabled: queue.enabled,
          singleEntryPerWallet: queue.singleEntryPerWallet,
          tier: meta.tier,
          mode: meta.mode,
          targetSize: queue.targetSize,
          minStartSize: queue.minStartSize,
          openDurationSeconds: queue.openDurationSeconds,
          stakeAmount: queue.stakeAmountRaw,
          platformFeeBps: queue.platformFeeBps,
          firstPlaceBps: queue.firstPlaceBps,
          secondPlaceBps: queue.secondPlaceBps,
          thirdPlaceBps: queue.thirdPlaceBps,
        },
      ],
      summary: `Update queue config for ${WARPOOL_QUEUE_META[queue.slug]?.title ?? queue.slug}`,
    });

    summaryLines.push(
      `${WARPOOL_QUEUE_META[queue.slug]?.title ?? queue.slug} → ${queue.enabled ? "enabled" : "disabled"}, ${queue.targetSize}/${queue.minStartSize}, fee ${queue.platformFeeBps} bps, stake ${queue.stakeAmountRaw}`
    );
  }

  if (actions.length === 0) {
    summaryLines.push("No config changes detected.");
  }

  return {
    target,
    actions,
    warnings,
    summaryLines,
  };
}