/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import prisma, { prismaReady } from "@/src/lib/db";
import { ContractType, MetadataOption } from "@/src/lib/generated/prisma";

function toPlainWeiString(x: any): string {
  if (x == null) return "";
  const maybeDecimal = x as unknown as { toFixed?: (dp?: number) => string };
  if (maybeDecimal && typeof maybeDecimal.toFixed === "function") return maybeDecimal.toFixed(0);

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
      return (sign ? "-" : "") + (body.replace(/^0+(?=\d)/, "") || "0");
    }
    return "0";
  }

  return s.replace(/[^\d-]/g, "");
}

function mustChecksumAddress(addr: string | null | undefined): string {
  if (!addr) throw new Error("Fee recipient missing");
  if (!ethers.isAddress(addr)) throw new Error("Fee recipient must be a 0x address (ENS not supported).");
  return ethers.getAddress(addr);
}

async function resolveFee(contractType: string, metadataOption: string) {
  let ct: ContractType;
  switch (contractType) {
    case "ERC721_DROP": ct = ContractType.ERC721_DROP; break;
    case "ERC721_SINGLE": ct = ContractType.ERC721_SINGLE; break;
    case "ERC1155_SINGLE": ct = ContractType.ERC1155_SINGLE; break;
    default: throw new Error("Invalid contractType");
  }

  let mo: MetadataOption;
  switch (metadataOption) {
    case "UPLOAD": mo = MetadataOption.UPLOAD; break;
    case "EXTERNAL": mo = MetadataOption.EXTERNAL; break;
    default: throw new Error("Invalid metadataOption");
  }

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
    const usdScaled = BigInt(targetUsdCents) * BigInt(1e8); // cents -> 1e8 scale

    // feeWei = (usdScaled / priceScaled) * 1e18   (ceil division to avoid underpayment)
    const numerator = usdScaled * BigInt(1e18); // *1e18
    const feeWei = ((numerator + (priceScaled - BigInt(1))) / priceScaled).toString();

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
    const body = (await req.json()) as { contractType?: string; metadataOption?: string };

    if (!body?.contractType || !body?.metadataOption) {
      return NextResponse.json({ error: "Missing contractType/metadataOption" }, { status: 400 });
    }

    const payload = await resolveFee(body.contractType, body.metadataOption);
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
      return NextResponse.json({ error: "Missing contractType/metadataOption" }, { status: 400 });
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
