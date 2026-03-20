// src/features/admin/warpool/worker-ops-queries.ts
import "server-only";

import prisma from "@/src/lib/db";
import type {
  WarpoolWorkerBattleComputeCandidate,
  WarpoolWorkerOpsData,
  WarpoolWorkerPendingActionItem,
  WarpoolWorkerRelistCandidate,
} from "@/src/features/admin/warpool/types";

export async function getWarpoolWorkerOpsData(): Promise<WarpoolWorkerOpsData> {
  const [
    battleComputeBattles,
    relistCaptures,
    pendingActions,
    failedActions,
  ] = await Promise.all([
    prisma.warpoolBattle.findMany({
      where: {
        pool: {
          state: "BATTLE_READY",
        },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 12,
      include: {
        pool: {
          select: {
            id: true,
            queueSlug: true,
            battleReadyAt: true,
            runnableSize: true,
          },
        },
      },
    }),

    prisma.warpoolCapture.findMany({
      where: {
        OR: [
          {
            status: "HELD",
            relistStatus: "NONE",
          },
          {
            relistStatus: {
              in: ["QUEUED", "FAILED"],
            },
          },
        ],
      },
      orderBy: [{ capturedAt: "asc" }],
      take: 12,
      select: {
        id: true,
        entryId: true,
        contract: true,
        tokenId: true,
        originalOwnerAddress: true,
        status: true,
        relistStatus: true,
        capturedAt: true,
        createdAt: true,
      },
    }),

    prisma.pendingChainAction.findMany({
      where: {
        type: {
          in: [
            "WARPOOL_RESERVATION_EXPIRE",
            "WARPOOL_POOL_PROCESS_EXPIRED",
            "WARPOOL_POOL_MARK_BATTLE_READY",
            "WARPOOL_POOL_SETTLE",
            "WARPOOL_CAPTURE_RELIST",
          ],
        },
        status: "PENDING",
      },
      orderBy: [{ createdAt: "desc" }],
      take: 16,
      select: {
        id: true,
        type: true,
        txHash: true,
        from: true,
        chainId: true,
        status: true,
        relatedId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.pendingChainAction.findMany({
      where: {
        type: {
          in: [
            "WARPOOL_RESERVATION_EXPIRE",
            "WARPOOL_POOL_PROCESS_EXPIRED",
            "WARPOOL_POOL_MARK_BATTLE_READY",
            "WARPOOL_POOL_SETTLE",
            "WARPOOL_CAPTURE_RELIST",
          ],
        },
        status: "FAILED",
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 16,
      select: {
        id: true,
        type: true,
        txHash: true,
        from: true,
        chainId: true,
        status: true,
        relatedId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const battleComputeCandidates: WarpoolWorkerBattleComputeCandidate[] =
    battleComputeBattles.map((battle) => ({
      battleId: battle.id,
      poolId: battle.pool.id,
      queueSlug: battle.pool.queueSlug,
      status: battle.status,
      battleReadyAt: battle.pool.battleReadyAt,
      runnableSize: battle.pool.runnableSize,
      createdAt: battle.createdAt,
    }));

  const relistCandidates: WarpoolWorkerRelistCandidate[] =
    relistCaptures.map((capture) => ({
      captureId: capture.id,
      entryId: capture.entryId,
      contract: capture.contract,
      tokenId: capture.tokenId,
      originalOwnerAddress: capture.originalOwnerAddress,
      status: capture.status,
      relistStatus: capture.relistStatus,
      capturedAt: capture.capturedAt,
      createdAt: capture.createdAt,
    }));

  const mappedPendingActions: WarpoolWorkerPendingActionItem[] =
    pendingActions.map((item) => ({
      id: item.id,
      type: item.type,
      txHash: item.txHash,
      from: item.from,
      chainId: item.chainId,
      status: item.status,
      relatedId: item.relatedId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

  const mappedFailedActions: WarpoolWorkerPendingActionItem[] =
    failedActions.map((item) => ({
      id: item.id,
      type: item.type,
      txHash: item.txHash,
      from: item.from,
      chainId: item.chainId,
      status: item.status,
      relatedId: item.relatedId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

  return {
    battleComputeCandidates,
    relistCandidates,
    pendingActions: mappedPendingActions,
    failedActions: mappedFailedActions,
  };
}