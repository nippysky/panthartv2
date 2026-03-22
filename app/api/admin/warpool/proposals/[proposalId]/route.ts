import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/src/lib/generated/prisma/client";
import prisma, { prismaReady } from "@/src/lib/db";
import { normalizeAdminAddress } from "@/src/features/admin/warpool/admin-access";

type RouteContext = {
  params: Promise<{
    proposalId: string;
  }>;
};

type PatchBody = {
  status?:
    | "DRAFT"
    | "READY"
    | "SUBMITTED"
    | "APPROVED"
    | "EXECUTED"
    | "CANCELLED"
    | "FAILED";
  note?: string;
  summary?: string | null;
  description?: string | null;
  title?: string;
  metadataJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null;
  snapshotJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null;
  actorAddress?: string | null;
};

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      typeof currentValue === "bigint" ? currentValue.toString() : currentValue
    )
  ) as T;
}

function toNullableJsonInput(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function now() {
  return new Date();
}

async function findUserIdByAddress(address: string | null) {
  if (!address) return null;

  const user = await prisma.user.findUnique({
    where: { walletAddress: address },
    select: { id: true },
  });

  return user?.id ?? null;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  await prismaReady;

  const { proposalId } = await context.params;

  const proposal = await prisma.adminProposal.findUnique({
    where: { id: proposalId },
    include: {
      safe: true,
      createdByUser: {
        select: {
          id: true,
          username: true,
          walletAddress: true,
        },
      },
      lastEditedByUser: {
        select: {
          id: true,
          username: true,
          walletAddress: true,
        },
      },
      submittedMultisigTx: {
        include: {
          approvals: true,
        },
      },
      actions: {
        orderBy: [{ orderIndex: "asc" }],
      },
      events: {
        include: {
          actorUser: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });

  if (!proposal) {
    return NextResponse.json(
      { ok: false, error: "Proposal not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    proposal: toJsonSafe(proposal),
  });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  await prismaReady;

  const { proposalId } = await context.params;
  const body = (await req.json()) as PatchBody;

  const proposal = await prisma.adminProposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      status: true,
      cancelledAt: true,
      failedAt: true,
      submittedAt: true,
      approvedAt: true,
      executedAt: true,
      createdByAddress: true,
      createdByUserId: true,
      lastEditedByAddress: true,
      _count: {
        select: {
          actions: true,
        },
      },
    },
  });

  if (!proposal) {
    return NextResponse.json(
      { ok: false, error: "Proposal not found." },
      { status: 404 }
    );
  }

  try {
    const actorAddress = normalizeAdminAddress(body.actorAddress);
    const actorUserId = await findUserIdByAddress(actorAddress);

    const creatorAddress = normalizeAdminAddress(proposal.createdByAddress);
    const creatorMissing = !creatorAddress;
    const actorIsCreator =
      !!actorAddress &&
      (!!creatorMissing || actorAddress === creatorAddress);

    if (
      body.status === "DRAFT" ||
      body.status === "READY" ||
      body.status === "CANCELLED"
    ) {
      if (!actorAddress) {
        return NextResponse.json(
          { ok: false, error: "Missing admin wallet address." },
          { status: 401 }
        );
      }

      if (!actorIsCreator) {
        return NextResponse.json(
          {
            ok: false,
            error: "Only the proposal creator wallet can change draft/ready workflow state.",
          },
          { status: 403 }
        );
      }
    }

    if (body.status === "READY" && proposal._count.actions === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "At least one proposal action is required before marking ready.",
        },
        { status: 400 }
      );
    }

    const updateData: Prisma.AdminProposalUpdateInput = {};

    if (typeof body.title === "string" && body.title.trim()) {
      updateData.title = body.title.trim();
    }

    if ("summary" in body) {
      updateData.summary = body.summary ?? null;
    }

    if ("description" in body) {
      updateData.description = body.description ?? null;
    }

    if ("metadataJson" in body) {
      updateData.metadataJson = toNullableJsonInput(body.metadataJson);
    }

    if ("snapshotJson" in body) {
      updateData.snapshotJson = toNullableJsonInput(body.snapshotJson);
    }

    if (actorAddress) {
      updateData.lastEditedByAddress = actorAddress;
      updateData.lastEditedByUser = actorUserId
        ? { connect: { id: actorUserId } }
        : { disconnect: true };

      if (creatorMissing) {
        updateData.createdByAddress = actorAddress;
        if (actorUserId) {
          updateData.createdByUser = { connect: { id: actorUserId } };
        }
      }
    }

    if (body.status) {
      updateData.status = body.status;

      if (body.status === "READY") {
        updateData.cancelledAt = null;
        updateData.failedAt = null;
      }

      if (body.status === "CANCELLED") {
        updateData.cancelledAt = proposal.cancelledAt ?? now();
      }

      if (body.status === "FAILED") {
        updateData.failedAt = proposal.failedAt ?? now();
      }

      if (body.status === "DRAFT") {
        updateData.cancelledAt = null;
        updateData.failedAt = null;
        updateData.submittedAt = null;
        updateData.approvedAt = null;
        updateData.executedAt = null;
      }
    }

    const updated = await prisma.adminProposal.update({
      where: { id: proposalId },
      data: updateData,
    });

    if (body.note) {
      await prisma.adminProposalEvent.create({
        data: {
          proposalId,
          actorUserId,
          actorAddress,
          type: "WORKFLOW_UPDATED",
          note: body.note,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      proposal: toJsonSafe(updated),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Request failed.",
      },
      { status: 500 }
    );
  }
}