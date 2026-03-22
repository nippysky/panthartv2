import "server-only";

import prisma, { prismaReady } from "@/src/lib/db";

type ProposalStatus =
  | "DRAFT"
  | "READY"
  | "SUBMITTED"
  | "APPROVED"
  | "EXECUTED"
  | "CANCELLED"
  | "FAILED";

type ActionStatus = "PENDING" | "SUBMITTED" | "EXECUTED" | "FAILED";

type TxStatus =
  | "SUBMITTED"
  | "APPROVED"
  | "EXECUTED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getStoredLinks(metadataJson: unknown) {
  if (!isPlainObject(metadataJson)) return {} as Record<string, StoredMultisigLink>;
  const raw = metadataJson.multisigLinks;
  if (!isPlainObject(raw)) return {} as Record<string, StoredMultisigLink>;
  return raw as Record<string, StoredMultisigLink>;
}

function deriveProgressCounts(params: {
  proposalStatus: ProposalStatus;
  actions: Array<{
    id: string;
    status: ActionStatus;
  }>;
  metadataJson: unknown;
  txStatusById: Map<string, TxStatus>;
}) {
  const links = getStoredLinks(params.metadataJson);

  let submittedActionCount = 0;
  let approvedActionCount = 0;
  let executedActionCount = 0;
  let failedActionCount = 0;

  for (const action of params.actions) {
    const link = links[action.id];
    const txStatus = link?.txId ? params.txStatusById.get(link.txId) ?? null : null;

    const isSubmitted =
      !!link?.txId ||
      link?.txIndex !== null && link?.txIndex !== undefined ||
      !!link?.txHash ||
      !!link?.submittedAt ||
      action.status === "SUBMITTED" ||
      action.status === "EXECUTED" ||
      txStatus === "SUBMITTED" ||
      txStatus === "APPROVED" ||
      txStatus === "EXECUTED";

    const isApproved =
      txStatus === "APPROVED" ||
      txStatus === "EXECUTED" ||
      link?.status === "APPROVED" ||
      link?.status === "EXECUTED" ||
      !!link?.confirmedAt;

    const isExecuted =
      action.status === "EXECUTED" ||
      txStatus === "EXECUTED" ||
      link?.status === "EXECUTED" ||
      !!link?.executedAt ||
      !!link?.executedTxHash;

    const isFailed =
      action.status === "FAILED" ||
      txStatus === "FAILED" ||
      txStatus === "CANCELLED" ||
      txStatus === "EXPIRED" ||
      link?.status === "FAILED";

    if (isSubmitted) submittedActionCount += 1;
    if (isApproved) approvedActionCount += 1;
    if (isExecuted) executedActionCount += 1;
    if (isFailed) failedActionCount += 1;
  }

  if (params.proposalStatus === "APPROVED" && approvedActionCount === 0 && params.actions.length > 0) {
    approvedActionCount = submittedActionCount;
  }

  if (params.proposalStatus === "EXECUTED" && executedActionCount === 0 && params.actions.length > 0) {
    executedActionCount = params.actions.length;
    approvedActionCount = Math.max(approvedActionCount, params.actions.length);
    submittedActionCount = Math.max(submittedActionCount, params.actions.length);
  }

  if (params.proposalStatus === "SUBMITTED" && submittedActionCount === 0 && params.actions.length > 0) {
    submittedActionCount = 1;
  }

  return {
    submittedActionCount,
    approvedActionCount,
    executedActionCount,
    failedActionCount,
  };
}

async function getTxStatusMapForProposal(metadataJson: unknown) {
  const links = getStoredLinks(metadataJson);
  const txIds = Object.values(links)
    .map((item) => item.txId)
    .filter((value): value is string => !!value);

  if (txIds.length === 0) {
    return new Map<string, TxStatus>();
  }

  const txs = await prisma.multisigTx.findMany({
    where: { id: { in: txIds } },
    select: {
      id: true,
      status: true,
    },
  });

  return new Map(txs.map((tx) => [tx.id, tx.status as TxStatus]));
}

function normalizeValue(value: unknown): unknown {
  if (value == null) return value;

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (typeof value === "object") {
    const maybeDecimal = value as { toString?: () => string };
    if (
      maybeDecimal &&
      typeof maybeDecimal.toString === "function" &&
      value.constructor &&
      value.constructor.name === "Decimal"
    ) {
      return maybeDecimal.toString();
    }

    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = normalizeValue(entry);
    }
    return result;
  }

  return value;
}

