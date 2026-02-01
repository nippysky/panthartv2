// app/api/users/lookup/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";

function lc(s: string) {
  return s.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  await prismaReady;

  const body = (await req.json().catch(() => null)) as
    | { addresses?: string[] }
    | null;

  const raw = Array.isArray(body?.addresses) ? body!.addresses : [];

  const addresses = Array.from(
    new Set(
      raw
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map(lc)
    )
  ).slice(0, 200); // safety cap

  if (addresses.length === 0) {
    return NextResponse.json({ map: {} });
  }

  const users = await prisma.user.findMany({
    where: { walletAddress: { in: addresses } },
    select: { walletAddress: true, username: true },
  });

  const map: Record<string, string> = {};
  for (const u of users) {
    if (!u.walletAddress || !u.username) continue;
    map[u.walletAddress.toLowerCase()] = u.username;
  }

  return NextResponse.json({ map });
}
