// app/api/rewards/me/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

/**
 * Returns a wallet's multi-currency rewards snapshot.
 * GET /api/rewards/me
 * Header: x-user-address: 0x...
 *
 * For each active currency:
 *  - comrades (count of NFC held)
 *  - accPerToken(1e27), lastAccPerToken(1e27)
 *  - claimedWei(1e18), pendingWei(1e18), totalWei(1e18)
 */

const ONE_E9 = 1_000_000_000n;

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
    return sign + all.slice(0, pos);
  }
  return sign + "0";
}
function toBigIntInt(some: any): bigint {
  if (some == null) return 0n;
  let s = String(some).trim();
  if (/e/i.test(s)) s = expandSci(s);
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

  // NFC contract (used to count comrades)
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

  // All active currencies (native + ERC20)
  const currencies = await prisma.currency.findMany({
    where: { active: true },
    select: { id: true, symbol: true, decimals: true, kind: true, tokenAddress: true },
    orderBy: [{ symbol: "asc" }],
  });
  if (!currencies.length) {
    return NextResponse.json({ items: [] });
  }

  // comrades for this wallet (citext compare)
  const comradesRow = await prisma.$queryRaw<Array<{ comrades: string }>>`
    SELECT (COUNT(*)::numeric(78,0))::text AS comrades
    FROM "NFT" n
    JOIN "User" u ON u.id = n."ownerId"
    WHERE n.contract = ${CONTRACT}::citext
      AND n.status   = 'SUCCESS'::"NftStatus"
      AND u."walletAddress" = ${address}::citext
  `;
  const comrades = toBigIntInt(comradesRow[0]?.comrades);

  // Map holder rows for O(1) access
  const holderRows = await prisma.holderRewardMulti.findMany({
    where: { walletAddress: { equals: address, mode: "insensitive" } },
    select: { walletAddress: true, currencyId: true, lastAccPerToken: true, claimedAmount: true },
  });
  const holderByCurrency = new Map(
    holderRows.map((h) => [h.currencyId, { last: toBigIntInt(h.lastAccPerToken), claimed: toBigIntInt(h.claimedAmount) }])
  );

  // Accumulators
  const accRows = await prisma.rewardAccumulatorMulti.findMany({
    where: { currencyId: { in: currencies.map((c) => c.id) } },
    select: { currencyId: true, accPerToken: true },
  });
  const accByCurrency = new Map(
    accRows.map((r) => [r.currencyId, toBigIntInt(r.accPerToken)])
  );

  const items = currencies.map((c) => {
    const acc = accByCurrency.get(c.id) ?? 0n;
    const meta = holderByCurrency.get(c.id) ?? { last: 0n, claimed: 0n };

    const delta = acc > meta.last ? acc - meta.last : 0n;
    const pendingWei = comrades > 0n ? (delta * comrades) / ONE_E9 : 0n;
    const totalWei = meta.claimed + pendingWei;

    return {
      currency: {
        id: c.id,
        symbol: c.symbol,
        decimals: c.decimals,
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

  return NextResponse.json({ items });
}
