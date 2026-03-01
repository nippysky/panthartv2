/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { SubmissionStatus, ContractType, MetadataOption } from "@/src/lib/generated/prisma";
import { JsonRpcProvider, ethers } from "ethers";

/** ---------------- chain config ---------------- */
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || 52014);
const RPC_URL =
  process.env.RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://rpc.ankr.com/electroneum";

const PAYMENT_MAX_AGE_MIN = Number(process.env.FEE_TX_MAX_AGE_MIN || 60);
const provider = new JsonRpcProvider(RPC_URL);

/** ---------------- helpers ---------------- */
function toLower(s?: string | null) {
  return (s || "").toLowerCase();
}

/** Expand scientific-notation into a plain integer decimal string */
function toPlainIntegerString(x?: unknown): string {
  if (x === null || x === undefined) return "";
  const s = String(x).trim();
  if (!s) return "";
  if (/^[+-]?\d+$/.test(s)) return s.replace(/^\+/, "");
  if (/^[+-]?\d+\.\d+$/.test(s)) return s.split(".")[0].replace(/^\+/, "");

  const m = s.match(/^([+-]?\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (m) {
    const sign = m[1].startsWith("-") ? "-" : "";
    const intPart = m[1].replace(/^[+-]/, "");
    const frac = m[2] || "";
    const exp = parseInt(m[3], 10);

    if (exp >= 0) {
      const digits = intPart + frac;
      const zeros = exp - frac.length;
      const body = zeros >= 0 ? digits + "0".repeat(zeros) : digits.slice(0, digits.length + zeros);
      const cleaned = (body.replace(/^0+(?=\d)/, "") || "0");
      return (sign ? "-" : "") + cleaned;
    }
    return "0";
  }

  return s.replace(/[^\d-]/g, "");
}

function toBigIntSafe(x: unknown): bigint {
  const plain = toPlainIntegerString(x);
  if (!plain || !/^-?\d+$/.test(plain)) throw new Error(`Invalid integer: ${x as any}`);
  return BigInt(plain);
}

/** DB-first fee lookup, ENV fallback (must match /fee route behavior) */
async function getCurrentFee() {
  const cfg = await prisma.feeConfig.findFirst({
    where: {
      contractType: ContractType.ERC721_DROP,
      metadataOption: MetadataOption.EXTERNAL,
      active: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (cfg) {
    return {
      feeRecipient: cfg.feeRecipient,
      feeAmountWei: toBigIntSafe(cfg.feeAmountEtnWei?.toString()),
    };
  }

  const feeRecipient = process.env.FEE_RECIPIENT || "";
  const feeAmountStr = process.env.FEE_ERC721_DROP_EXTERNAL_WEI || "";
  if (!feeRecipient || !feeAmountStr) throw new Error("FeeConfig not set");

  return {
    feeRecipient,
    feeAmountWei: toBigIntSafe(feeAmountStr),
  };
}

/** verify payment tx on-chain */
async function verifyPayment({ txHash, submitter }: { txHash: string; submitter: string }) {
  const { feeRecipient, feeAmountWei } = await getCurrentFee();

  // guard: tx not previously used
  const used = await prisma.collectionSubmission.findFirst({
    where: { feeTxHash: txHash },
    select: { id: true },
  });
  if (used) throw new Error("Payment hash already used.");

  // network sanity
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN_ID) throw new Error("Wrong chain.");

  const tx = await provider.getTransaction(txHash);
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!tx || !receipt) throw new Error("Transaction not found.");
  if (receipt.status !== 1) throw new Error("Payment tx failed on-chain.");

  // from/to/value checks
  if (toLower(tx.from) !== toLower(submitter)) throw new Error("Payment not sent by connected wallet.");
  if (!tx.to) throw new Error("Payment recipient missing.");
  if (toLower(tx.to) !== toLower(feeRecipient)) throw new Error("Payment recipient mismatch.");

  const paid = toBigIntSafe((tx as any).value ?? 0);
  if (paid < feeAmountWei) throw new Error("Payment amount too low.");

  // freshness
  if (receipt.blockNumber) {
    const blk = await provider.getBlock(receipt.blockNumber);
    if (blk?.timestamp) {
      const ageSec = Math.max(0, Date.now() / 1000 - Number(blk.timestamp));
      const maxSec = PAYMENT_MAX_AGE_MIN * 60;
      if (ageSec > maxSec) throw new Error("Payment too old. Please pay again.");
    }
  }

  return { paidWei: paid, verifiedAt: new Date() };
}

/** Ensure placeholder User rows exist (same behavior as your current route) */
function ensureUserPlaceholder(checksum: string) {
  const addr = ethers.getAddress(checksum);
  return prisma.user.upsert({
    where: { walletAddress: addr },
    update: {},
    create: {
      walletAddress: addr,
      username: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
      profileAvatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${addr}`,
      profileBanner:
        "https://res.cloudinary.com/dx1bqxtys/image/upload/v1750638432/panthart/amy5m5u7nxmhlh8brv6d.png",
    },
  });
}

/**
 * POST /api/collections/submission
 * Body:
 *  - Required: contract, standard(ERC721), name, symbol, supply(number >=0),
 *              ownerAddress, baseUri, logoUrl, coverUrl, submitterAddress, feeTxHash
 *  - Optional: description, website, x, instagram, telegram
 *
 * Uniqueness:
 *  - One row per contract.
 */
export async function POST(req: NextRequest) {
  await prismaReady;

  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const {
      contract,
      standard,
      name,
      symbol,
      supply,
      ownerAddress,
      baseUri,
      logoUrl,
      coverUrl,

      description,
      website,
      x,
      instagram,
      telegram,

      submitterAddress,
      feeTxHash,
    } = body as {
      contract?: string;
      standard?: string;
      name?: string;
      symbol?: string;
      supply?: number;
      ownerAddress?: string;
      baseUri?: string;
      logoUrl?: string;
      coverUrl?: string;

      description?: string | null;
      website?: string | null;
      x?: string | null;
      instagram?: string | null;
      telegram?: string | null;

      submitterAddress?: string;
      feeTxHash?: string;
    };

    // Presence checks
    if (
      !contract ||
      !name ||
      !symbol ||
      typeof supply !== "number" ||
      supply < 0 ||
      !ownerAddress ||
      !baseUri ||
      !logoUrl ||
      !coverUrl ||
      !submitterAddress ||
      !feeTxHash
    ) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // Only ERC721
    const std = (standard || "").replace("-", "").toUpperCase();
    if (std !== "ERC721") {
      return NextResponse.json({ error: "Only ERC721 collections are supported." }, { status: 400 });
    }

    // Unique by contract
    const existing = await prisma.collectionSubmission.findUnique({
      where: { contract },
      select: { id: true, status: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A submission for this contract already exists (status: ${existing.status}).`, submissionId: existing.id },
        { status: 409 }
      );
    }

    // Verify payment
    const payment = await verifyPayment({ txHash: feeTxHash, submitter: submitterAddress });

    // Ensure submitter & owner users exist
    const [submitter, ownerUser] = await Promise.all([
      ensureUserPlaceholder(submitterAddress),
      ensureUserPlaceholder(ownerAddress),
    ]);

    const created = await prisma.collectionSubmission.create({
      data: {
        contract,
        name,
        symbol,
        description: description || null,
        logoUrl,
        coverUrl,
        website: website || null,
        x: x || null,
        instagram: instagram || null,
        telegram: telegram || null,

        supply,
        baseUri,
        ownerAddress,

        submittedByUserId: submitter.id,
        ownershipVerified: submitter.walletAddress === ownerUser.walletAddress,
        status: SubmissionStatus.PENDING,

        feeTxHash,
        feePaidWei: payment.paidWei.toString(),
        feeVerifiedAt: payment.verifiedAt,
      },
      select: {
        id: true,
        contract: true,
        name: true,
        symbol: true,
        ownerAddress: true,
        status: true,
        submittedByUserId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
