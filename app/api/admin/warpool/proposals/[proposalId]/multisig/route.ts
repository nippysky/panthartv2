import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/src/lib/generated/prisma/client";
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
      confirmedInSameTx?: boolean;
      executedInSameTx?: boolean;
    }
  | {
      type: "record_confirmation";
      actionId: string;
      txIndex: number;
      txHash: string;
      ownerAddress?: string | null;
      executedInSameTx?: boolean;
    }
  | {
      type: "record_execution";
      actionId: string;
      txIndex: number;
      txHash: string;
      executor?: string | null;
    };

type StoredMultisigLink = {
  txId?: string | null;
  txIndex?: number | null;
  txHash?: string | null;
  executedTxHash?: string | null;
  submittedBy?: string | null;
  confirmedBy?: string | null;
  executedBy?: string | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  executedAt?: string | null;
  status?: "SUBMITTED" | "APPROVED" | "EXECUTED" | "FAILED";
};

type ProposalStatus =
  | "DRAFT"
  | "READY"
  | "SUBMITTED"
  | "APPROVED"
  | "EXECUTED"
  | "CANCELLED"
  | "FAILED";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeAddress(value: string | null | undefined) {
  const next = String(value ?? "").trim().toLowerCase();
  return next || null;
}

function getStoredLinks(metadataJson: unknown) {
  if (!isPlainObject(metadataJson)) return {} as Record<string, StoredMultisigLink>;
  const raw = metadataJson.multisigLinks;
  if (!isPlainObject(raw)) return {} as Record<string, StoredMultisigLink>;
  return raw as Record<string, StoredMultisigLink>;
}

function mergeMetadataWithLinks(
  metadataJson: unknown,
  nextLinks: Record<string, StoredMultisigLink>,
  progress?: {
    totalActions: number;
    submittedActions: number;
    approvedActions: number;
    executedActions: number;
  }
): Prisma.InputJsonValue {
  const base = isPlainObject(metadataJson) ? { ...metadataJson } : {};
  return {
    ...base,
    multisigLinks: nextLinks,
    ...(progress ? { progress } : {}),
  } as Prisma.InputJsonValue;
}

function now() {
  return new Date();
}

function normalizeProposalStatusFromCounts(params: {
  currentStatus: ProposalStatus;
  total: number;
  submitted: number;
  approved: number;
  executed: number;
  failed: number;
}) {
  if (params.currentStatus === "CANCELLED") return "CANCELLED" as const;
  if (params.failed > 0) return "FAILED" as const;
  if (params.total > 0 && params.executed === params.total) return "EXECUTED" as const;
  if (params.total > 0 && params.approved === params.total) return "APPROVED" as const;
  if (params.submitted > 0) return "SUBMITTED" as const;
  return params.currentStatus;
}

