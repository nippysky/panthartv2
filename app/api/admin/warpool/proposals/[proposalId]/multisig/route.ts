import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/src/lib/generated/prisma";
import prisma, { prismaReady } from "@/src/lib/db";

type Context = {
  params: Promise<{
    proposalId: string;
  }>;
};

type RouteBody =
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

type ActionLink = {
  txIndex: number;
  txHash?: string | null;
  submittedBy?: string | null;
  confirmedBy?: string[];
  executedTxHash?: string | null;
};

type ProposalMetadata = {
  actionLinks?: Record<string, ActionLink>;
  [key: string]: Prisma.InputJsonValue | undefined;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asJsonObject(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function normalizeAddress(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function readMetadata(value: unknown): ProposalMetadata {
  if (!isObject(value)) return {};
  return value as ProposalMetadata;
}

export async function POST(req: NextRequest, context: Context) {
  await prismaReady;

  try {
    const { proposalId } = await context.params;
    if (!proposalId) {
      return NextResponse.json(
        { ok: false, error: "Missing proposalId." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as RouteBody;

    const proposal = await prisma.adminProposal.findUnique({
      where: { id: proposalId },
      include: {
        safe: true,
        actions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { ok: false, error: "Proposal not found." },
        { status: 404 }
      );
    }

    const action = proposal.actions.find((item) => item.id === body.actionId);
    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Proposal action not found." },
        { status: 404 }
      );
    }

    const metadata = readMetadata(proposal.metadataJson);
    const actionLinks = isObject(metadata.actionLinks)
      ? { ...(metadata.actionLinks as Record<string, ActionLink>) }
      : {};

    const existingLink = actionLinks[action.id] ?? {
      txIndex: body.txIndex,
      confirmedBy: [],
    };

    if (body.type === "record_submission") {
      const nextLink: ActionLink = {
        ...existingLink,
        txIndex: body.txIndex,
        txHash: body.txHash,
        submittedBy: normalizeAddress(body.submitter),
        confirmedBy: Array.from(
          new Set([
            ...(existingLink.confirmedBy ?? []),
            normalizeAddress(body.submitter),
          ].filter(Boolean))
        ),
      };

      actionLinks[action.id] = nextLink;

      await prisma.$transaction(async (tx) => {
        await tx.adminProposalAction.update({
          where: { id: action.id },
          data: {
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
        });

        const safe = proposal.safe;
        let multisigTxId: string | null = null;

        if (safe) {
          const existingMultisigTx = await tx.multisigTx.findFirst({
            where: {
              safeId: safe.id,
              nonce: body.txIndex,
            },
            select: { id: true },
          });

          if (existingMultisigTx) {
            multisigTxId = existingMultisigTx.id;
          } else {
            const created = await tx.multisigTx.create({
              data: {
                safeId: safe.id,
                nonce: body.txIndex,
                to: action.target,
                valueWei: action.valueWei,
                dataHex: action.dataHex,
                submittedBy: normalizeAddress(body.submitter) || null,
                status: "SUBMITTED",
              },
              select: { id: true },
            });

            multisigTxId = created.id;
          }

          const ownerAddress = normalizeAddress(body.submitter);
          if (ownerAddress) {
            await tx.multisigApproval.upsert({
              where: {
                txId_ownerAddress: {
                  txId: multisigTxId,
                  ownerAddress,
                },
              },
              update: {},
              create: {
                txId: multisigTxId,
                ownerAddress,
              },
            });
          }
        }

        const nextMetadata: ProposalMetadata = {
          ...metadata,
          actionLinks,
        };

        const actionStatuses = await tx.adminProposalAction.findMany({
          where: { proposalId: proposal.id },
          select: { id: true, status: true },
        });

        const mergedStatuses = actionStatuses.map((item) =>
          item.id === action.id ? "SUBMITTED" : item.status
        );

        const nextProposalStatus = mergedStatuses.every(
          (status) => status === "SUBMITTED" || status === "EXECUTED"
        )
          ? "SUBMITTED"
          : proposal.status === "READY"
            ? "SUBMITTED"
            : proposal.status;

        await tx.adminProposal.update({
          where: { id: proposal.id },
          data: {
            status: nextProposalStatus,
            submittedAt: proposal.submittedAt ?? new Date(),
            submittedMultisigNonce:
              proposal.submittedMultisigNonce ?? body.txIndex,
            submittedMultisigTxId: proposal.submittedMultisigTxId ?? multisigTxId,
            metadataJson: asJsonObject(nextMetadata),
          },
        });

        await tx.adminProposalEvent.create({
          data: {
            proposalId: proposal.id,
            actorAddress: normalizeAddress(body.submitter) || null,
            type: "MULTISIG_SUBMITTED",
            note: `Submitted action #${action.orderIndex + 1} to multisig nonce ${body.txIndex}.`,
            payloadJson: {
              actionId: action.id,
              txIndex: body.txIndex,
              txHash: body.txHash,
            },
          },
        });
      });

      return NextResponse.json({ ok: true });
    }

    if (body.type === "record_confirmation") {
      const ownerAddress = normalizeAddress(body.ownerAddress);

      const nextLink: ActionLink = {
        ...existingLink,
        txIndex: body.txIndex,
        confirmedBy: Array.from(
          new Set([...(existingLink.confirmedBy ?? []), ownerAddress].filter(Boolean))
        ),
      };

      actionLinks[action.id] = nextLink;

      await prisma.$transaction(async (tx) => {
        const threshold = proposal.safe?.threshold ?? 0;
        let safeTxId: string | null = null;

        if (proposal.safe) {
          const existingMultisigTx = await tx.multisigTx.findFirst({
            where: {
              safeId: proposal.safe.id,
              nonce: body.txIndex,
            },
            select: { id: true },
          });

          if (existingMultisigTx) {
            safeTxId = existingMultisigTx.id;
          }

          if (safeTxId && ownerAddress) {
            await tx.multisigApproval.upsert({
              where: {
                txId_ownerAddress: {
                  txId: safeTxId,
                  ownerAddress,
                },
              },
              update: {},
              create: {
                txId: safeTxId,
                ownerAddress,
              },
            });

            const approvalCount = await tx.multisigApproval.count({
              where: { txId: safeTxId },
            });

            if (approvalCount >= threshold && threshold > 0) {
              await tx.multisigTx.update({
                where: { id: safeTxId },
                data: { status: "APPROVED" },
              });
            }
          }
        }

        const nextMetadata: ProposalMetadata = {
          ...metadata,
          actionLinks,
        };

        await tx.adminProposalEvent.create({
          data: {
            proposalId: proposal.id,
            actorAddress: ownerAddress || null,
            type: "MULTISIG_CONFIRMED",
            note: `Confirmed action #${action.orderIndex + 1} on multisig nonce ${body.txIndex}.`,
            payloadJson: {
              actionId: action.id,
              txIndex: body.txIndex,
              txHash: body.txHash,
              ownerAddress,
            },
          },
        });

        const safeTx = safeTxId
          ? await tx.multisigTx.findUnique({
              where: { id: safeTxId },
              select: { status: true },
            })
          : null;

        const nextProposalStatus =
          safeTx?.status === "APPROVED" &&
          (proposal.status === "SUBMITTED" || proposal.status === "READY")
            ? "APPROVED"
            : proposal.status;

        await tx.adminProposal.update({
          where: { id: proposal.id },
          data: {
            status: nextProposalStatus,
            approvedAt:
              nextProposalStatus === "APPROVED" ? new Date() : proposal.approvedAt,
            metadataJson: asJsonObject(nextMetadata),
          },
        });
      });

      return NextResponse.json({ ok: true });
    }

    if (body.type === "record_execution") {
      const nextLink: ActionLink = {
        ...existingLink,
        txIndex: body.txIndex,
        executedTxHash: body.txHash,
      };

      actionLinks[action.id] = nextLink;

      await prisma.$transaction(async (tx) => {
        await tx.adminProposalAction.update({
          where: { id: action.id },
          data: {
            status: "EXECUTED",
            executedAt: new Date(),
          },
        });

        if (proposal.safe) {
          const existingMultisigTx = await tx.multisigTx.findFirst({
            where: {
              safeId: proposal.safe.id,
              nonce: body.txIndex,
            },
            select: { id: true },
          });

          if (existingMultisigTx) {
            await tx.multisigTx.update({
              where: { id: existingMultisigTx.id },
              data: {
                status: "EXECUTED",
                executedAt: new Date(),
                executedTxHash: body.txHash,
              },
            });
          }
        }

        const nextMetadata: ProposalMetadata = {
          ...metadata,
          actionLinks,
        };

        const actionStatuses = await tx.adminProposalAction.findMany({
          where: { proposalId: proposal.id },
          select: { id: true, status: true },
        });

        const mergedStatuses = actionStatuses.map((item) =>
          item.id === action.id ? "EXECUTED" : item.status
        );

        const allExecuted = mergedStatuses.every((status) => status === "EXECUTED");

        await tx.adminProposal.update({
          where: { id: proposal.id },
          data: {
            status: allExecuted ? "EXECUTED" : proposal.status,
            executedAt: allExecuted ? new Date() : proposal.executedAt,
            metadataJson: asJsonObject(nextMetadata),
          },
        });

        await tx.adminProposalEvent.create({
          data: {
            proposalId: proposal.id,
            actorAddress: normalizeAddress(body.executor) || null,
            type: "MULTISIG_EXECUTED",
            note: `Executed action #${action.orderIndex + 1} on multisig nonce ${body.txIndex}.`,
            payloadJson: {
              actionId: action.id,
              txIndex: body.txIndex,
              txHash: body.txHash,
            },
          },
        });
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported multisig sync action." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}