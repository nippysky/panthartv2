// src/features/admin/warpool/worker-mutations.ts
import "server-only";

import crypto from "crypto";

import prisma from "@/src/lib/db";

type ActorInput = {
  actorAddress?: string | null;
};

type QueueRuntimeActionInput = ActorInput & {
  actionType:
    | "WARPOOL_RESERVATION_EXPIRE"
    | "WARPOOL_POOL_PROCESS_EXPIRED"
    | "WARPOOL_POOL_MARK_BATTLE_READY"
    | "WARPOOL_POOL_SETTLE";
  relatedId: string;
  payload?: Record<string, unknown> | null;
};

type QueueBattleComputeInput = ActorInput & {
  poolId: string;
};

type QueueCaptureRelistInput = ActorInput & {
  captureId: string;
};

type RetryPendingActionInput = ActorInput & {
  actionId: string;
};

function makeSyntheticQueueHash(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function actorOrDefault(actorAddress?: string | null) {
  const value = actorAddress?.trim();
  return value && value.length > 0 ? value : "system:admin-ui";
}

function normalizePayload(value: Record<string, unknown> | null | undefined) {
  return value ?? {};
}

export async function queueRuntimeAction(input: QueueRuntimeActionInput) {
  const actor = actorOrDefault(input.actorAddress);

  if (!input.relatedId?.trim()) {
    throw new Error("relatedId is required.");
  }

  if (
    input.actionType !== "WARPOOL_RESERVATION_EXPIRE" &&
    input.actionType !== "WARPOOL_POOL_PROCESS_EXPIRED" &&
    input.actionType !== "WARPOOL_POOL_MARK_BATTLE_READY" &&
    input.actionType !== "WARPOOL_POOL_SETTLE"
  ) {
    throw new Error("Unsupported runtime action type.");
  }

  if (input.actionType === "WARPOOL_RESERVATION_EXPIRE") {
    const reservation = await prisma.warpoolReservation.findUnique({
      where: { id: input.relatedId },
      select: {
        id: true,
        status: true,
        expiresAtOnChain: true,
      },
    });

    if (!reservation) throw new Error("Reservation not found.");
    if (reservation.status !== "ACTIVE") {
      throw new Error("Only ACTIVE reservations can be queued for expiry.");
    }
  }

  if (input.actionType === "WARPOOL_POOL_PROCESS_EXPIRED") {
    const pool = await prisma.warpoolPool.findUnique({
      where: { id: input.relatedId },
      select: {
        id: true,
        state: true,
      },
    });

    if (!pool) throw new Error("Pool not found.");
    if (pool.state !== "OPEN") {
      throw new Error("Only OPEN pools can be queued for processExpired.");
    }
  }

  if (input.actionType === "WARPOOL_POOL_MARK_BATTLE_READY") {
    const pool = await prisma.warpoolPool.findUnique({
      where: { id: input.relatedId },
      select: {
        id: true,
        state: true,
      },
    });

    if (!pool) throw new Error("Pool not found.");
    if (pool.state !== "LOCKED") {
      throw new Error("Only LOCKED pools can be queued for mark battle ready.");
    }
  }

  if (input.actionType === "WARPOOL_POOL_SETTLE") {
    const pool = await prisma.warpoolPool.findUnique({
      where: { id: input.relatedId },
      select: {
        id: true,
        state: true,
      },
    });

    if (!pool) throw new Error("Pool not found.");
    if (pool.state !== "BATTLE_READY") {
      throw new Error("Only BATTLE_READY pools can be queued for settlement.");
    }
  }

  const created = await prisma.pendingChainAction.create({
    data: {
      type: input.actionType,
      txHash: makeSyntheticQueueHash(`queue:${input.actionType.toLowerCase()}`),
      from: actor,
      chainId: 0,
      relatedId: input.relatedId,
      status: "PENDING",
      payload: {
        ...normalizePayload(input.payload),
        queuedBy: actor,
        queuedAt: new Date().toISOString(),
        source: "warpool-admin",
      },
    },
  });

  return created;
}

export async function queueBattleCompute(input: QueueBattleComputeInput) {
  const actor = actorOrDefault(input.actorAddress);

  if (!input.poolId?.trim()) {
    throw new Error("poolId is required.");
  }

  const pool = await prisma.warpoolPool.findUnique({
    where: { id: input.poolId },
    select: {
      id: true,
      state: true,
      runnableSize: true,
    },
  });

  if (!pool) throw new Error("Pool not found.");
  if (pool.state !== "BATTLE_READY") {
    throw new Error("Only BATTLE_READY pools can be queued for battle compute.");
  }

  const battle = await prisma.warpoolBattle.upsert({
    where: {
      poolId: input.poolId,
    },
    create: {
      poolId: input.poolId,
      status: "PENDING",
      rawOutcome: {
        requestedBy: actor,
        requestedAt: new Date().toISOString(),
        source: "warpool-admin",
      },
    },
    update: {
      status: "PENDING",
      rawOutcome: {
        requestedBy: actor,
        requestedAt: new Date().toISOString(),
        source: "warpool-admin",
        note: "Re-queued from admin.",
      },
    },
  });

  return battle;
}

export async function queueCaptureRelist(input: QueueCaptureRelistInput) {
  const actor = actorOrDefault(input.actorAddress);

  if (!input.captureId?.trim()) {
    throw new Error("captureId is required.");
  }

  return prisma.$transaction(async (tx) => {
    const capture = await tx.warpoolCapture.findUnique({
      where: { id: input.captureId },
      select: {
        id: true,
        status: true,
        relistStatus: true,
      },
    });

    if (!capture) throw new Error("Capture not found.");

    if (capture.relistStatus === "LISTED" || capture.relistStatus === "SOLD") {
      throw new Error("Capture is already listed or sold.");
    }

    const updatedCapture = await tx.warpoolCapture.update({
      where: { id: input.captureId },
      data: {
        status: "QUEUED_FOR_RELIST",
        relistStatus: "QUEUED",
      },
    });

    const pending = await tx.pendingChainAction.create({
      data: {
        type: "WARPOOL_CAPTURE_RELIST",
        txHash: makeSyntheticQueueHash("queue:warpool_capture_relist"),
        from: actor,
        chainId: 0,
        relatedId: input.captureId,
        status: "PENDING",
        payload: {
          captureId: input.captureId,
          queuedBy: actor,
          queuedAt: new Date().toISOString(),
          source: "warpool-admin",
        },
      },
    });

    return {
      capture: updatedCapture,
      pending,
    };
  });
}

export async function retryFailedPendingAction(input: RetryPendingActionInput) {
  const actor = actorOrDefault(input.actorAddress);

  if (!input.actionId?.trim()) {
    throw new Error("actionId is required.");
  }

  const existing = await prisma.pendingChainAction.findUnique({
    where: { id: input.actionId },
    select: {
      id: true,
      status: true,
      payload: true,
    },
  });

  if (!existing) throw new Error("Pending action not found.");
  if (existing.status !== "FAILED") {
    throw new Error("Only FAILED actions can be retried.");
  }

  const previousPayload =
    existing.payload && typeof existing.payload === "object" ? existing.payload : {};

  const updated = await prisma.pendingChainAction.update({
    where: { id: input.actionId },
    data: {
      status: "PENDING",
      payload: {
        ...(previousPayload as Record<string, unknown>),
        retriedBy: actor,
        retriedAt: new Date().toISOString(),
        source: "warpool-admin",
      },
    },
  });

  return updated;
}