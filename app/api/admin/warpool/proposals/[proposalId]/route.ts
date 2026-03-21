// app/api/admin/warpool/proposals/[proposalId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/src/lib/generated/prisma/client";
import prisma, { prismaReady } from "@/src/lib/db";

type RouteContext = {
  params: Promise<{
    proposalId: string;
  }>;
};

type UpdateProposalBody = {
  title?: string;
  summary?: string | null;
  description?: string | null;
  status?: "DRAFT" | "READY" | "SUBMITTED" | "APPROVED" | "EXECUTED" | "CANCELLED" | "FAILED";
  submittedMultisigTxId?: string | null;
  submittedMultisigNonce?: number | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
  cancelledAt?: string | null;
  failedAt?: string | null;
  lastEditedByAddress?: string | null;
  metadataJson?: unknown;
  snapshotJson?: unknown;
};

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeNullableDate(value: unknown) {
  if (!value) return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toPrismaJsonValue(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  await prismaReady;
  const { proposalId } = await context.params;

  const proposal = await prisma.adminProposal.findUnique({
    where: { id: proposalId },
    include: {
      safe: {
        select: {
          id: true,
          contract: true,
          name: true,
          threshold: true,
        },
      },
      submittedMultisigTx: {
        include: {
          approvals: {
            orderBy: [{ createdAt: "asc" }],
          },
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
              walletAddress: true,
              username: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      },
      createdByUser: {
        select: {
          id: true,
          walletAddress: true,
          username: true,
        },
      },
      lastEditedByUser: {
        select: {
          id: true,
          walletAddress: true,
          username: true,
        },
      },
    },
  });

  if (!proposal || proposal.area !== "WARPOOL") {
    return NextResponse.json(
      { ok: false, error: "Proposal not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    item: proposal,
  });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  await prismaReady;
  const { proposalId } = await context.params;

  let body: UpdateProposalBody;
  try {
    body = (await req.json()) as UpdateProposalBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const existing = await prisma.adminProposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      area: true,
    },
  });

  if (!existing || existing.area !== "WARPOOL") {
    return NextResponse.json(
      { ok: false, error: "Proposal not found." },
      { status: 404 }
    );
  }

  const actorAddress = normalizeNullableText(body.lastEditedByAddress);
  const actorUser = actorAddress
    ? await prisma.user.findUnique({
        where: { walletAddress: actorAddress },
        select: { id: true },
      })
    : null;

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.adminProposal.update({
      where: { id: proposalId },
      data: {
        title:
          typeof body.title === "string"
            ? body.title.trim() || undefined
            : undefined,
        summary:
          body.summary !== undefined ? normalizeNullableText(body.summary) : undefined,
        description:
          body.description !== undefined
            ? normalizeNullableText(body.description)
            : undefined,
        status: body.status ?? undefined,
        submittedMultisigTxId:
          body.submittedMultisigTxId !== undefined
            ? body.submittedMultisigTxId
            : undefined,
        submittedMultisigNonce:
          body.submittedMultisigNonce !== undefined
            ? body.submittedMultisigNonce
            : undefined,
        submittedAt:
          body.submittedAt !== undefined
            ? normalizeNullableDate(body.submittedAt)
            : undefined,
        approvedAt:
          body.approvedAt !== undefined
            ? normalizeNullableDate(body.approvedAt)
            : undefined,
        executedAt:
          body.executedAt !== undefined
            ? normalizeNullableDate(body.executedAt)
            : undefined,
        cancelledAt:
          body.cancelledAt !== undefined
            ? normalizeNullableDate(body.cancelledAt)
            : undefined,
        failedAt:
          body.failedAt !== undefined
            ? normalizeNullableDate(body.failedAt)
            : undefined,
        lastEditedByUserId:
          body.lastEditedByAddress !== undefined ? actorUser?.id ?? null : undefined,
        lastEditedByAddress:
          body.lastEditedByAddress !== undefined ? actorAddress : undefined,
        metadataJson:
          body.metadataJson !== undefined
            ? toPrismaJsonValue(body.metadataJson)
            : undefined,
        snapshotJson:
          body.snapshotJson !== undefined
            ? toPrismaJsonValue(body.snapshotJson)
            : undefined,
      },
    });

    await tx.adminProposalEvent.create({
      data: {
        proposalId,
        actorUserId: actorUser?.id ?? null,
        actorAddress,
        type: "PROPOSAL_UPDATED",
        note: "Warpool proposal updated from admin API.",
        payloadJson: {
          status: body.status ?? null,
          submittedMultisigTxId: body.submittedMultisigTxId ?? null,
          submittedMultisigNonce: body.submittedMultisigNonce ?? null,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return item;
  });

  return NextResponse.json({
    ok: true,
    item: updated,
  });
}