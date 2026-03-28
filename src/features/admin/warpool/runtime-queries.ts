import "server-only";

import { ethers } from "ethers";

import prisma, { prismaReady } from "@/src/lib/db";
import { WARPOOL_LENS_ABI } from "@/src/lib/abis/warpoolLensAbi";
import type { WarpoolQueueSlug } from "@/src/features/admin/warpool/multisig-types";

const RPC_URL =
  process.env.WARPOOL_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  process.env.BASE_RPC_URL ||
  "";

const QUEUE_ENUM_MAP: Record<WarpoolQueueSlug, { tier: number; mode: number }> = {
  FORGE_SAFEGUARD: { tier: 1, mode: 1 },
  LEGION_SAFEGUARD: { tier: 2, mode: 1 },
  LEGION_VAULTBOUND: { tier: 2, mode: 2 },
  CROWN_VAULTBOUND: { tier: 3, mode: 2 },
};

export type WarpoolRuntimeQueueStatus = {
  slug: WarpoolQueueSlug;
  queueKey: string;
  poolId: string | null;
  state: number | null;
  singleEntryPerWallet: boolean | null;
  entrantCount: number | null;
  runnableSize: number | null;
  targetSize: number | null;
  minStartSize: number | null;
  stakeAmountRaw: string | null;
  openedAt: number | null;
  expiresAt: number | null;
  lockedAt: number | null;
  seedBlockNumber: number | null;
  discountSeatsUsed: number | null;
  discountSeatsReserved: number | null;
  token11SeatsUsed: number | null;
};

export type WarpoolRuntimeOverviewData = {
  lensAddress: string | null;
  coreAddress: string | null;
  queues: WarpoolRuntimeQueueStatus[];
  warnings: string[];
};

function makeQueueKey(tier: number, mode: number) {
  return ethers.keccak256(
    ethers.solidityPacked(["uint8", "uint8"], [tier, mode])
  );
}

function toSafeNumber(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function toSafeString(value: bigint | string | null | undefined) {
  if (value === null || value === undefined) return null;
  return String(value);
}

export async function getWarpoolRuntimeOverviewData(): Promise<WarpoolRuntimeOverviewData> {
  await prismaReady;

  const warnings: string[] = [];

  const contracts = await prisma.warpoolContract.findMany({
    where: {
      active: true,
      kind: {
        in: ["CORE", "LENS"],
      },
    },
    orderBy: [{ kind: "asc" }],
  });

  const lensAddress =
    contracts.find((contract) => contract.kind === "LENS")?.address ?? null;
  const coreAddress =
    contracts.find((contract) => contract.kind === "CORE")?.address ?? null;

  const baseQueues: WarpoolRuntimeQueueStatus[] = (
    [
      "FORGE_SAFEGUARD",
      "LEGION_SAFEGUARD",
      "LEGION_VAULTBOUND",
      "CROWN_VAULTBOUND",
    ] as const
  ).map((slug) => {
    const { tier, mode } = QUEUE_ENUM_MAP[slug];
    return {
      slug,
      queueKey: makeQueueKey(tier, mode),
      poolId: null,
      state: null,
      singleEntryPerWallet: null,
      entrantCount: null,
      runnableSize: null,
      targetSize: null,
      minStartSize: null,
      stakeAmountRaw: null,
      openedAt: null,
      expiresAt: null,
      lockedAt: null,
      seedBlockNumber: null,
      discountSeatsUsed: null,
      discountSeatsReserved: null,
      token11SeatsUsed: null,
    };
  });

  if (!lensAddress) {
    warnings.push("Lens contract is not registered in WarpoolContract.");
    return {
      lensAddress,
      coreAddress,
      queues: baseQueues,
      warnings,
    };
  }

  if (!RPC_URL) {
    warnings.push(
      "RPC URL is missing. Set WARPOOL_RPC_URL or NEXT_PUBLIC_RPC_URL to enable live lens reads."
    );
    return {
      lensAddress,
      coreAddress,
      queues: baseQueues,
      warnings,
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const lens = new ethers.Contract(lensAddress, WARPOOL_LENS_ABI, provider);

    const queues = await Promise.all(
      baseQueues.map(async (queue) => {
        try {
          const result = await lens.getQueueStatus(queue.queueKey);

          return {
            ...queue,
            poolId:
              result.poolId && BigInt(result.poolId) > BigInt(0)
                ? String(result.poolId)
                : null,
            state: toSafeNumber(result.state),
            singleEntryPerWallet:
              typeof result.singleEntryPerWallet === "boolean"
                ? result.singleEntryPerWallet
                : null,
            entrantCount: toSafeNumber(result.entrantCount),
            runnableSize: toSafeNumber(result.runnableSize),
            targetSize: toSafeNumber(result.targetSize),
            minStartSize: toSafeNumber(result.minStartSize),
            stakeAmountRaw: toSafeString(result.stakeAmount),
            openedAt: toSafeNumber(result.openedAt),
            expiresAt: toSafeNumber(result.expiresAt),
            lockedAt: toSafeNumber(result.lockedAt),
            seedBlockNumber: toSafeNumber(result.seedBlockNumber),
            discountSeatsUsed: toSafeNumber(result.discountSeatsUsed),
            discountSeatsReserved: toSafeNumber(result.discountSeatsReserved),
            token11SeatsUsed: toSafeNumber(result.token11SeatsUsed),
          } satisfies WarpoolRuntimeQueueStatus;
        } catch {
          warnings.push(`Failed to read live queue status for ${queue.slug}.`);
          return queue;
        }
      })
    );

    return {
      lensAddress,
      coreAddress,
      queues,
      warnings,
    };
  } catch {
    warnings.push("Failed to connect to RPC provider for live lens reads.");
    return {
      lensAddress,
      coreAddress,
      queues: baseQueues,
      warnings,
    };
  }
}