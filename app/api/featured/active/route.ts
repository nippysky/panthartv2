// app/api/featured/active/route.ts
import { NextResponse } from "next/server";
import { JsonRpcProvider, Contract, formatUnits } from "ethers";
import prisma, { prismaReady } from "@/lib/db";
import FeaturedAuctionAbi from "@/lib/abis/FeaturedAuction.json";

const RPC_HTTP = process.env.RPC_URL!;
const FEATURED_ADDR = process.env.NEXT_PUBLIC_FEATURED_AUCTION_ADDRESS!;

const provider = new JsonRpcProvider(RPC_HTTP);
const auction = new Contract(FEATURED_ADDR, FeaturedAuctionAbi as any, provider);

/* ---------- helpers: same idea as on the SSR page ---------- */

/** Expand e.g. "1.234e+21" into a plain integer string ("1234…"). */
function expandScientificIntString(s: string): string {
  const m = String(s).toLowerCase().match(/^(-?)(\d+)(?:\.(\d+))?e\+(\d+)$/);
  if (!m) return s;

  const sign = m[1] || "";
  const int = m[2] || "0";
  const frac = m[3] || "";
  const exp = Number(m[4] || "0");

  const digits = int + frac;

  if (exp <= frac.length) {
    const left = digits.slice(0, int.length + exp);
    return (sign + (left || "0")).replace(/^(-?)0+(\d)/, "$1$2");
  }

  const zeros = exp - frac.length;
  return (sign + digits + "0".repeat(Math.max(zeros, 0))).replace(
    /^(-?)0+(\d)/,
    "$1$2",
  );
}

/** Normalize anything "wei-like" into a base-10 integer string safe for BigInt. */
function toWeiIntegerString(x: unknown): string {
  if (x == null) return "0";
  if (typeof x === "bigint") return x.toString();
  if (typeof x === "number") {
    if (!Number.isFinite(x)) return "0";
    const s = String(x);
    return /e\+/i.test(s) ? expandScientificIntString(s) : Math.trunc(x).toString();
  }

  let s = String(x).trim();
  if (/e\+/i.test(s)) s = expandScientificIntString(s);
  if (s.includes(".")) s = s.split(".")[0]; // wei must be integer
  s = s.replace(/^\+/, "");
  s = s.replace(/[^0-9]/g, "");
  if (!s) return "0";
  return s;
}

export async function GET() {
  try {
    await prismaReady;

    const active = await prisma.featuredCycle.findFirst({
      where: { status: "ACTIVE" },
      orderBy: [{ startAt: "desc" }],
      select: {
        id: true,
        cycleId: true,
        startAt: true,
        endAt: true,
        minBidWei: true,
        status: true,
      },
    });

    if (!active) {
      return NextResponse.json({
        active: null,
        fx: null,
        now: Date.now(),
        contract: FEATURED_ADDR,
      });
    }

    // On-chain snapshot
    const oc = await auction.getCycle(active.cycleId);
    const leader = String(
      oc[3] ?? "0x0000000000000000000000000000000000000000",
    );

    // Normalize all wei-like values
    const minBidWeiStr = toWeiIntegerString(
      active.minBidWei?.toString?.() ?? (active.minBidWei as any),
    );
    const leaderAmountWeiStr = toWeiIntegerString(
      oc[4]?.toString?.() ?? oc[4] ?? "0",
    );

    // Optional FX
    const fxRow = await prisma.feeConfig.findFirst({
      where: { active: true, pricingPair: "ETNUSD", lastPriceUsd: { not: null } },
      orderBy: [{ lastPriceAt: "desc" }, { updatedAt: "desc" }],
      select: { lastPriceUsd: true, lastPriceAt: true },
    });

    const leaderUser = leader
      ? await prisma.user.findUnique({
          where: { walletAddress: leader },
          select: {
            id: true,
            username: true,
            profileAvatar: true,
            walletAddress: true,
          },
        })
      : null;

    return NextResponse.json({
      active: {
        id: active.id,
        cycleId: active.cycleId,
        startAt: active.startAt,
        endAt: active.endAt,
        status: active.status,
        minBidWei: minBidWeiStr,
        minBidETN: formatUnits(BigInt(minBidWeiStr), 18),
        leader,
        leaderAmountWei: leaderAmountWeiStr,
        leaderAmountETN: formatUnits(BigInt(leaderAmountWeiStr), 18),
        leaderUser,
      },
      fx:
        fxRow && fxRow.lastPriceUsd
          ? {
              lastPriceUsd: fxRow.lastPriceUsd.toString(),
              lastPriceAt: fxRow.lastPriceAt,
            }
          : null,
      now: Date.now(),
      contract: FEATURED_ADDR,
    });
  } catch (err) {
    console.error("[/api/featured/active] error:", err);
    // Still return JSON, so the client never chokes on r.json()
    return NextResponse.json(
      {
        active: null,
        fx: null,
        now: Date.now(),
        contract: FEATURED_ADDR,
        error: "internal-error",
      },
      { status: 500 },
    );
  }
}
