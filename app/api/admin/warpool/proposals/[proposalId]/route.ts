import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/src/lib/generated/prisma/client";
import prisma, { prismaReady } from "@/src/lib/db";

type RouteContext = {
  params: Promise<{
    proposalId: string;
  }>;
};

type PatchBody =
  | {
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
    }
  | {
      type: "record_submission";
      actionId: string;
      txIndex: number;
      txHash: string;
      submitter?: string | null;
    }
  | {
      type: "record_confirmation";
      actionId: string;
      txIndex: number;
      txHash: string;
      ownerAddress?: string | null;
    }
  | {
      type: "record_execution";
      actionId: string;
      txIndex: number;
      txHash: string;
      executor?: string | null;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

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

function buildProposalStatusFromActions(
  actionStatuses: Array<"PENDING" | "SUBMITTED" | "EXECUTED" | "FAILED">,
  currentStatus:
    | "DRAFT"
    | "READY"
    | "SUBMITTED"
    | "APPROVED"
    | "EXECUTED"
    | "CANCELLED"
    | "FAILED"
) {
  if (currentStatus === "DRAFT" || currentStatus === "READY" || currentStatus === "CANCELLED") {
    return currentStatus;
  }

  if (actionStatuses.length === 0) {
    return currentStatus;
  }

  if (actionStatuses.some((status) => status === "FAILED")) {
    return "FAILED" as const;
  }

  if (actionStatuses.every((status) => status === "EXECUTED")) {
    return "EXECUTED" as const;
  }

  if (actionStatuses.every((status) => status === "SUBMITTED" || status === "EXECUTED")) {
    return "APPROVED" as const;
  }

  if (actionStatuses.some((status) => status === "SUBMITTED" || status === "EXECUTED")) {
    return "SUBMITTED" as const;
  }

  return currentStatus;
}

async function recalculateProposalProgress(proposalId: string) {
  const proposal = await prisma.adminProposal.findUnique({
    where: { id: proposalId },
    include: {
      actions: {
        orderBy: [{ orderIndex: "asc" }],
      },
      submittedMultisigTx: {
        include: {
          approvals: true,
        },
      },
    },
  });

  if (!proposal) return null;

  const nextStatus = buildProposalStatusFromActions(
    proposal.actions.map((action) => action.status),
    proposal.status
  );

  const submittedCount = proposal.actions.filter(
    (action) => action.status === "SUBMITTED" || action.status === "EXECUTED"
  ).length;

  const executedCount = proposal.actions.filter((action) => action.status === "EXECUTED").length;

  const patch: Prisma.AdminProposalUpdateInput = {};

  if (nextStatus !== proposal.status) {
    patch.status = nextStatus;
  }

  if (
    (nextStatus === "SUBMITTED" || nextStatus === "APPROVED" || nextStatus === "EXECUTED") &&
    !proposal.submittedAt
  ) {
    patch.submittedAt = now();
  }

  if (nextStatus === "APPROVED" && !proposal.approvedAt) {
    patch.approvedAt = now();
  }

  if (nextStatus === "EXECUTED" && !proposal.executedAt) {
    patch.executedAt = now();
  }

  const currentMetadata = isPlainObject(proposal.metadataJson) ? proposal.metadataJson : {};
  patch.metadataJson = {
    ...currentMetadata,
    progress: {
      submittedActions: submittedCount,
      approvedActions: submittedCount,
      executedActions: executedCount,
      totalActions: proposal.actions.length,
    },
  } as Prisma.InputJsonValue;

  if (Object.keys(patch).length > 0) {
    await prisma.adminProposal.update({
      where: { id: proposalId },
      data: patch,
    });
  }

  return true;
}

export async function GET(_: NextRequest, context: RouteContext) {
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
    include: {
      actions: {
        orderBy: [{ orderIndex: "asc" }],
      },
      submittedMultisigTx: {
        include: {
          approvals: true,
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
    if ("type" in body && body.type === "record_submission") {
      const action = proposal.actions.find((item) => item.id === body.actionId);
      if (!action) {
        return NextResponse.json(
          { ok: false, error: "Proposal action not found." },
          { status: 404 }
        );
      }

      await prisma.$transaction(async (tx) => {
        let multisigTxId = proposal.submittedMultisigTxId;

        if (!multisigTxId) {
          const safe = proposal.safeId
            ? await tx.multisigSafe.findUnique({
                where: { id: proposal.safeId },
                select: { id: true },
              })
            : null;

          const createdTx = await tx.multisigTx.create({
            data: {
              safeId: safe?.id ?? proposal.safeId ?? "",
              nonce: body.txIndex,
              to: action.target,
              valueWei: action.valueWei,
              dataHex: action.dataHex,
              submittedBy: body.submitter ?? proposal.createdByAddress ?? null,
              status: "SUBMITTED",
            },
          });

          multisigTxId = createdTx.id;

          await tx.adminProposal.update({
            where: { id: proposalId },
            data: {
              submittedMultisigTxId: createdTx.id,
              submittedMultisigNonce: body.txIndex,
              status: "SUBMITTED",
              submittedAt: proposal.submittedAt ?? now(),
            },
          });
        } else {
          await tx.multisigTx.update({
            where: { id: multisigTxId },
            data: {
              nonce: body.txIndex,
              to: action.target,
              valueWei: action.valueWei,
              dataHex: action.dataHex,
              submittedBy: body.submitter ?? proposal.createdByAddress ?? null,
              status: "SUBMITTED",
            },
          });
        }

        await tx.adminProposalAction.update({
          where: { id: body.actionId },
          data: {
            status: "SUBMITTED",
            submittedAt: now(),
          },
        });

        const currentMetadata = isPlainObject(proposal.metadataJson) ? proposal.metadataJson : {};
        const currentLinks = isPlainObject(currentMetadata.multisigLinks)
          ? currentMetadata.multisigLinks
          : {};

        await tx.adminProposal.update({
          where: { id: proposalId },
          data: {
            metadataJson: {
              ...currentMetadata,
              multisigLinks: {
                ...currentLinks,
                [body.actionId]: {
                  txIndex: body.txIndex,
                  txHash: body.txHash,
                  submittedBy: body.submitter ?? null,
                  submittedAt: new Date().toISOString(),
                },
              },
            } as Prisma.InputJsonValue,
          },
        });

        await tx.adminProposalEvent.create({
          data: {
            proposalId,
            actorAddress: body.submitter ?? null,
            type: "MULTISIG_SUBMITTED",
            note: `Stored action submitted to multisig at tx #${body.txIndex}.`,
            payloadJson: {
              actionId: body.actionId,
              txIndex: body.txIndex,
              txHash: body.txHash,
              submitter: body.submitter ?? null,
            } as Prisma.InputJsonValue,
          },
        });
      });

      await recalculateProposalProgress(proposalId);

      return NextResponse.json({ ok: true });
    }

    if ("type" in body && body.type === "record_confirmation") {
      const action = proposal.actions.find((item) => item.id === body.actionId);
      if (!action) {
        return NextResponse.json(
          { ok: false, error: "Proposal action not found." },
          { status: 404 }
        );
      }

      if (!proposal.submittedMultisigTxId) {
        return NextResponse.json(
          { ok: false, error: "Proposal has no linked multisig transaction yet." },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        const ownerAddress = String(body.ownerAddress || "").trim();
        if (ownerAddress) {
          const existingApproval = await tx.multisigApproval.findFirst({
            where: {
              txId: proposal.submittedMultisigTxId!,
              ownerAddress,
            },
            select: { id: true },
          });

          if (!existingApproval) {
            await tx.multisigApproval.create({
              data: {
                txId: proposal.submittedMultisigTxId!,
                ownerAddress,
              },
            });
          }
        }

        await tx.adminProposalAction.update({
          where: { id: action.id },
          data: {
            status: "SUBMITTED",
          },
        });

        await tx.multisigTx.update({
          where: { id: proposal.submittedMultisigTxId! },
          data: {
            status: "APPROVED",
          },
        });

        await tx.adminProposalEvent.create({
          data: {
            proposalId,
            actorAddress: body.ownerAddress ?? null,
            type: "MULTISIG_CONFIRMED",
            note: `Stored multisig transaction confirmed.`,
            payloadJson: {
              actionId: body.actionId,
              txIndex: body.txIndex,
              txHash: body.txHash,
              ownerAddress: body.ownerAddress ?? null,
            } as Prisma.InputJsonValue,
          },
        });
      });

      await recalculateProposalProgress(proposalId);

      return NextResponse.json({ ok: true });
    }

    if ("type" in body && body.type === "record_execution") {
      const action = proposal.actions.find((item) => item.id === body.actionId);
      if (!action) {
        return NextResponse.json(
          { ok: false, error: "Proposal action not found." },
          { status: 404 }
        );
      }

      if (!proposal.submittedMultisigTxId) {
        return NextResponse.json(
          { ok: false, error: "Proposal has no linked multisig transaction yet." },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.adminProposalAction.update({
          where: { id: action.id },
          data: {
            status: "EXECUTED",
            executedAt: now(),
          },
        });

        await tx.multisigTx.update({
          where: { id: proposal.submittedMultisigTxId! },
          data: {
            status: "EXECUTED",
            executedTxHash: body.txHash,
            executedAt: now(),
          },
        });

        const currentMetadata: Record<string, unknown> = isPlainObject(proposal.metadataJson)
          ? { ...proposal.metadataJson }
          : {};

        const rawLinks = currentMetadata["multisigLinks"];
        const currentLinks: Record<string, unknown> = isPlainObject(rawLinks)
          ? { ...rawLinks }
          : {};

        const rawCurrentLink = currentLinks[body.actionId];
        const currentLink: Record<string, unknown> = isPlainObject(rawCurrentLink)
          ? { ...rawCurrentLink }
          : {};

        await tx.adminProposal.update({
          where: { id: proposalId },
          data: {
            metadataJson: {
              ...currentMetadata,
              multisigLinks: {
                ...currentLinks,
                [body.actionId]: {
                  ...currentLink,
                  txIndex: body.txIndex,
                  executedTxHash: body.txHash,
                  executedBy: body.executor ?? null,
                  executedAt: new Date().toISOString(),
                },
              },
            } as Prisma.InputJsonValue,
          },
        });

        await tx.adminProposalEvent.create({
          data: {
            proposalId,
            actorAddress: body.executor ?? null,
            type: "MULTISIG_EXECUTED",
            note: `Stored multisig transaction executed.`,
            payloadJson: {
              actionId: body.actionId,
              txIndex: body.txIndex,
              txHash: body.txHash,
              executor: body.executor ?? null,
            } as Prisma.InputJsonValue,
          },
        });
      });

      await recalculateProposalProgress(proposalId);

      return NextResponse.json({ ok: true });
    }

    const updateData: Prisma.AdminProposalUpdateInput = {};

    if ("title" in body && typeof body.title === "string" && body.title.trim()) {
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

    if ("status" in body && body.status) {
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