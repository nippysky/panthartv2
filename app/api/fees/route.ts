// app/api/fees/route.ts
// Runtime: Node.js (Edge not required; we use Prisma + ethers)
// Dynamic: force dynamic so DB/env changes are reflected immediately

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma, { prismaReady } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { ContractType, MetadataOption } from "@/lib/generated/prisma";
import { ethers } from "ethers";

/**
 * Convert any numeric-ish value to a plain base-10 integer string for WEI.
 * - Never returns scientific notation.
 * - Truncates fractional part if present.
 * - Returns "0" for values < 1 wei (e.g., 1e-3).
 */
function toPlainWeiString(x: any): string {
  if (x == null) return "";
  // Prisma Decimal: prefer .toFixed(0) to avoid scientific notation
  const maybeDecimal = x as unknown as { toFixed?: (dp?: number) => string };
  if (maybeDecimal && typeof maybeDecimal.toFixed === "function") {
    return maybeDecimal.toFixed(0);
  }

  const s = String(x).trim();
  if (!s) return "";

  // Already a plain integer?
  if (/^[+-]?\d+$/.test(s)) return s.replace(/^\+/, "");

  // Has decimal point (no exponent)? Drop fractional part (wei must be integer)
  if (/^[+-]?\d+\.\d+$/.test(s)) return s.split(".")[0].replace(/^\+/, "");

  // Scientific notation?
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
      return (sign ? "-" : "") + (body.replace(/^0+(?=\d)/, "") || "0");
    } else {
      // Negative exponent -> < 1 wei => treat as 0
      return "0";
    }
  }

  // Fallback: keep only digits and optional leading "-"
  return s.replace(/[^\d-]/g, "");
}

/**
 * Ensure the provided recipient is a "0x..." address (ENS is not supported on ETN).
 * Returns the checksummed address or throws a clear, user-facing error.
 */
function mustChecksumAddress(addr: string | null | undefined): string {
  if (!addr) {
    throw new Error("Fee recipient missing");
  }
  if (!ethers.isAddress(addr)) {
    // Reject ENS or any non-hex value up-front to avoid ethers' ENS resolution path.
    throw new Error("Fee recipient must be a 0x address (ENS not supported).");
  }
  return ethers.getAddress(addr); // checksum-normalize
}

/**
 * Resolve platform fee settings for a given contract type / metadata option.
 * Priority:
 *  1) Database (active FeeConfig, most recent)
 *  2) Legacy ENV exact wei (FEE_*_WEI + FEE_RECIPIENT)
 *  3) USD-centric ENV (FEE_*_USD_CENTS + FALLBACK_PRICE_USD + FEE_RECIPIENT)
 * Throws if nothing is configured.
 */
