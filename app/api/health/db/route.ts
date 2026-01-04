// src/app/api/_health/db/route.ts
export const runtime = "nodejs"; // Prisma needs Node runtime (not edge)

import prisma, { prismaReady } from "@/src/lib/db";
import { NextResponse } from "next/server";


export async function GET() {
  try {
    // Optional (but good): force early connect failure
    await prismaReady;

    // Basic DB ping (fast)
    const ping = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok;`;

    // Real table reads (also fast)
    const [users, collections, nfts] = await Promise.all([
      prisma.user.count(),
      prisma.collection.count(),
      prisma.nFT.count(),
    ]);

    // Tiny sample to prove decoding works
    const sampleCollections = await prisma.collection.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, contract: true, createdAt: true },
    });

    return NextResponse.json(
      {
        ok: true,
        ping: ping?.[0]?.ok === 1,
        counts: { users, collections, nfts },
        sampleCollections,
        env: {
          nodeEnv: process.env.NODE_ENV ?? "unknown",
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          hasDirectUrl: Boolean(process.env.DIRECT_URL),
        },
      },
      { status: 200 }
    );
  } catch (err) {
    // Avoid leaking secrets. Give a clean error message.
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
