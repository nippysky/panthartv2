import { ethers } from "ethers";
import type { WarpoolQueueSlug } from "@/src/features/admin/warpool/multisig-types";
import { WARPOOL_CORE_ABI } from "@/src/lib/abis/warpoolCoreAbi";

export type WarpoolRuntimeFunctionName =
  | "openPool"
  | "processExpiredPool"
  | "markPoolBattleReady"
  | "expireReservation"
  | "settlePool";

export type EncodedRuntimeAction = {
  id: string;
  target: string;
  value: string;
  functionName: WarpoolRuntimeFunctionName;
  args: unknown[];
  data: string;
  summary: string;
};

export type EncodedRuntimePlan = {
  target: string;
  actions: EncodedRuntimeAction[];
  warnings: string[];
  summaryLines: string[];
};

const QUEUE_ENUM_MAP: Record<WarpoolQueueSlug, { tier: number; mode: number }> = {
  FORGE_SAFEGUARD: { tier: 1, mode: 1 },
  LEGION_SAFEGUARD: { tier: 2, mode: 1 },
  LEGION_VAULTBOUND: { tier: 2, mode: 2 },
  CROWN_VAULTBOUND: { tier: 3, mode: 2 },
};

function makeQueueKey(tier: number, mode: number) {
  return ethers.keccak256(
    ethers.solidityPacked(["uint8", "uint8"], [tier, mode])
  );
}