export async function listWarpoolAdminProposals() {
  await prismaReady;

  const proposals = await prisma.adminProposal.findMany({
    where: {
      area: "WARPOOL",
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      safe: {
        select: {
          id: true,
          contract: true,
          name: true,
          threshold: true,
          owners: {
            where: { removedAt: null },
            select: {
              ownerAddress: true,
            },
          },
        },
      },
      submittedMultisigTx: {
        select: {
          id: true,
          nonce: true,
          status: true,
          executedTxHash: true,
          createdAt: true,
          executedAt: true,
          approvals: {
            select: {
              id: true,
            },
          },
        },
      },
      actions: {
        orderBy: [{ orderIndex: "asc" }],
        select: {
          id: true,
          status: true,
          orderIndex: true,
        },
      },
      events: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          type: true,
          note: true,
          createdAt: true,
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

  const items = await Promise.all(
    proposals.map(async (proposal) => {
      const txStatusById = await getTxStatusMapForProposal(proposal.metadataJson);

      const progress = deriveProgressCounts({
        proposalStatus: proposal.status as ProposalStatus,
        actions: proposal.actions.map((action) => ({
          id: action.id,
          status: action.status as ActionStatus,
        })),
        metadataJson: proposal.metadataJson,
        txStatusById,
      });

      return {
        id: proposal.id,
        area: proposal.area,
        kind: proposal.kind,
        title: proposal.title,
        slug: proposal.slug,
        summary: proposal.summary,
        description: proposal.description,
        status: proposal.status,
        safeId: proposal.safeId,
        safeContract: proposal.safeContract,
        chainId: proposal.chainId,
        createdByUserId: proposal.createdByUserId,
        createdByAddress: proposal.createdByAddress,
        lastEditedByUserId: proposal.lastEditedByUserId,
        lastEditedByAddress: proposal.lastEditedByAddress,
        basedOnConfigVersion:
          proposal.basedOnConfigVersion == null
            ? null
            : proposal.basedOnConfigVersion.toString(),
        runtimeReferenceId: proposal.runtimeReferenceId,
        actionCount: proposal.actionCount,
        submittedMultisigTxId: proposal.submittedMultisigTxId,
        submittedMultisigNonce:
          proposal.submittedMultisigNonce == null
            ? null
            : Number(proposal.submittedMultisigNonce),
        submittedAt: proposal.submittedAt,
        approvedAt: proposal.approvedAt,
        executedAt: proposal.executedAt,
        cancelledAt: proposal.cancelledAt,
        failedAt: proposal.failedAt,
        snapshotJson: normalizeValue(proposal.snapshotJson),
        metadataJson: normalizeValue(proposal.metadataJson),
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
        safe: proposal.safe
          ? {
              ...proposal.safe,
              threshold:
                proposal.safe.threshold == null ? null : Number(proposal.safe.threshold),
              ownerAddresses: proposal.safe.owners.map((owner) => owner.ownerAddress),
            }
          : null,
        submittedMultisigTx: proposal.submittedMultisigTx
          ? {
              ...proposal.submittedMultisigTx,
              nonce:
                proposal.submittedMultisigTx.nonce == null
                  ? null
                  : Number(proposal.submittedMultisigTx.nonce),
              approvalsCount: proposal.submittedMultisigTx.approvals.length,
            }
          : null,
        latestEvent: proposal.events[0] ?? null,
        submittedActionCount: progress.submittedActionCount,
        approvedActionCount: progress.approvedActionCount,
        executedActionCount: progress.executedActionCount,
        failedActionCount: progress.failedActionCount,
      };
    })
  );

  return items;
}

export async function getWarpoolAdminProposalForDetailPage(proposalId: string) {
  await prismaReady;

  const proposal = await prisma.adminProposal.findUnique({
    where: { id: proposalId },
    include: {
      safe: {
        select: {
          id: true,
          contract: true,
          name: true,
          threshold: true,
          owners: {
            where: { removedAt: null },
            select: {
              ownerAddress: true,
            },
          },
        },
      },
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
        select: {
          id: true,
          nonce: true,
          status: true,
          executedTxHash: true,
          createdAt: true,
          executedAt: true,
          approvals: {
            select: {
              id: true,
              ownerAddress: true,
              createdAt: true,
            },
          },
        },
      },
      actions: {
        orderBy: [{ orderIndex: "asc" }],
      },
      events: {
        orderBy: [{ createdAt: "desc" }],
        include: {
          actorUser: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
            },
          },
        },
      },
    },
  });

  if (!proposal) return null;

  const txStatusById = await getTxStatusMapForProposal(proposal.metadataJson);

  const progress = deriveProgressCounts({
    proposalStatus: proposal.status as ProposalStatus,
    actions: proposal.actions.map((action) => ({
      id: action.id,
      status: action.status as ActionStatus,
    })),
    metadataJson: proposal.metadataJson,
    txStatusById,
  });

  return {
    ...proposal,
    basedOnConfigVersion:
      proposal.basedOnConfigVersion == null
        ? null
        : proposal.basedOnConfigVersion.toString(),
    submittedMultisigNonce:
      proposal.submittedMultisigNonce == null
        ? null
        : Number(proposal.submittedMultisigNonce),
    snapshotJson: normalizeValue(proposal.snapshotJson),
    metadataJson: normalizeValue(proposal.metadataJson),
    safe: proposal.safe
      ? {
          ...proposal.safe,
          threshold: proposal.safe.threshold == null ? null : Number(proposal.safe.threshold),
          ownerAddresses: proposal.safe.owners.map((owner) => owner.ownerAddress),
        }
      : null,
    submittedMultisigTx: proposal.submittedMultisigTx
      ? {
          ...proposal.submittedMultisigTx,
          nonce:
            proposal.submittedMultisigTx.nonce == null
              ? null
              : Number(proposal.submittedMultisigTx.nonce),
          approvals: proposal.submittedMultisigTx.approvals.map((approval) => ({
            ...approval,
          })),
        }
      : null,
    actions: proposal.actions.map((action) => ({
      ...action,
      valueWei: action.valueWei.toString(),
      argsJson: normalizeValue(action.argsJson),
    })),
    events: proposal.events.map((event) => ({
      ...event,
      payloadJson: normalizeValue(event.payloadJson),
    })),
    submittedActionCount: progress.submittedActionCount,
    approvedActionCount: progress.approvedActionCount,
    executedActionCount: progress.executedActionCount,
    failedActionCount: progress.failedActionCount,
  };
}