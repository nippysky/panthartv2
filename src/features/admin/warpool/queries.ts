import "server-only";

import { ethers } from "ethers";
import { Prisma } from "@/src/lib/generated/prisma/client";

import prisma, { prismaReady } from "@/src/lib/db";
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

type SafeSummaryRow = {
  id: string;
  contract: string;
  threshold: number;
  owners: Array<{ id: string; ownerAddress?: string }>;
};

async function getLatestRegisteredSafe(): Promise<SafeSummaryRow | null> {
  return prisma.multisigSafe.findFirst({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      contract: true,
      threshold: true,
      owners: {
        where: { removedAt: null },
        select: {
          id: true,
          ownerAddress: true,
        },
      },
    },
  });
}

function toSummary(safe: SafeSummaryRow | null): WarpoolMultisigSummary | null {
  if (!safe) return null;

  return {
    contract: safe.contract,
    threshold: safe.threshold,
    ownersCount: safe.owners.length,
  };
}

async function resolveWarpoolMultisig(params: {
  configAddress: string | null;
}): Promise<{
  multisigAddress: string | null;
  multisigResolutionSource: WarpoolMultisigResolutionSource;
  multisigSummary: WarpoolMultisigSummary | null;
}> {
  const fallbackSafe = await getLatestRegisteredSafe();
  const fallbackSummary = toSummary(fallbackSafe);

  if (!params.configAddress || !ethers.isAddress(params.configAddress) || !RPC_URL) {
    return {
      multisigAddress: fallbackSafe?.contract ?? null,
      multisigResolutionSource: fallbackSafe
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
        id: true,
        contract: true,
        threshold: true,
        owners: {
          where: { removedAt: null },
          select: {
            id: true,
            ownerAddress: true,
          },
        },
      },
    });

    if (matchedSafe) {
      return {
        multisigAddress: matchedSafe.contract,
        multisigResolutionSource: "CONFIG_OWNER_MATCH",
        multisigSummary: toSummary(matchedSafe),
      };
    }

    if (fallbackSafe) {
      return {
        multisigAddress: fallbackSafe.contract,
        multisigResolutionSource: "LATEST_REGISTERED_FALLBACK",
        multisigSummary: fallbackSummary,
      };
    }

    return {
      multisigAddress: ownerAddress,
      multisigResolutionSource: "CONFIG_OWNER_UNREGISTERED",
      multisigSummary: {
        contract: ownerAddress,
        threshold: 0,
        ownersCount: 0,
      },
    };
  } catch {
    return {
      multisigAddress: fallbackSafe?.contract ?? null,
      multisigResolutionSource: fallbackSafe
        ? "LATEST_REGISTERED_FALLBACK"
        : "UNAVAILABLE",
      multisigSummary: fallbackSummary,
    };
  }
}

function normalizeRecentTxRow(tx: {
  id: string;
  nonce: number;
  to: string;
  valueWei: Prisma.Decimal | { toString(): string };
  dataHex: string | null;
  status: string;
  submittedBy: string | null;
  executedTxHash: string | null;
  createdAt: Date;
  executedAt: Date | null;
  approvals: Array<{ id: string }>;
  safe?: { threshold: number } | null;
}): WarpoolAdminMultisigTxItem {
  const approvalsCount = tx.approvals.length;
  const threshold = tx.safe?.threshold ?? 0;

  const normalizedStatus =
    tx.status === "EXECUTED"
      ? "EXECUTED"
      : threshold > 0 && approvalsCount >= threshold
        ? "APPROVED"
        : (tx.status as WarpoolAdminMultisigTxItem["status"]);

  return {
    id: tx.id,
    nonce: tx.nonce,
    to: tx.to,
    valueWei: tx.valueWei.toString(),
    dataHex: tx.dataHex ?? "0x",
    status: normalizedStatus,
    submittedBy: tx.submittedBy,
    approvalsCount,
    executedTxHash: tx.executedTxHash,
    createdAt: tx.createdAt,
    executedAt: tx.executedAt,
  };
}

async function getRecentMultisigTxs(
  multisigAddress: string | null
): Promise<WarpoolAdminMultisigTxItem[]> {
  const warpoolSafeIds = await prisma.adminProposal.findMany({
    where: {
      area: "WARPOOL",
      safeId: { not: null },
    },
    distinct: ["safeId"],
    select: {
      safeId: true,
    },
  });

  const safeIdList = warpoolSafeIds
    .map((item) => item.safeId)
    .filter((value): value is string => !!value);

  const recentByResolvedSafe = multisigAddress
    ? await prisma.multisigTx.findMany({
        where: {
          safe: {
            contract: multisigAddress,
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 12,
        include: {
          safe: {
            select: {
              threshold: true,
            },
          },
          approvals: {
            orderBy: [{ createdAt: "asc" }],
            select: {
              id: true,
            },
          },
        },
      })
    : [];

  const recentByWarpoolProposals =
    safeIdList.length > 0
      ? await prisma.multisigTx.findMany({
          where: {
            safeId: {
              in: safeIdList,
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 24,
          include: {
            safe: {
              select: {
                threshold: true,
              },
            },
            approvals: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                id: true,
              },
            },
          },
        })
      : [];

  const merged = [...recentByResolvedSafe, ...recentByWarpoolProposals];
  const deduped = new Map<string, WarpoolAdminMultisigTxItem>();

  for (const tx of merged) {
    deduped.set(tx.id, normalizeRecentTxRow(tx));
  }

  return Array.from(deduped.values())
    .sort((a, b) => {
      const aTime = new Date(a.executedAt ?? a.createdAt).getTime();
      const bTime = new Date(b.executedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 12);
}

export async function getWarpoolAdminOverviewData(): Promise<WarpoolAdminOverviewData> {
  await prismaReady;

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