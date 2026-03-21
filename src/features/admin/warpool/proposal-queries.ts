// src/features/admin/warpool/proposal-queries.ts
import "server-only";

import { Prisma } from "@/src/lib/generated/prisma/client";
import prisma, { prismaReady } from "@/src/lib/db";
import type {
  AdminProposalActionItem,
  AdminProposalDetail,
  AdminProposalEventItem,
  AdminProposalListItem,
  AdminProposalStats,
} from "@/src/features/admin/warpool/types";

const proposalListInclude = Prisma.validator<Prisma.AdminProposalDefaultArgs>()({
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
      select: {
        id: true,
        nonce: true,
        to: true,
        status: true,
        executedTxHash: true,
        createdAt: true,
        executedAt: true,
      },
    },
    _count: {
      select: {
        actions: true,
        events: true,
      },
    },
  },
});

const proposalDetailInclude = Prisma.validator<Prisma.AdminProposalDefaultArgs>()({
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
      select: {
        id: true,
        nonce: true,
        to: true,
        valueWei: true,
        dataHex: true,
        status: true,
        executedTxHash: true,
        createdAt: true,
        executedAt: true,
        approvals: {
          select: {
            id: true,
            ownerAddress: true,
            signature: true,
            createdAt: true,
          },
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

type ProposalListRow = Prisma.AdminProposalGetPayload<typeof proposalListInclude>;
type ProposalDetailRow = Prisma.AdminProposalGetPayload<typeof proposalDetailInclude>;
type ProposalActionRow = ProposalDetailRow["actions"][number];
type ProposalEventRow = ProposalDetailRow["events"][number];

function toValueWeiString(value: unknown) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (
    value &&
    typeof value === "object" &&
    "toString" in value &&
    typeof (value as { toString: () => string }).toString === "function"
  ) {
    return (value as { toString: () => string }).toString();
  }
  return "0";
}

function mapProposalListItem(row: ProposalListRow): AdminProposalListItem {
  return {
    id: row.id,
    area: row.area,
    kind: row.kind,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    safeId: row.safeId,
    safeContract: row.safeContract,
    chainId: row.chainId,
    createdByUserId: row.createdByUserId,
    createdByAddress: row.createdByAddress,
    lastEditedByUserId: row.lastEditedByUserId,
    lastEditedByAddress: row.lastEditedByAddress,
    basedOnConfigVersion: row.basedOnConfigVersion,
    runtimeReferenceId: row.runtimeReferenceId,
    status: row.status,
    actionCount: row.actionCount,
    submittedMultisigTxId: row.submittedMultisigTxId,
    submittedMultisigNonce: row.submittedMultisigNonce,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    executedAt: row.executedAt,
    cancelledAt: row.cancelledAt,
    failedAt: row.failedAt,
    snapshotJson: row.snapshotJson,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    safe: row.safe
      ? {
          id: row.safe.id,
          contract: row.safe.contract,
          name: row.safe.name,
          threshold: row.safe.threshold,
        }
      : null,
    submittedMultisigTx: row.submittedMultisigTx
      ? {
          id: row.submittedMultisigTx.id,
          nonce: row.submittedMultisigTx.nonce,
          to: row.submittedMultisigTx.to,
          status: row.submittedMultisigTx.status,
          executedTxHash: row.submittedMultisigTx.executedTxHash,
          createdAt: row.submittedMultisigTx.createdAt,
          executedAt: row.submittedMultisigTx.executedAt,
        }
      : null,
    _count: {
      actions: row._count.actions,
      events: row._count.events,
    },
  };
}

function mapProposalActionItem(row: ProposalActionRow): AdminProposalActionItem {
  return {
    id: row.id,
    proposalId: row.proposalId,
    orderIndex: row.orderIndex,
    label: row.label,
    summary: row.summary,
    target: row.target,
    valueWei: toValueWeiString(row.valueWei),
    tokenAddress: row.tokenAddress,
    dataHex: row.dataHex,
    functionName: row.functionName,
    argsJson: row.argsJson,
    status: row.status,
    submittedAt: row.submittedAt,
    executedAt: row.executedAt,
    failedAt: row.failedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapProposalEventItem(row: ProposalEventRow): AdminProposalEventItem {
  return {
    id: row.id,
    proposalId: row.proposalId,
    actorUserId: row.actorUserId,
    actorAddress: row.actorAddress,
    type: row.type,
    note: row.note,
    payloadJson: row.payloadJson,
    createdAt: row.createdAt,
    actorUser: row.actorUser
      ? {
          id: row.actorUser.id,
          walletAddress: row.actorUser.walletAddress,
          username: row.actorUser.username,
        }
      : null,
  };
}

export async function getWarpoolProposalStats(): Promise<AdminProposalStats> {
  await prismaReady;

  const [total, draft, ready, submitted, approved, executed, failed, cancelled] =
    await Promise.all([
      prisma.adminProposal.count({ where: { area: "WARPOOL" } }),
      prisma.adminProposal.count({ where: { area: "WARPOOL", status: "DRAFT" } }),
      prisma.adminProposal.count({ where: { area: "WARPOOL", status: "READY" } }),
      prisma.adminProposal.count({ where: { area: "WARPOOL", status: "SUBMITTED" } }),
      prisma.adminProposal.count({ where: { area: "WARPOOL", status: "APPROVED" } }),
      prisma.adminProposal.count({ where: { area: "WARPOOL", status: "EXECUTED" } }),
      prisma.adminProposal.count({ where: { area: "WARPOOL", status: "FAILED" } }),
      prisma.adminProposal.count({ where: { area: "WARPOOL", status: "CANCELLED" } }),
    ]);

  return {
    total,
    draft,
    ready,
    submitted,
    approved,
    executed,
    failed,
    cancelled,
  };
}

export async function getWarpoolProposalList(): Promise<AdminProposalListItem[]> {
  await prismaReady;

  const rows = await prisma.adminProposal.findMany({
    where: {
      area: "WARPOOL",
    },
    ...proposalListInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(mapProposalListItem);
}

export async function getWarpoolProposalById(
  proposalId: string
): Promise<AdminProposalDetail | null> {
  await prismaReady;

  const row = await prisma.adminProposal.findUnique({
    where: { id: proposalId },
    ...proposalDetailInclude,
  });

  if (!row || row.area !== "WARPOOL") return null;

  return {
    id: row.id,
    area: row.area,
    kind: row.kind,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    safeId: row.safeId,
    safeContract: row.safeContract,
    chainId: row.chainId,
    createdByUserId: row.createdByUserId,
    createdByAddress: row.createdByAddress,
    lastEditedByUserId: row.lastEditedByUserId,
    lastEditedByAddress: row.lastEditedByAddress,
    basedOnConfigVersion: row.basedOnConfigVersion,
    runtimeReferenceId: row.runtimeReferenceId,
    status: row.status,
    actionCount: row.actionCount,
    submittedMultisigTxId: row.submittedMultisigTxId,
    submittedMultisigNonce: row.submittedMultisigNonce,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    executedAt: row.executedAt,
    cancelledAt: row.cancelledAt,
    failedAt: row.failedAt,
    snapshotJson: row.snapshotJson,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    safe: row.safe
      ? {
          id: row.safe.id,
          contract: row.safe.contract,
          name: row.safe.name,
          threshold: row.safe.threshold,
        }
      : null,
    createdByUser: row.createdByUser
      ? {
          id: row.createdByUser.id,
          walletAddress: row.createdByUser.walletAddress,
          username: row.createdByUser.username,
        }
      : null,
    lastEditedByUser: row.lastEditedByUser
      ? {
          id: row.lastEditedByUser.id,
          walletAddress: row.lastEditedByUser.walletAddress,
          username: row.lastEditedByUser.username,
        }
      : null,
    submittedMultisigTx: row.submittedMultisigTx
      ? {
          id: row.submittedMultisigTx.id,
          nonce: row.submittedMultisigTx.nonce,
          to: row.submittedMultisigTx.to,
          valueWei: toValueWeiString(row.submittedMultisigTx.valueWei),
          dataHex: row.submittedMultisigTx.dataHex,
          status: row.submittedMultisigTx.status,
          executedTxHash: row.submittedMultisigTx.executedTxHash,
          createdAt: row.submittedMultisigTx.createdAt,
          executedAt: row.submittedMultisigTx.executedAt,
          approvals: row.submittedMultisigTx.approvals.map((approval) => ({
            id: approval.id,
            ownerAddress: approval.ownerAddress,
            signature: approval.signature,
            createdAt: approval.createdAt,
          })),
        }
      : null,
    actions: row.actions.map(mapProposalActionItem),
    events: row.events.map(mapProposalEventItem),
  };
}