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

const QUEUE_ENUM_MAP: Record<
  WarpoolQueueSlug,
  { tier: number; mode: number }
> = {
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

function encodeAction(params: {
  iface: ethers.Interface;
  target: string;
  functionName: EncodedConfigAction["functionName"];
  args: unknown[];
  summary: string;
  id: string;
}): EncodedConfigAction {
  return {
    id: params.id,
    target: params.target,
    value: "0",
    functionName: params.functionName,
    args: params.args,
    data: params.iface.encodeFunctionData(params.functionName, params.args),
    summary: params.summary,
  };
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
        if (stake > ((BigInt(1) << BigInt(96)) - BigInt(1))) {
          warnings.push(`${queue.slug}: stake amount exceeds uint96.`);
        }
      } catch {
        warnings.push(`${queue.slug}: invalid raw stake amount.`);
      }
    }

    if (!validateQueueBps(queue)) {
      warnings.push(
        `${queue.slug}: platform + first + second + third place BPS must equal 10,000.`
      );
    }
  }

  if (warnings.length > 0) {
    return {
      target,
      actions: [],
      warnings,
      summaryLines,
    };
  }

  const currentGlobal = current?.global ?? null;
  const currentQueues = new Map((current?.queues ?? []).map((q) => [q.slug, q]));

  if (
    normalizedTreasury &&
    normalizedTreasury !== normalizeAddress(currentGlobal?.treasury) &&
    normalizedTreasury !== ZERO_ADDRESS
  ) {
    actions.push(
      encodeAction({
        iface,
        target,
        functionName: "setTreasury",
        args: [normalizedTreasury],
        summary: `Set treasury to ${normalizedTreasury}`,
        id: "set-treasury",
      })
    );
    summaryLines.push(`Treasury → ${normalizedTreasury}`);
  }

  if (
    normalizedWorker !== null &&
    normalizedWorker !== normalizeAddress(currentGlobal?.workerOperator)
  ) {
    actions.push(
      encodeAction({
        iface,
        target,
        functionName: "setWorkerOperator",
        args: [normalizedWorker],
        summary: `Set worker operator to ${normalizedWorker}`,
        id: "set-worker",
      })
    );
    summaryLines.push(`Worker operator → ${normalizedWorker}`);
  }

  const pauseChanged =
    !currentGlobal ||
    currentGlobal.entriesPaused !== next.global.entriesPaused ||
    currentGlobal.reservationsPaused !== next.global.reservationsPaused ||
    currentGlobal.settlementsPaused !== next.global.settlementsPaused;

  if (pauseChanged) {
    actions.push(
      encodeAction({
        iface,
        target,
        functionName: "setPauseFlags",
        args: [
          next.global.entriesPaused,
          next.global.reservationsPaused,
          next.global.settlementsPaused,
        ],
        summary: `Set pause flags: entries=${next.global.entriesPaused}, reservations=${next.global.reservationsPaused}, settlements=${next.global.settlementsPaused}`,
        id: "set-pause-flags",
      })
    );
    summaryLines.push(
      `Pause flags → entries=${next.global.entriesPaused}, reservations=${next.global.reservationsPaused}, settlements=${next.global.settlementsPaused}`
    );
  }

  const globalFlagsChanged =
    !currentGlobal ||
    currentGlobal.relicsEnabled !== next.global.relicsEnabled ||
    currentGlobal.fatigueEnabled !== next.global.fatigueEnabled ||
    currentGlobal.token11FeeShareEnabled !== next.global.token11FeeShareEnabled ||
    currentGlobal.token11FeeShareBps !== next.global.token11FeeShareBps;

  if (globalFlagsChanged) {
    actions.push(
      encodeAction({
        iface,
        target,
        functionName: "setGlobalFlags",
        args: [
          next.global.relicsEnabled,
          next.global.fatigueEnabled,
          next.global.token11FeeShareEnabled,
          next.global.token11FeeShareBps,
        ],
        summary: `Set global flags: relics=${next.global.relicsEnabled}, fatigue=${next.global.fatigueEnabled}, token11FeeShare=${next.global.token11FeeShareEnabled}, feeShareBps=${next.global.token11FeeShareBps}`,
        id: "set-global-flags",
      })
    );
    summaryLines.push(
      `Global flags → relics=${next.global.relicsEnabled}, fatigue=${next.global.fatigueEnabled}, token11FeeShare=${next.global.token11FeeShareEnabled}, token11FeeShareBps=${next.global.token11FeeShareBps}`
    );
  }

  for (const queue of next.queues) {
    const prev = currentQueues.get(queue.slug);
    const changed =
      !prev ||
      prev.enabled !== queue.enabled ||
      prev.singleEntryPerWallet !== queue.singleEntryPerWallet ||
      prev.targetSize !== queue.targetSize ||
      prev.minStartSize !== queue.minStartSize ||
      prev.openDurationSeconds !== queue.openDurationSeconds ||
      prev.stakeAmountRaw !== queue.stakeAmountRaw ||
      prev.platformFeeBps !== queue.platformFeeBps ||
      prev.firstPlaceBps !== queue.firstPlaceBps ||
      prev.secondPlaceBps !== queue.secondPlaceBps ||
      prev.thirdPlaceBps !== queue.thirdPlaceBps;

    if (!changed) continue;

    const enumConfig = QUEUE_ENUM_MAP[queue.slug];
    const queueKey = makeQueueKey(enumConfig.tier, enumConfig.mode);

    const queueConfigTuple = {
      enabled: queue.enabled,
      singleEntryPerWallet: queue.singleEntryPerWallet,
      tier: enumConfig.tier,
      mode: enumConfig.mode,
      targetSize: queue.targetSize,
      minStartSize: queue.minStartSize,
      openDurationSeconds: queue.openDurationSeconds,
      stakeAmount: queue.stakeAmountRaw,
      platformFeeBps: queue.platformFeeBps,
      firstPlaceBps: queue.firstPlaceBps,
      secondPlaceBps: queue.secondPlaceBps,
      thirdPlaceBps: queue.thirdPlaceBps,
    };

    actions.push(
      encodeAction({
        iface,
        target,
        functionName: "setQueueConfig",
        args: [queueKey, queueConfigTuple],
        summary: `Update ${WARPOOL_QUEUE_META[queue.slug].title} queue config`,
        id: `queue-${queue.slug.toLowerCase()}`,
      })
    );

    summaryLines.push(
      `${WARPOOL_QUEUE_META[queue.slug].title} → enabled=${queue.enabled}, target=${queue.targetSize}, min=${queue.minStartSize}, duration=${queue.openDurationSeconds}s`
    );
  }

  if (actions.length === 0) {
    warnings.push("No config changes detected.");
  }

  return {
    target,
    actions,
    warnings,
    summaryLines,
  };
}