function encodeAction(params: {
  iface: ethers.Interface;
  target: string;
  functionName: WarpoolRuntimeFunctionName;
  args: unknown[];
  summary: string;
  id: string;
}): EncodedRuntimeAction {
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

function isPositiveIntegerString(value: string) {
  return /^\d+$/.test(value) && BigInt(value) > BigInt(0);
}

function toBigIntString(value: string | number | bigint) {
  return typeof value === "string" ? value : String(value);
}

export function encodeOpenPoolAction(params: {
  coreAddress: string;
  queueSlug: WarpoolQueueSlug;
}): EncodedRuntimePlan {
  const { coreAddress, queueSlug } = params;

  if (!ethers.isAddress(coreAddress)) {
    throw new Error("Invalid Warpool core contract address.");
  }

  const iface = new ethers.Interface(WARPOOL_CORE_ABI);
  const target = ethers.getAddress(coreAddress);
  const summaryLines: string[] = [];
  const warnings: string[] = [];

  const queueEnum = QUEUE_ENUM_MAP[queueSlug];
  const queueKey = makeQueueKey(queueEnum.tier, queueEnum.mode);

  const action = encodeAction({
    iface,
    target,
    functionName: "openPool",
    args: [queueKey],
    summary: `Open pool for ${queueSlug}`,
    id: `open-pool-${queueSlug.toLowerCase()}`,
  });

  summaryLines.push(`Queue slug → ${queueSlug}`);
  summaryLines.push(`Queue key → ${queueKey}`);

  return {
    target,
    actions: [action],
    warnings,
    summaryLines,
  };
}

export function encodeProcessExpiredPoolAction(params: {
  coreAddress: string;
  poolId: string | number | bigint;
}): EncodedRuntimePlan {
  const { coreAddress, poolId } = params;

  if (!ethers.isAddress(coreAddress)) {
    throw new Error("Invalid Warpool core contract address.");
  }

  const poolIdStr = toBigIntString(poolId);
  const warnings: string[] = [];
  const summaryLines: string[] = [];

  if (!isPositiveIntegerString(poolIdStr)) {
    warnings.push("Pool ID must be a positive integer.");
    return {
      target: ethers.getAddress(coreAddress),
      actions: [],
      warnings,
      summaryLines,
    };
  }

  const iface = new ethers.Interface(WARPOOL_CORE_ABI);
  const target = ethers.getAddress(coreAddress);

  const action = encodeAction({
    iface,
    target,
    functionName: "processExpiredPool",
    args: [poolIdStr],
    summary: `Process expired pool ${poolIdStr}`,
    id: `process-expired-pool-${poolIdStr}`,
  });

  summaryLines.push(`Pool ID → ${poolIdStr}`);

  return {
    target,
    actions: [action],
    warnings,
    summaryLines,
  };
}

export function encodeMarkBattleReadyAction(params: {
  coreAddress: string;
  poolId: string | number | bigint;
}): EncodedRuntimePlan {
  const { coreAddress, poolId } = params;

  if (!ethers.isAddress(coreAddress)) {
    throw new Error("Invalid Warpool core contract address.");
  }

  const poolIdStr = toBigIntString(poolId);
  const warnings: string[] = [];
  const summaryLines: string[] = [];

  if (!isPositiveIntegerString(poolIdStr)) {
    warnings.push("Pool ID must be a positive integer.");
    return {
      target: ethers.getAddress(coreAddress),
      actions: [],
      warnings,
      summaryLines,
    };
  }

  const iface = new ethers.Interface(WARPOOL_CORE_ABI);
  const target = ethers.getAddress(coreAddress);

  const action = encodeAction({
    iface,
    target,
    functionName: "markPoolBattleReady",
    args: [poolIdStr],
    summary: `Mark pool ${poolIdStr} battle ready`,
    id: `mark-battle-ready-${poolIdStr}`,
  });

  summaryLines.push(`Pool ID → ${poolIdStr}`);

  return {
    target,
    actions: [action],
    warnings,
    summaryLines,
  };
}

export function encodeExpireReservationAction(params: {
  coreAddress: string;
  reservationId: string | number | bigint;
}): EncodedRuntimePlan {
  const { coreAddress, reservationId } = params;

  if (!ethers.isAddress(coreAddress)) {
    throw new Error("Invalid Warpool core contract address.");
  }

  const reservationIdStr = toBigIntString(reservationId);
  const warnings: string[] = [];
  const summaryLines: string[] = [];

  if (!isPositiveIntegerString(reservationIdStr)) {
    warnings.push("Reservation ID must be a positive integer.");
    return {
      target: ethers.getAddress(coreAddress),
      actions: [],
      warnings,
      summaryLines,
    };
  }

  const iface = new ethers.Interface(WARPOOL_CORE_ABI);
  const target = ethers.getAddress(coreAddress);

  const action = encodeAction({
    iface,
    target,
    functionName: "expireReservation",
    args: [reservationIdStr],
    summary: `Expire reservation ${reservationIdStr}`,
    id: `expire-reservation-${reservationIdStr}`,
  });

  summaryLines.push(`Reservation ID → ${reservationIdStr}`);

  return {
    target,
    actions: [action],
    warnings,
    summaryLines,
  };
}

export function encodeSettlePoolAction(params: {
  coreAddress: string;
  poolId: string | number | bigint;
  firstEntryId: string | number | bigint;
  secondEntryId: string | number | bigint;
  thirdEntryId: string | number | bigint;
}): EncodedRuntimePlan {
  const { coreAddress, poolId, firstEntryId, secondEntryId, thirdEntryId } = params;

  if (!ethers.isAddress(coreAddress)) {
    throw new Error("Invalid Warpool core contract address.");
  }

  const poolIdStr = toBigIntString(poolId);
  const firstEntryIdStr = toBigIntString(firstEntryId);
  const secondEntryIdStr = toBigIntString(secondEntryId);
  const thirdEntryIdStr = toBigIntString(thirdEntryId);

  const warnings: string[] = [];
  const summaryLines: string[] = [];

  if (!isPositiveIntegerString(poolIdStr)) {
    warnings.push("Pool ID must be a positive integer.");
  }
  if (!isPositiveIntegerString(firstEntryIdStr)) {
    warnings.push("First entry ID must be a positive integer.");
  }
  if (!isPositiveIntegerString(secondEntryIdStr)) {
    warnings.push("Second entry ID must be a positive integer.");
  }
  if (!isPositiveIntegerString(thirdEntryIdStr)) {
    warnings.push("Third entry ID must be a positive integer.");
  }

  const uniqueIds = new Set([firstEntryIdStr, secondEntryIdStr, thirdEntryIdStr]);
  if (uniqueIds.size !== 3) {
    warnings.push("Settlement entry IDs must all be different.");
  }

  if (warnings.length > 0) {
    return {
      target: ethers.getAddress(coreAddress),
      actions: [],
      warnings,
      summaryLines,
    };
  }

  const iface = new ethers.Interface(WARPOOL_CORE_ABI);
  const target = ethers.getAddress(coreAddress);

  const settlementTuple = {
    firstEntryId: firstEntryIdStr,
    secondEntryId: secondEntryIdStr,
    thirdEntryId: thirdEntryIdStr,
  };

  const action = encodeAction({
    iface,
    target,
    functionName: "settlePool",
    args: [poolIdStr, settlementTuple],
    summary: `Settle pool ${poolIdStr} with winners ${firstEntryIdStr}, ${secondEntryIdStr}, ${thirdEntryIdStr}`,
    id: `settle-pool-${poolIdStr}`,
  });

  summaryLines.push(`Pool ID → ${poolIdStr}`);
  summaryLines.push(`1st Entry ID → ${firstEntryIdStr}`);
  summaryLines.push(`2nd Entry ID → ${secondEntryIdStr}`);
  summaryLines.push(`3rd Entry ID → ${thirdEntryIdStr}`);

  return {
    target,
    actions: [action],
    warnings,
    summaryLines,
  };
}

export function encodeRuntimeActionsAsMultisigSubmissions(params: {
  runtimePlan: EncodedRuntimePlan;
  tokenAddress?: string | null;
}) {
  const tokenAddress = params.tokenAddress ?? ethers.ZeroAddress;

  return params.runtimePlan.actions.map((action) => ({
    tokenAddress,
    to: action.target,
    value: action.value,
    data: action.data,
    summary: action.summary,
    functionName: action.functionName,
    args: action.args,
  }));
}