async function resolveFee(contractType: string, metadataOption: string) {
  // --- map to enums (fail early on invalid values) ---
  let ct: ContractType;
  switch (contractType) {
    case "ERC721_DROP":
      ct = ContractType.ERC721_DROP;
      break;
    case "ERC721_SINGLE":
      ct = ContractType.ERC721_SINGLE;
      break;
    case "ERC1155_SINGLE":
      ct = ContractType.ERC1155_SINGLE;
      break;
    default:
      throw new Error("Invalid contractType");
  }

  let mo: MetadataOption;
  switch (metadataOption) {
    case "UPLOAD":
      mo = MetadataOption.UPLOAD;
      break;
    case "EXTERNAL":
      mo = MetadataOption.EXTERNAL;
      break;
    default:
      throw new Error("Invalid metadataOption");
  }

  // --- 1) Database config takes priority ---
  const cfg = await prisma.feeConfig.findFirst({
    where: { contractType: ct, metadataOption: mo, active: true },
    orderBy: { updatedAt: "desc" },
  });

  if (cfg) {
    return {
      feeRecipient: mustChecksumAddress(cfg.feeRecipient),
      feeAmountEtnWei: toPlainWeiString(cfg.feeAmountEtnWei),
      targetUsdCents: cfg.targetUsdCents ?? undefined,
      lastPriceUsd: cfg.lastPriceUsd ?? undefined,
      lastPriceAt: cfg.lastPriceAt ?? undefined,
      pricingSource: cfg.pricingSource ?? undefined,
      pricingPair: cfg.pricingPair ?? undefined,
    };
  }

  // --- 2) Legacy ENV: exact WEI path ---
  const envRecipient = process.env.FEE_RECIPIENT;
  const envWei =
    ct === ContractType.ERC721_DROP && mo === MetadataOption.EXTERNAL
      ? process.env.FEE_ERC721_DROP_EXTERNAL_WEI
      : ct === ContractType.ERC721_DROP && mo === MetadataOption.UPLOAD
      ? process.env.FEE_ERC721_DROP_UPLOAD_WEI
      : ct === ContractType.ERC721_SINGLE
      ? process.env.FEE_ERC721_SINGLE_WEI
      : ct === ContractType.ERC1155_SINGLE
      ? process.env.FEE_ERC1155_SINGLE_WEI
      : undefined;

  if (envRecipient && envWei) {
    return {
      feeRecipient: mustChecksumAddress(envRecipient),
      feeAmountEtnWei: toPlainWeiString(envWei),
    };
  }

  // --- 3) USD-centric ENV: convert cents -> wei using a fallback USD price ---
  const usdCentsStr =
    ct === ContractType.ERC721_DROP && mo === MetadataOption.EXTERNAL
      ? process.env.FEE_ERC721_DROP_EXTERNAL_USD_CENTS
      : ct === ContractType.ERC721_DROP && mo === MetadataOption.UPLOAD
      ? process.env.FEE_ERC721_DROP_UPLOAD_USD_CENTS
      : ct === ContractType.ERC721_SINGLE
      ? process.env.FEE_ERC721_SINGLE_USD_CENTS
      : ct === ContractType.ERC1155_SINGLE
      ? process.env.FEE_ERC1155_SINGLE_USD_CENTS
      : undefined;

  const fallbackPriceUsd = process.env.FALLBACK_PRICE_USD; // e.g. "0.00325"
  const recipient2 = process.env.FEE_RECIPIENT;

  if (usdCentsStr && recipient2 && fallbackPriceUsd && Number(fallbackPriceUsd) > 0) {
    const targetUsdCents = parseInt(usdCentsStr, 10);

    // Scale USD price to 1e8 to reduce float error: priceScaled = round(USD * 1e8)
    const priceScaled = BigInt(Math.round(Number(fallbackPriceUsd) * 1e8));

    // Convert cents to same 1e8 scale
    const usdScaled = BigInt(targetUsdCents) * 1_000_000n; // cents -> 1e8 scale

    // feeWei = (usdScaled / priceScaled) * 1e18   (ceil division to avoid underpayment)
    const numerator = usdScaled * 1_000_000_000_000_000_000n; // *1e18
    const feeWei = ((numerator + (priceScaled - 1n)) / priceScaled).toString();

    return {
      feeRecipient: mustChecksumAddress(recipient2),
      feeAmountEtnWei: toPlainWeiString(feeWei),
      targetUsdCents,
      lastPriceUsd: fallbackPriceUsd,
      pricingSource: "FALLBACK_ENV",
      pricingPair: "ETNUSD",
    };
  }

  // Nothing configured
  throw new Error("FeeConfig not set");
}

/**
 * POST /api/fees
 * Body: { contractType: "ERC721_DROP" | "ERC721_SINGLE" | "ERC1155_SINGLE", metadataOption: "UPLOAD" | "EXTERNAL" }
 * Returns: { feeRecipient, feeAmountEtnWei, ...optional pricing fields }
 */
export async function POST(req: NextRequest) {
  await prismaReady;
  try {
    const body = (await req.json()) as {
      contractType?: string;
      metadataOption?: string;
    };

    if (!body?.contractType || !body?.metadataOption) {
      return NextResponse.json(
        { error: "Missing contractType/metadataOption" },
        { status: 400 }
      );
    }

    const payload = await resolveFee(body.contractType, body.metadataOption);
    return NextResponse.json(payload);
  } catch (e: any) {
    const msg = e?.message || "Internal error";
    // Use 404 when config is simply not set; 400 for validation-ish messages; otherwise 500.
    const code =
      msg.includes("not set") ? 404 :
      msg.includes("must be a 0x address") || msg.includes("Invalid") ? 400 :
      500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

/**
 * GET /api/fees?contractType=...&metadataOption=...
 * Handy for quick testing in the browser or curl.
 */
export async function GET(req: NextRequest) {
  await prismaReady;
  try {
    const url = new URL(req.url);
    const ct = url.searchParams.get("contractType") || "";
    const mo = url.searchParams.get("metadataOption") || "";

    if (!ct || !mo) {
      return NextResponse.json(
        { error: "Missing contractType/metadataOption" },
        { status: 400 }
      );
    }

    const payload = await resolveFee(ct, mo);
    return NextResponse.json(payload);
  } catch (e: any) {
    const msg = e?.message || "Internal error";
    const code =
      msg.includes("not set") ? 404 :
      msg.includes("must be a 0x address") || msg.includes("Invalid") ? 400 :
      500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
