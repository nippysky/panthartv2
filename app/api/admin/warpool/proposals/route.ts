// app/api/admin/warpool/proposals/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/src/lib/generated/prisma/client";
import prisma, { prismaReady } from "@/src/lib/db";
import {
  ensureAllowedWarpoolAdminRequest,
  normalizeAdminAddress,
} from "@/src/features/admin/warpool/admin-access";

type CreateProposalBody = {
  area?: "WARPOOL";
  kind?: "CONFIG" | "RECOVERY";
  title?: string;
  slug?: string | null;
  summary?: string | null;
  description?: string | null;
  status?: "DRAFT" | "READY";
  safeContract?: string | null;
  chainId?: number | null;
  basedOnConfigVersion?: string | number | bigint | null;
  runtimeReferenceId?: string | null;
  snapshotJson?: unknown;
  metadataJson?: unknown;
  createdByAddress?: string | null;
  actions?: Array<{
    orderIndex?: number;
    label?: string | null;
    summary?: string | null;
    target: string;
    valueWei?: string | number | bigint | null;
    tokenAddress?: string | null;
    dataHex: string;
    functionName?: string | null;
    argsJson?: unknown;
  }>;
};

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      typeof currentValue === "bigint" ? currentValue.toString() : currentValue
    )
  ) as T;
}

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeChainId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeBigIntValue(value: unknown): bigint | null {
  if (value == null || value === "") return null;

  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      return BigInt(Math.trunc(value));
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      return BigInt(trimmed);
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeValueWei(value: unknown): Prisma.Decimal {
  if (value == null || value === "") return new Prisma.Decimal("0");

  try {
    if (typeof value === "bigint") return new Prisma.Decimal(value.toString());
    if (typeof value === "number") return new Prisma.Decimal(String(Math.trunc(value)));
    if (typeof value === "string") return new Prisma.Decimal(value.trim() || "0");
  } catch {
    return new Prisma.Decimal("0");
  }

  return new Prisma.Decimal("0");
}

function toPrismaJsonValue(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value == null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

async function findSafeByContract(contract: string | null) {
  if (!contract) return null;

  return prisma.multisigSafe.findUnique({
    where: { contract },
    select: {
      id: true,
      contract: true,
      threshold: true,
      owners: {
        where: { removedAt: null },
        select: { ownerAddress: true },
        orderBy: { ownerAddress: "asc" },
      },
    },
  });
}

async function findUserIdByAddress(address: string | null) {
  if (!address) return null;

  const user = await prisma.user.findUnique({
    where: { walletAddress: address },
    select: { id: true },
  });

  return user?.id ?? null;
}

function buildProposalWhere(searchParams: URLSearchParams): Prisma.AdminProposalWhereInput {
  const where: Prisma.AdminProposalWhereInput = {
    area: "WARPOOL",
  };

  const status = searchParams.get("status");
  if (
    status === "DRAFT" ||
    status === "READY" ||
    status === "SUBMITTED" ||
    status === "APPROVED" ||
    status === "EXECUTED" ||
    status === "CANCELLED" ||
    status === "FAILED"
  ) {
    where.status = status;
  }

  const kind = searchParams.get("kind");
  if (kind === "CONFIG" || kind === "RECOVERY") {
    where.kind = kind;
  }

  const safeContract = normalizeAddress(searchParams.get("safeContract"));
  if (safeContract) {
    where.safeContract = safeContract;
  }

  const createdByAddress = normalizeAdminAddress(searchParams.get("createdByAddress"));
  if (createdByAddress) {
    where.createdByAddress = createdByAddress;
  }

  return where;
}

export async function GET(req: NextRequest) {
  try {
    await prismaReady;

    const access = ensureAllowedWarpoolAdminRequest(req);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const latestDraft = searchParams.get("latestDraft") === "1";
    const where = buildProposalWhere(searchParams);

    if (latestDraft) {
      const proposal = await prisma.adminProposal.findFirst({
        where: {
          ...where,
          status: "DRAFT",
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: {
          actions: {
            orderBy: { orderIndex: "asc" },
          },
          events: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
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

      return NextResponse.json({
        ok: true,
        proposal: proposal ? toJsonSafe(proposal) : null,
      });
    }

    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "24")));
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.adminProposal.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          actions: {
            orderBy: { orderIndex: "asc" },
          },
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
      }),
      prisma.adminProposal.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      items: toJsonSafe(items),
      page,
      pageSize,
      total,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load proposals.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await prismaReady;

    const access = ensureAllowedWarpoolAdminRequest(req);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const body = (await req.json()) as CreateProposalBody;

    const title = normalizeRequiredText(body.title, "title");
    const area = body.area === "WARPOOL" ? body.area : "WARPOOL";
    const kind = body.kind === "RECOVERY" ? "RECOVERY" : "CONFIG";
    const proposalStatus =
      body.status === "READY" || body.status === "DRAFT" ? body.status : "DRAFT";

    const safeContract = normalizeAddress(body.safeContract);
    const safe = await findSafeByContract(safeContract);

    if (safeContract && !safe) {
      return NextResponse.json(
        { ok: false, error: "Referenced multisig safe was not found." },
        { status: 400 }
      );
    }

    const createdByAddress = normalizeAdminAddress(
      typeof body.createdByAddress === "string"
        ? body.createdByAddress
        : access.address
    );

    const createdByUserId = await findUserIdByAddress(createdByAddress);

    const actionsInput = Array.isArray(body.actions) ? body.actions : [];
    const actions = actionsInput
      .map((action, index) => {
        const target = normalizeRequiredText(action.target, `actions[${index}].target`);
        const dataHex = normalizeRequiredText(action.dataHex, `actions[${index}].dataHex`);

        return {
          orderIndex:
            typeof action.orderIndex === "number" && Number.isFinite(action.orderIndex)
              ? action.orderIndex
              : index,
          label: normalizeNullableText(action.label),
          summary: normalizeNullableText(action.summary),
          target,
          valueWei: normalizeValueWei(action.valueWei),
          tokenAddress: normalizeAddress(action.tokenAddress),
          dataHex,
          functionName: normalizeNullableText(action.functionName),
          argsJson: toPrismaJsonValue(action.argsJson),
        };
      })
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((action, index) => ({
        ...action,
        orderIndex: index,
      }));

    if (proposalStatus === "READY" && actions.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "At least one proposal action is required before marking ready.",
        },
        { status: 400 }
      );
    }

    const snapshotJson = toPrismaJsonValue(body.snapshotJson);
    const metadataJson = toPrismaJsonValue(body.metadataJson);

    const proposal = await prisma.adminProposal.create({
      data: {
        area,
        kind,
        title,
        slug: normalizeNullableText(body.slug),
        summary: normalizeNullableText(body.summary),
        description: normalizeNullableText(body.description),
        safeId: safe?.id ?? null,
        safeContract: safe?.contract ?? safeContract,
        chainId: normalizeChainId(body.chainId),
        createdByUserId,
        createdByAddress,
        lastEditedByUserId: createdByUserId,
        lastEditedByAddress: createdByAddress,
        basedOnConfigVersion: normalizeBigIntValue(body.basedOnConfigVersion),
        runtimeReferenceId: normalizeNullableText(body.runtimeReferenceId),
        status: proposalStatus,
        actionCount: actions.length,
        snapshotJson,
        metadataJson,
        actions:
          actions.length > 0
            ? {
                create: actions.map((action) => ({
                  orderIndex: action.orderIndex,
                  label: action.label,
                  summary: action.summary,
                  target: action.target,
                  valueWei: action.valueWei,
                  tokenAddress: action.tokenAddress,
                  dataHex: action.dataHex,
                  functionName: action.functionName,
                  argsJson: action.argsJson,
                  status: "PENDING" as const,
                })),
              }
            : undefined,
        events: {
          create: {
            actorUserId: createdByUserId,
            actorAddress: createdByAddress,
            type: proposalStatus === "READY" ? "PROPOSAL_READY" : "PROPOSAL_DRAFT_SAVED",
            note:
              proposalStatus === "READY"
                ? "Proposal saved and marked ready."
                : "Proposal saved as draft.",
            payloadJson: {
              actionCount: actions.length,
              safeContract: safe?.contract ?? safeContract ?? null,
              chainId: normalizeChainId(body.chainId),
            } as Prisma.InputJsonValue,
          },
        },
      },
      include: {
        actions: {
          orderBy: { orderIndex: "asc" },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
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

    const safeProposal = toJsonSafe(proposal);

    return NextResponse.json({
      ok: true,
      proposal: { id: proposal.id },
      item: safeProposal,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create proposal.",
      },
      { status: 500 }
    );
  }
}