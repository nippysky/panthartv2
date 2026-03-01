// app/api/rewards/me/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";

/**
 * Returns a wallet's multi-currency rewards snapshot.
 * GET /api/rewards/me
 * Header: x-user-address: 0x...
 *
 * For each active currency:
 *  - comrades (count of NFC held)
 *  - accPerToken(1e27), lastAccPerToken(1e27)
 *  - claimedWei(1e18), pendingWei(1e18), totalWei(1e18)
 *
 * DB fixed-point scales:
 * - amounts:       Decimal(78,18) -> treat as integer-like (1e18)
 * - accPerToken:   Decimal(78,27) -> treat as integer-like (1e27)
 *
 * pendingWei = comrades * (accPerToken - lastAccPerToken) / 1e9
 */

const ONE_E9 = BigInt("1000000000");

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

  // negative exponent => < 1 => integer part 0/-0
  return sign + "0";
}

function toBigIntInt(v: unknown): bigint {
  if (v == null) return BigInt(0);

  let s = String(v).trim();
  if (!s) return BigInt(0);

  if (/e/i.test(s)) s = expandSci(s);

  // keep only the integer prefix (Decimal(78,xx) is stored as exact string)
  const m = s.match(/^(-?\d+)/);
  return BigInt(m ? m[1] : "0");
}

function isHexAddrLoose(s: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(s || "");
}

export async function GET(req: Request) {
  await prismaReady;

  const address = (req.headers.get("x-user-address") || "").trim();
  if (!isHexAddrLoose(address)) {
    return NextResponse.json({ error: "bad address" }, { status: 400 });
  }

  // 1) NFC contract (used to count comrades)
  let CONTRACT = (process.env.PANTHART_NFC_CONTRACT || "").trim();
  if (!CONTRACT) {
    const col = await prisma.collection.findFirst({
      where: { name: { equals: "Non-Fungible Comrades", mode: "insensitive" } },
      select: { contract: true },
    });
    CONTRACT = col?.contract || "";
  }
  if (!CONTRACT) {
    return NextResponse.json(
      { error: "collection not configured" },
      { status: 500 }
    );
  }

  // 2) All active currencies (native + ERC20) from DB
  const currencies = await prisma.currency.findMany({
    where: { active: true },
    select: { id: true, symbol: true, decimals: true, kind: true, tokenAddress: true },
    orderBy: [{ symbol: "asc" }],
  });

  if (!currencies.length) {
    const resp = NextResponse.json({ items: [] }, { status: 200 });
    resp.headers.set("Cache-Control", "no-store");
    return resp;
  }

  // 3) comrades count for this wallet (citext compare)
  const comradesRow = await prisma.$queryRaw<Array<{ comrades: string }>>`
    SELECT (COUNT(*)::numeric(78,0))::text AS comrades
    FROM "NFT" n
    JOIN "User" u ON u.id = n."ownerId"
    WHERE n.contract = ${CONTRACT}::citext
      AND n.status   = 'SUCCESS'::"NftStatus"
      AND u."walletAddress" = ${address}::citext
  `;
  const comrades = toBigIntInt(comradesRow?.[0]?.comrades);

  // 4) holder rows (per currency) for this wallet
  const holderRows = await prisma.holderRewardMulti.findMany({
    where: { walletAddress: { equals: address, mode: "insensitive" } },
    select: { currencyId: true, lastAccPerToken: true, claimedAmount: true },
  });

  const holderByCurrency = new Map<
    string,
    { last: bigint; claimed: bigint }
  >(
    holderRows.map((h) => [
      h.currencyId,
      {
        last: toBigIntInt(h.lastAccPerToken),
        claimed: toBigIntInt(h.claimedAmount),
      },
    ])
  );

  // 5) accumulator rows (per currency)
  const accRows = await prisma.rewardAccumulatorMulti.findMany({
    where: { currencyId: { in: currencies.map((c) => c.id) } },
    select: { currencyId: true, accPerToken: true },
  });

  const accByCurrency = new Map<string, bigint>(
    accRows.map((r) => [r.currencyId, toBigIntInt(r.accPerToken)])
  );

  // 6) build response
  const items = currencies.map((c) => {
    const acc = accByCurrency.get(c.id) ?? BigInt(0);
    const meta = holderByCurrency.get(c.id) ?? { last: BigInt(0), claimed: BigInt(0) };

    const delta = acc > meta.last ? acc - meta.last : BigInt(0);
    const pendingWei =
      comrades > BigInt(0) ? (delta * comrades) / ONE_E9 : BigInt(0);

    const totalWei = meta.claimed + pendingWei;

    return {
      currency: {
        id: c.id,
        symbol: c.symbol,
        decimals: c.decimals ?? 18,
        kind: c.kind,
        tokenAddress: c.tokenAddress,
      },
      comrades: Number(comrades),
      accPerToken1e27: acc.toString(),
      lastAccPerToken1e27: meta.last.toString(),
      claimedWei: meta.claimed.toString(),
      pendingWei: pendingWei.toString(),
      totalWei: totalWei.toString(),
    };
  });

  const resp = NextResponse.json({ items }, { status: 200 });
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}
