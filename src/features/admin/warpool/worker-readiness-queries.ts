// src/features/admin/warpool/worker-readiness-queries.ts
import "server-only";

import prisma from "@/src/lib/db";
import type { WarpoolWorkerReadinessData } from "@/src/features/admin/warpool/types";

export async function getWarpoolWorkerReadinessData(): Promise<WarpoolWorkerReadinessData> {
  const now = new Date();

  const [
    expiredOpenPools,
    battleReadyCandidates,
    settlementCandidates,
    expiredReservations,
  ] = await Promise.all([
    prisma.warpoolPool.findMany({
      where: {
        state: "OPEN",
        expiresAt: {
          lt: now,
        },
      },
      orderBy: [{ expiresAt: "asc" }],
      take: 12,
      select: {
        id: true,
        queueSlug: true,
        queueKey: true,
        expiresAt: true,
        entrantCount: true,
        minStartSize: true,
      },
    }),

    prisma.warpoolPool.findMany({
      where: {
        state: "LOCKED",
        seedBlockNumber: {
          not: null,
        },
      },
      orderBy: [{ lockedAt: "asc" }],
      take: 12,
      select: {
        id: true,
        queueSlug: true,
        lockedAt: true,
        seedBlockNumber: true,
        entrantCount: true,
        runnableSize: true,
      },
    }),

    prisma.warpoolPool.findMany({
      where: {
        state: "BATTLE_READY",
      },
      orderBy: [{ battleReadyAt: "asc" }],
      take: 12,
      select: {
        id: true,
        queueSlug: true,
        battleReadyAt: true,
        runnableSize: true,
      },
    }),

    prisma.warpoolReservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAtOnChain: {
          lt: now,
        },
      },
      orderBy: [{ expiresAtOnChain: "asc" }],
      take: 12,
      select: {
        id: true,
        poolId: true,
        userAddress: true,
        expiresAtOnChain: true,
        pool: {
          select: {
            queueSlug: true,
          },
        },
      },
    }),
  ]);

  return {
    expiredOpenPools: expiredOpenPools.map((pool) => ({
      poolId: pool.id,
      queueSlug: pool.queueSlug,
      queueKey: pool.queueKey,
      expiresAt: pool.expiresAt,
      entrantCount: pool.entrantCount,
      minStartSize: pool.minStartSize,
    })),

    battleReadyCandidates: battleReadyCandidates.map((pool) => ({
      poolId: pool.id,
      queueSlug: pool.queueSlug,
      lockedAt: pool.lockedAt,
      seedBlockNumber: pool.seedBlockNumber,
      entrantCount: pool.entrantCount,
      runnableSize: pool.runnableSize,
    })),

    settlementCandidates: settlementCandidates.map((pool) => ({
      poolId: pool.id,
      queueSlug: pool.queueSlug,
      battleReadyAt: pool.battleReadyAt,
      runnableSize: pool.runnableSize,
    })),

    expiredReservations: expiredReservations.map((reservation) => ({
      reservationId: reservation.id,
      poolId: reservation.poolId,
      queueSlug: reservation.pool.queueSlug,
      userAddress: reservation.userAddress,
      expiresAtOnChain: reservation.expiresAtOnChain,
    })),
  };
}