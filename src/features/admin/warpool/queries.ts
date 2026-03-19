// src/features/admin/warpool/queries.ts
import "server-only";

import { ethers } from "ethers";

import prisma from "@/src/lib/db";
import { WARPOOL_CONFIG_ABI } from "@/src/lib/abis/warpoolConfigAbi";
import type {
  WarpoolAdminMultisigTxItem,
  WarpoolAdminOverviewData,
  WarpoolMultisigResolutionSource,
  WarpoolMultisigSummary,
} from "./types";

const RPC_URL =
  process.env.WARPOOL_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  process.env.BASE_RPC_URL ||
  "";

async function resolveWarpoolMultisig(params: {
  configAddress: string | null;
}): Promise<{
  multisigAddress: string | null;
  multisigResolutionSource: WarpoolMultisigResolutionSource;
  multisigSummary: WarpoolMultisigSummary | null;
}> {
  const fallback = await prisma.multisigSafe.findFirst({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      contract: true,
      threshold: true,
      owners: {
        where: {
          removedAt: null,
        },
        select: {
          id: true,
        },
      },
    },
  });

  const fallbackSummary: WarpoolMultisigSummary | null = fallback
    ? {
        contract: fallback.contract,
        threshold: fallback.threshold,
        ownersCount: fallback.owners.length,
      }
    : null;

  if (!params.configAddress || !ethers.isAddress(params.configAddress)) {
    return {
      multisigAddress: fallbackSummary?.contract ?? null,
      multisigResolutionSource: fallbackSummary
        ? "LATEST_REGISTERED_FALLBACK"
        : "UNAVAILABLE",
      multisigSummary: fallbackSummary,
    };
  }

  if (!RPC_URL) {
    return {
      multisigAddress: fallbackSummary?.contract ?? null,
      multisigResolutionSource: fallbackSummary
        ? "LATEST_REGISTERED_FALLBACK"
        : "UNAVAILABLE",
      multisigSummary: fallbackSummary,
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const config = new ethers.Contract(params.configAddress, WARPOOL_CONFIG_ABI, provider);

    const ownerRaw = await config.owner();
    const ownerAddress = ethers.getAddress(String(ownerRaw));

    const matchedSafe = await prisma.multisigSafe.findFirst({
      where: {
        contract: ownerAddress,
      },
      select: {
        contract: true,
        threshold: true,
        owners: {
          where: {
            removedAt: null,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (matchedSafe) {
      return {
        multisigAddress: matchedSafe.contract,
        multisigResolutionSource: "CONFIG_OWNER_MATCH",
        multisigSummary: {
          contract: matchedSafe.contract,
          threshold: matchedSafe.threshold,
          ownersCount: matchedSafe.owners.length,
        },
      };
    }

    return {
      multisigAddress: fallbackSummary?.contract ?? ownerAddress,
      multisigResolutionSource: fallbackSummary
        ? "LATEST_REGISTERED_FALLBACK"
        : "CONFIG_OWNER_UNREGISTERED",
      multisigSummary: fallbackSummary,
    };
  } catch {
    return {
      multisigAddress: fallbackSummary?.contract ?? null,
      multisigResolutionSource: fallbackSummary
        ? "LATEST_REGISTERED_FALLBACK"
        : "UNAVAILABLE",
      multisigSummary: fallbackSummary,
    };
  }
}

async function getRecentMultisigTxs(
  multisigAddress: string | null
): Promise<WarpoolAdminMultisigTxItem[]> {
  if (!multisigAddress) return [];

  const safe = await prisma.multisigSafe.findFirst({
    where: {
      contract: multisigAddress,
    },
    select: {
      txs: {
        orderBy: [{ createdAt: "desc" }],
        take: 12,
        select: {
          id: true,
          nonce: true,
          to: true,
          valueWei: true,
          dataHex: true,
          status: true,
          submittedBy: true,
          executedTxHash: true,
          createdAt: true,
          executedAt: true,
          approvals: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!safe) return [];

  return safe.txs.map((tx) => ({
    id: tx.id,
    nonce: tx.nonce,
    to: tx.to,
    valueWei: tx.valueWei.toString(),
    dataHex: tx.dataHex,
    status: tx.status,
    submittedBy: tx.submittedBy,
    approvalsCount: tx.approvals.length,
    executedTxHash: tx.executedTxHash,
    createdAt: tx.createdAt,
    executedAt: tx.executedAt,
  }));
}

export async function getWarpoolAdminOverviewData(): Promise<WarpoolAdminOverviewData> {
  const [
    contracts,
    latestConfigSnapshot,
    rawQueueCards,
    totalPools,
    openPools,
    lockedPools,
    battleReadyPools,
    settledPools,
    expiredRefundedPools,
    totalEntries,
    totalReservations,
    totalCaptures,
  ] = await Promise.all([
    prisma.warpoolContract.findMany({
      orderBy: [{ kind: "asc" }],
    }),

    prisma.warpoolGlobalConfigSnapshot.findFirst({
      orderBy: [{ syncedAt: "desc" }],
    }),

    prisma.warpoolQueueConfig.findMany({
      orderBy: [{ slug: "asc" }, { syncedAt: "desc" }],
      distinct: ["slug"],
    }),

    prisma.warpoolPool.count(),
    prisma.warpoolPool.count({ where: { state: "OPEN" } }),
    prisma.warpoolPool.count({ where: { state: "LOCKED" } }),
    prisma.warpoolPool.count({ where: { state: "BATTLE_READY" } }),
    prisma.warpoolPool.count({ where: { state: "SETTLED" } }),
    prisma.warpoolPool.count({ where: { state: "EXPIRED_REFUNDED" } }),
    prisma.warpoolEntry.count(),
    prisma.warpoolReservation.count(),
    prisma.warpoolCapture.count(),
  ]);

  const queueCards = rawQueueCards.map((queue) => ({
    ...queue,
    stakeAmountRaw: queue.stakeAmountRaw.toString(),
  }));

  const contractAddresses = contracts.map((item) => item.address);

  const cursors =
    contractAddresses.length === 0
      ? []
      : await prisma.chainState.findMany({
          where: {
            contract: {
              in: contractAddresses,
            },
          },
          orderBy: [{ contract: "asc" }],
          select: {
            contract: true,
            lastBlockNumber: true,
          },
        });

  const configAddress =
    contracts.find((contract) => contract.kind === "CONFIG")?.address ?? null;

  const { multisigAddress, multisigResolutionSource, multisigSummary } =
    await resolveWarpoolMultisig({
      configAddress,
    });

  const recentMultisigTxs = await getRecentMultisigTxs(multisigAddress);

  return {
    contracts,
    latestConfigSnapshot,
    queueCards,
    stats: {
      totalPools,
      openPools,
      lockedPools,
      battleReadyPools,
      settledPools,
      expiredRefundedPools,
      totalEntries,
      totalReservations,
      totalCaptures,
    },
    cursors,
    multisigAddress,
    multisigResolutionSource,
    multisigSummary,
    recentMultisigTxs,
  };
}