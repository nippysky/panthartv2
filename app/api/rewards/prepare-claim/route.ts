// app/api/rewards/prepare-claim/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

/**
 * Prepare a signed claim for the RewardsDistributor (EIP-712).
 * GET /api/rewards/prepare-claim?account=0x...&currency=ETN|0xToken
 *
 * DB fixed-point scales:
 * - amounts: Decimal(78,18)     -> treat as integer-like (1e18)
 * - accPerToken: Decimal(78,27) -> treat as integer-like (1e27)
 *
 * TOTAL entitlement (1e18) = comrades * accPerToken(1e27) / 1e9
 * We compute it locally for sanity but we TRUST the signer’s value in the response.
 */

const ZERO = "0x0000000000000000000000000000000000000000";
const ONE_E9 = 1_000_000_000n;

/* ---------- Robust decimal parsing (handles scientific notation) ---------- */
function expandSci(s: string) {
  const m = s.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!m) return s;
  const sign = m[1] || "";
  const ip = m[2] || "0";
  const fp = m[3] || "";
  const exp = parseInt(m[4] || "0", 10);

  if (exp >= 0) {
    const need = exp - fp.length;
    if (need >= 0) return sign + ip + fp + "0".repeat(need);
    const all = ip + fp;
    const pos = ip.length + exp;
    return sign + all.slice(0, pos); // integer truncate
  }
  return sign + "0"; // negative exponent => <1 => integer part 0/-0
}

function toBigIntTolerant(v: any): bigint {
  if (v == null) return 0n;
  let s = v.toString().trim();
  if (/e/i.test(s)) s = expandSci(s);
  const m = s.match(/^(-?\d+)/);
  return BigInt(m ? m[1] : "0");
}

/* ---------- Util ---------- */
function isHexAddressCaseAgnostic(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

type CurrencyPick = {
  id: string;
  symbol: string;
  decimals: number;
  tokenAddress: string | null;
};

const currencySelect = {
  id: true,
  symbol: true,
  decimals: true,
  tokenAddress: true,
} as const;

/* ---------- Handler ---------- */
export async function GET(req: Request) {
  await prismaReady;

  const url = new URL(req.url);
  const account = (url.searchParams.get("account") || "").trim();
  const currencyParamRaw = (url.searchParams.get("currency") || "").trim();

  // Validate account format (do NOT change casing)
  if (!isHexAddressCaseAgnostic(account)) {
    return NextResponse.json({ error: "bad account" }, { status: 400 });
  }

  // 1) Resolve currency (case-insensitive DB lookups; zero addr => native)
  const isAddrLike = isHexAddressCaseAgnostic(currencyParamRaw);
  const currencyParam = currencyParamRaw || "ETN";

  let currency: CurrencyPick | null = null;

  if (isAddrLike) {
    currency = await prisma.currency.findFirst({
      where: {
        tokenAddress: { equals: currencyParamRaw, mode: "insensitive" },
        active: true,
      },
      select: currencySelect,
    });
  } else if (!currencyParamRaw || currencyParam.toUpperCase() === "ETN") {
    currency = await prisma.currency.findFirst({
      where: { tokenAddress: null, active: true },
      select: currencySelect,
    });
  } else {
    currency = await prisma.currency.findFirst({
      where: { symbol: { equals: currencyParam, mode: "insensitive" }, active: true },
      select: currencySelect,
    });
  }

  if (!currency) {
    return NextResponse.json(
      { error: `currency not found: ${currencyParamRaw || "(native)"}` },
      { status: 400 }
    );
  }

  // 2) NFC contract
  let CONTRACT = process.env.PANTHART_NFC_CONTRACT?.trim();
  if (!CONTRACT) {
    const col = await prisma.collection.findFirst({
      where: { name: { equals: "Non-Fungible Comrades", mode: "insensitive" } },
      select: { contract: true },
    });
    CONTRACT = col?.contract || "";
  }
  if (!CONTRACT) {
    return NextResponse.json({ error: "collection not configured" }, { status: 500 });
  }

  // 3) Comrades owned by this exact account (citext compare)
  const comradesRows = await prisma.$queryRaw<Array<{ comrades: string }>>`
    SELECT (COUNT(*)::numeric(78,0))::text AS comrades
    FROM "NFT" n
    JOIN "User" u ON u.id = n."ownerId"
    WHERE n.contract = ${CONTRACT}::citext
      AND n.status   = 'SUCCESS'::"NftStatus"
      AND u."walletAddress" = ${account}::citext
  `;
  const comrades = toBigIntTolerant(comradesRows[0]?.comrades);

  // 4) Accumulator (1e27 fixed)
  const acc = await prisma.rewardAccumulatorMulti.findFirst({
    where: { currencyId: currency.id },
    select: { accPerToken: true },
  });
  const accPerToken1e27 = toBigIntTolerant(acc?.accPerToken?.toString());

  // 5) TOTAL entitlement (sanity calc; signer is source of truth)
  const totalWeiLocal = (comrades * accPerToken1e27) / ONE_E9;

  // 6) Call signer service
  const tokenAddr = currency.tokenAddress ? currency.tokenAddress : ZERO;

  const base = (process.env.SIGNER_SERVICE_URL || "").replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json({ error: "signer_not_configured" }, { status: 500 });
  }
  const signUrl = `${base}/sign`;
  const auth = process.env.SIGNER_SERVICE_TOKEN || "";
  const ttl = Number(process.env.SIGNER_DEADLINE_SECONDS || "3600");

  const resp = await fetch(signUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify({
      account,         // exact casing
      token: tokenAddr,
      // Let the signer compute from DB; also pass an explicit TTL for consistency.
      deadlineSeconds: ttl,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    return NextResponse.json({ error: `signer_error: ${t || resp.status}` }, { status: 502 });
  }

  const signed = await resp.json();

  // Return signer’s totals to keep signature <> payload consistent.
  return NextResponse.json({
    currency: {
      symbol: currency.symbol,
      decimals: currency.decimals,
      tokenAddress: tokenAddr,
    },
    account,
    // NOTE: we return signer’s numbers; local calc is just informational.
    total: signed.total,
    deadline: Number(signed.deadline),
    signature: signed.signature,
    // Optional debug (remove if you don’t want to expose):
    _sanityLocalTotalWei: totalWeiLocal.toString(),
  });
}