async function recalculateProposalProgress(proposalId: string) {
  const proposal = await prisma.adminProposal.findUnique({
    where: { id: proposalId },
    include: {
      safe: {
        select: {
          threshold: true,
        },
      },
      actions: {
        orderBy: [{ orderIndex: "asc" }],
      },
    },
  });

  if (!proposal) return null;

  const links = getStoredLinks(proposal.metadataJson);
  const txIds = Object.values(links)
    .map((item) => item.txId)
    .filter((value): value is string => !!value);

  const txs =
    txIds.length > 0
      ? await prisma.multisigTx.findMany({
          where: { id: { in: txIds } },
          include: {
            approvals: {
              select: {
                id: true,
                ownerAddress: true,
              },
            },
          },
        })
      : [];

  const txMap = new Map(txs.map((tx) => [tx.id, tx]));

  let submittedCount = 0;
  let approvedCount = 0;
  let executedCount = 0;
  let failedCount = 0;

  for (const action of proposal.actions) {
    const link = links[action.id];
    const tx = link?.txId ? txMap.get(link.txId) : null;
    const threshold = proposal.safe?.threshold ?? 0;
    const approvalsCount = tx?.approvals.length ?? 0;

    const effectiveSubmitted =
      !!link?.txId ||
      (link?.txIndex !== null && link?.txIndex !== undefined) ||
      !!link?.txHash ||
      !!link?.submittedAt ||
      action.status === "SUBMITTED" ||
      action.status === "EXECUTED" ||
      tx?.status === "SUBMITTED" ||
      tx?.status === "APPROVED" ||
      tx?.status === "EXECUTED";

    const effectiveApproved =
      tx?.status === "APPROVED" ||
      tx?.status === "EXECUTED" ||
      link?.status === "APPROVED" ||
      link?.status === "EXECUTED" ||
      (threshold > 0 && approvalsCount >= threshold);

    const effectiveExecuted =
      action.status === "EXECUTED" ||
      tx?.status === "EXECUTED" ||
      link?.status === "EXECUTED" ||
      !!link?.executedAt ||
      !!link?.executedTxHash;

    const effectiveFailed =
      action.status === "FAILED" ||
      tx?.status === "FAILED" ||
      tx?.status === "CANCELLED" ||
      tx?.status === "EXPIRED" ||
      link?.status === "FAILED";

    if (effectiveSubmitted) submittedCount += 1;
    if (effectiveApproved) approvedCount += 1;
    if (effectiveExecuted) executedCount += 1;
    if (effectiveFailed) failedCount += 1;
  }

  const nextStatus = normalizeProposalStatusFromCounts({
    currentStatus: proposal.status as ProposalStatus,
    total: proposal.actions.length,
    submitted: submittedCount,
    approved: approvedCount,
    executed: executedCount,
    failed: failedCount,
  });

  const nextMetadata = mergeMetadataWithLinks(proposal.metadataJson, links, {
    totalActions: proposal.actions.length,
    submittedActions: submittedCount,
    approvedActions: approvedCount,
    executedActions: executedCount,
  });

  const updateData: Prisma.AdminProposalUpdateInput = {
    metadataJson: nextMetadata,
    status: nextStatus,
  };

  if (nextStatus === "SUBMITTED" && !proposal.submittedAt) {
    updateData.submittedAt = now();
  }
  if (nextStatus === "APPROVED" && !proposal.approvedAt) {
    updateData.approvedAt = now();
  }
  if (nextStatus === "EXECUTED" && !proposal.executedAt) {
    updateData.executedAt = now();
  }
  if (nextStatus !== "FAILED") {
    updateData.failedAt = null;
  }

  await prisma.adminProposal.update({
    where: { id: proposalId },
    data: updateData,
  });

  return true;
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
        safe: {
          include: {
            owners: {
              where: { removedAt: null },
              select: {
                ownerAddress: true,
              },
            },
          },
        },
        actions: {
          orderBy: [{ orderIndex: "asc" }],
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

    if (!proposal.safeId || !proposal.safe) {
      return NextResponse.json(
        { ok: false, error: "Proposal has no linked multisig safe." },
        { status: 400 }
      );
    }

    const allowedOwners = new Set(
      proposal.safe.owners.map((owner) => owner.ownerAddress.toLowerCase())
    );

    if (body.type === "record_submission") {
      const submitter = normalizeAddress(body.submitter);
      const confirmedInSameTx = Boolean(body.confirmedInSameTx || body.executedInSameTx);
      const executedInSameTx = Boolean(body.executedInSameTx);

      if (submitter && !allowedOwners.has(submitter)) {
        return NextResponse.json(
          { ok: false, error: "Submitting wallet is not an active multisig owner." },
          { status: 403 }
        );
      }

      await prisma.$transaction(async (tx) => {
        const eventTime = now();
        const eventIso = eventTime.toISOString();

        let multisigTx = await tx.multisigTx.findUnique({
          where: {
            safeId_nonce: {
              safeId: proposal.safeId!,
              nonce: body.txIndex,
            },
          },
          include: {
            approvals: {
              select: {
                id: true,
                ownerAddress: true,
              },
            },
          },
        });

        if (!multisigTx) {
          multisigTx = await tx.multisigTx.create({
            data: {
              safeId: proposal.safeId!,
              nonce: body.txIndex,
              to: action.target,
              valueWei: action.valueWei,
              dataHex: action.dataHex,
              submittedBy: submitter ?? proposal.createdByAddress ?? undefined,
              status: "SUBMITTED",
            },
            include: {
              approvals: {
                select: {
                  id: true,
                  ownerAddress: true,
                },
              },
            },
          });
        }

        if (submitter) {
          await tx.multisigApproval.upsert({
            where: {
              txId_ownerAddress: {
                txId: multisigTx.id,
                ownerAddress: submitter,
              },
            },
            update: {},
            create: {
              txId: multisigTx.id,
              ownerAddress: submitter,
            },
          });
        }

        const approvalsCount = await tx.multisigApproval.count({
          where: { txId: multisigTx.id },
        });

        const nextTxStatus = executedInSameTx
          ? "EXECUTED"
          : approvalsCount >= proposal.safe!.threshold
            ? "APPROVED"
            : "SUBMITTED";

        await tx.multisigTx.update({
          where: { id: multisigTx.id },
          data: {
            status: nextTxStatus,
            ...(executedInSameTx
              ? {
                  executedTxHash: body.txHash,
                  executedAt: eventTime,
                }
              : {}),
          },
        });

        await tx.adminProposalAction.update({
          where: { id: action.id },
          data: {
            status: executedInSameTx ? "EXECUTED" : "SUBMITTED",
            submittedAt: action.submittedAt ?? eventTime,
            ...(executedInSameTx ? { executedAt: action.executedAt ?? eventTime } : {}),
          },
        });

        const currentLinks = getStoredLinks(proposal.metadataJson);
        const nextLinks: Record<string, StoredMultisigLink> = {
          ...currentLinks,
          [action.id]: {
            txId: multisigTx.id,
            txIndex: body.txIndex,
            txHash: body.txHash,
            submittedBy: submitter,
            submittedAt: currentLinks[action.id]?.submittedAt ?? eventIso,
            ...(confirmedInSameTx
              ? {
                  confirmedBy: submitter,
                  confirmedAt: currentLinks[action.id]?.confirmedAt ?? eventIso,
                }
              : {}),
            ...(executedInSameTx
              ? {
                  executedBy: submitter,
                  executedAt: currentLinks[action.id]?.executedAt ?? eventIso,
                  executedTxHash: body.txHash,
                }
              : {}),
            status: nextTxStatus,
          },
        };

        await tx.adminProposal.update({
          where: { id: proposal.id },
          data: {
            submittedMultisigTxId: proposal.submittedMultisigTxId ?? multisigTx.id,
            submittedMultisigNonce: proposal.submittedMultisigNonce ?? body.txIndex,
            metadataJson: mergeMetadataWithLinks(proposal.metadataJson, nextLinks),
            status: executedInSameTx ? "EXECUTED" : "SUBMITTED",
            submittedAt: proposal.submittedAt ?? eventTime,
            ...(confirmedInSameTx ? { approvedAt: proposal.approvedAt ?? eventTime } : {}),
            ...(executedInSameTx ? { executedAt: proposal.executedAt ?? eventTime } : {}),
          },
        });

        await tx.adminProposalEvent.create({
          data: {
            proposalId: proposal.id,
            actorAddress: submitter,
            type: "MULTISIG_SUBMITTED",
            note: `Submitted action #${action.orderIndex + 1} to multisig nonce ${body.txIndex}.`,
            payloadJson: {
              actionId: action.id,
              txIndex: body.txIndex,
              txHash: body.txHash,
              confirmedInSameTx,
              executedInSameTx,
            } as Prisma.InputJsonValue,
          },
        });

        if (confirmedInSameTx) {
          await tx.adminProposalEvent.create({
            data: {
              proposalId: proposal.id,
              actorAddress: submitter,
              type: "MULTISIG_CONFIRMED",
              note: `Action #${action.orderIndex + 1} was confirmed in the same submission transaction.`,
              payloadJson: {
                actionId: action.id,
                txIndex: body.txIndex,
                txHash: body.txHash,
                ownerAddress: submitter,
                sameTransaction: true,
              } as Prisma.InputJsonValue,
            },
          });
        }

        if (executedInSameTx) {
          await tx.adminProposalEvent.create({
            data: {
              proposalId: proposal.id,
              actorAddress: submitter,
              type: "MULTISIG_EXECUTED",
              note: `Action #${action.orderIndex + 1} was executed in the same submission transaction.`,
              payloadJson: {
                actionId: action.id,
                txIndex: body.txIndex,
                txHash: body.txHash,
                executor: submitter,
                sameTransaction: true,
              } as Prisma.InputJsonValue,
            },
          });
        }
      });

      await recalculateProposalProgress(proposalId);
      return NextResponse.json({ ok: true });
    }

    if (body.type === "record_confirmation") {
      const ownerAddress = normalizeAddress(body.ownerAddress);
      const executedInSameTx = Boolean(body.executedInSameTx);

      if (!ownerAddress || !allowedOwners.has(ownerAddress)) {
        return NextResponse.json(
          { ok: false, error: "Confirming wallet is not an active multisig owner." },
          { status: 403 }
        );
      }

      const currentLinks = getStoredLinks(proposal.metadataJson);
      const existingLink = currentLinks[action.id];
      const existingTxId = existingLink?.txId;

      if (!existingTxId) {
        return NextResponse.json(
          { ok: false, error: "This action has no stored multisig tx yet." },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        const eventTime = now();
        const eventIso = eventTime.toISOString();

        await tx.multisigApproval.upsert({
          where: {
            txId_ownerAddress: {
              txId: existingTxId,
              ownerAddress,
            },
          },
          update: {},
          create: {
            txId: existingTxId,
            ownerAddress,
          },
        });

        const approvalCount = await tx.multisigApproval.count({
          where: { txId: existingTxId },
        });

        const nextTxStatus = executedInSameTx
          ? "EXECUTED"
          : proposal.safe!.threshold > 0 && approvalCount >= proposal.safe!.threshold
            ? "APPROVED"
            : "SUBMITTED";

        await tx.multisigTx.update({
          where: { id: existingTxId },
          data: {
            status: nextTxStatus,
            ...(executedInSameTx
              ? {
                  executedAt: eventTime,
                  executedTxHash: body.txHash,
                }
              : {}),
          },
        });

        if (executedInSameTx) {
          await tx.adminProposalAction.update({
            where: { id: action.id },
            data: {
              status: "EXECUTED",
              executedAt: action.executedAt ?? eventTime,
            },
          });
        }

        const nextLinks: Record<string, StoredMultisigLink> = {
          ...currentLinks,
          [action.id]: {
            ...existingLink,
            txId: existingTxId,
            txIndex: body.txIndex,
            txHash: body.txHash,
            confirmedBy: ownerAddress,
            confirmedAt: existingLink?.confirmedAt ?? eventIso,
            ...(executedInSameTx
              ? {
                  executedBy: ownerAddress,
                  executedAt: existingLink?.executedAt ?? eventIso,
                  executedTxHash: body.txHash,
                }
              : {}),
            status: nextTxStatus,
          },
        };

        await tx.adminProposal.update({
          where: { id: proposal.id },
          data: {
            metadataJson: mergeMetadataWithLinks(proposal.metadataJson, nextLinks),
          },
        });

        await tx.adminProposalEvent.create({
          data: {
            proposalId: proposal.id,
            actorAddress: ownerAddress,
            type: "MULTISIG_CONFIRMED",
            note: `Confirmed action #${action.orderIndex + 1} on multisig nonce ${body.txIndex}.`,
            payloadJson: {
              actionId: action.id,
              txIndex: body.txIndex,
              txHash: body.txHash,
              ownerAddress,
              executedInSameTx,
            } as Prisma.InputJsonValue,
          },
        });

        if (executedInSameTx) {
          await tx.adminProposalEvent.create({
            data: {
              proposalId: proposal.id,
              actorAddress: ownerAddress,
              type: "MULTISIG_EXECUTED",
              note: `Action #${action.orderIndex + 1} auto-executed during confirmation.`,
              payloadJson: {
                actionId: action.id,
                txIndex: body.txIndex,
                txHash: body.txHash,
                executor: ownerAddress,
                sameTransaction: true,
              } as Prisma.InputJsonValue,
            },
          });
        }
      });

      await recalculateProposalProgress(proposalId);
      return NextResponse.json({ ok: true });
    }

    if (body.type === "record_execution") {
      const executor = normalizeAddress(body.executor);
      if (!executor || !allowedOwners.has(executor)) {
        return NextResponse.json(
          { ok: false, error: "Executing wallet is not an active multisig owner." },
          { status: 403 }
        );
      }

      const currentLinks = getStoredLinks(proposal.metadataJson);
      const existingLink = currentLinks[action.id];
      const existingTxId = existingLink?.txId;

      if (!existingTxId) {
        return NextResponse.json(
          { ok: false, error: "This action has no stored multisig tx yet." },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        const eventTime = now();
        const eventIso = eventTime.toISOString();

        await tx.adminProposalAction.update({
          where: { id: action.id },
          data: {
            status: "EXECUTED",
            executedAt: action.executedAt ?? eventTime,
          },
        });

        await tx.multisigTx.update({
          where: { id: existingTxId },
          data: {
            status: "EXECUTED",
            executedAt: eventTime,
            executedTxHash: body.txHash,
          },
        });

        const nextLinks: Record<string, StoredMultisigLink> = {
          ...currentLinks,
          [action.id]: {
            ...existingLink,
            txId: existingTxId,
            txIndex: body.txIndex,
            executedBy: executor,
            executedAt: existingLink?.executedAt ?? eventIso,
            executedTxHash: body.txHash,
            status: "EXECUTED",
          },
        };

        await tx.adminProposal.update({
          where: { id: proposal.id },
          data: {
            metadataJson: mergeMetadataWithLinks(proposal.metadataJson, nextLinks),
          },
        });

        await tx.adminProposalEvent.create({
          data: {
            proposalId: proposal.id,
            actorAddress: executor,
            type: "MULTISIG_EXECUTED",
            note: `Executed action #${action.orderIndex + 1} on multisig nonce ${body.txIndex}.`,
            payloadJson: {
              actionId: action.id,
              txIndex: body.txIndex,
              txHash: body.txHash,
              executor,
            } as Prisma.InputJsonValue,
          },
        });
      });

      await recalculateProposalProgress(proposalId);
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