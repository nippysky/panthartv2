// app/api/admin/warpool/proposals/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/src/lib/generated/prisma/client";
import prisma, { prismaReady } from "@/src/lib/db";
import { ethers } from "ethers";

type CreateProposalBody = {
  title?: string;
  summary?: string | null;
  description?: string | null;
  safeContract?: string | null;
  chainId?: number | null;
  basedOnConfigVersion?: string | number | null;
  snapshotJson?: unknown;
  metadataJson?: unknown;
  createdByAddress?: string | null;
  actions?: Array<{
    label?: string | null;
    summary?: string | null;
    target: string;
    valueWei?: string | number | null;
    tokenAddress?: string | null;
    dataHex: string;
    functionName?: string | null;
    argsJson?: unknown;
  }>;
};

function normalizeAddress(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeBigIntOrNull(value: unknown): bigint | null {
  if (value == null || value === "") return null;
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

function normalizeValueWei(value: unknown) {
  if (value == null || value === "") return "0";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "0";
}

function buildSlugFromTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function GET() {
  await prismaReady;

  const proposals = await prisma.adminProposal.findMany({
    where: {
      area: "WARPOOL",
    },
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
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    ok: true,
    items: proposals,
  });
}

export async function POST(req: NextRequest) {
  await prismaReady;

  let body: CreateProposalBody;
  try {
    body = (await req.json()) as CreateProposalBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { ok: false, error: "Proposal title is required." },
      { status: 400 }
    );
  }

  const actions = Array.isArray(body.actions) ? body.actions : [];
  if (actions.length === 0) {
    return NextResponse.json(
      { ok: false, error: "At least one proposal action is required." },
      { status: 400 }
    );
  }

  for (const [index, action] of actions.entries()) {
    if (!action?.target || !ethers.isAddress(action.target)) {
      return NextResponse.json(
        { ok: false, error: `Action ${index + 1} has an invalid target address.` },
        { status: 400 }
      );
    }

    if (typeof action.dataHex !== "string" || !action.dataHex.startsWith("0x")) {
      return NextResponse.json(
        { ok: false, error: `Action ${index + 1} has invalid dataHex.` },
        { status: 400 }
      );
    }
  }

  const safeContract = normalizeAddress(body.safeContract);
  const createdByAddress = normalizeAddress(body.createdByAddress);

  const safe = safeContract
    ? await prisma.multisigSafe.findUnique({
        where: { contract: safeContract },
        select: { id: true, contract: true },
      })
    : null;

  const createdByUser = createdByAddress
    ? await prisma.user.findUnique({
        where: { walletAddress: createdByAddress },
        select: { id: true },
      })
    : null;

  const slugBase = buildSlugFromTitle(title) || "warpool-proposal";

  const proposal = await prisma.$transaction(async (tx) => {
    return tx.adminProposal.create({
      data: {
        area: "WARPOOL",
        kind: "CONFIG",
        title,
        slug: slugBase,
        summary: normalizeNullableText(body.summary),
        description: normalizeNullableText(body.description),
        safeId: safe?.id ?? null,
        safeContract: safe?.contract ?? safeContract,
        chainId:
          typeof body.chainId === "number" && Number.isFinite(body.chainId)
            ? body.chainId
            : null,
        createdByUserId: createdByUser?.id ?? null,
        createdByAddress,
        lastEditedByUserId: createdByUser?.id ?? null,
        lastEditedByAddress: createdByAddress,
        basedOnConfigVersion: normalizeBigIntOrNull(body.basedOnConfigVersion),
        status: "READY",
        actionCount: actions.length,
        snapshotJson: toPrismaJsonValue(body.snapshotJson),
        metadataJson: toPrismaJsonValue(body.metadataJson),
        actions: {
          create: actions.map((action, index) => ({
            orderIndex: index,
            label: normalizeNullableText(action.label),
            summary: normalizeNullableText(action.summary),
            target: action.target,
            valueWei: normalizeValueWei(action.valueWei),
            tokenAddress: normalizeAddress(action.tokenAddress),
            dataHex: action.dataHex,
            functionName: normalizeNullableText(action.functionName),
            argsJson: toPrismaJsonValue(action.argsJson),
            status: "PENDING" as const,
          })),
        },
        events: {
          create: {
            actorUserId: createdByUser?.id ?? null,
            actorAddress: createdByAddress,
            type: "PROPOSAL_CREATED",
            note: "Warpool config proposal created from admin composer.",
            payloadJson: {
              actionCount: actions.length,
              createdAt: new Date().toISOString(),
            } satisfies Prisma.InputJsonValue,
          },
        },
      },
      include: {
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
  });

  return NextResponse.json({
    ok: true,
    item: proposal,
  });
}