// app/api/nft/[contract]/[tokenId]/rarity/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ contract: string; tokenId: string }> }
) {
  await prismaReady;
  const { contract, tokenId } = await ctx.params;

  try {
    const row = await prisma.nFTRarity.findUnique({
      where: {
        contract_tokenId: {
          contract, // stored as Citext, so case-insensitive at DB level
          tokenId,
        },
      },
      select: { rank: true, score: true, updatedAt: true },
    });

    const resp = NextResponse.json(
      {
        rank: row?.rank ?? null,
        score: row?.score ? String(row.score) : null,
        updatedAt: row?.updatedAt ?? null,
      },
      { status: 200 }
    );

    resp.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    return resp;
  } catch (e) {
    console.error("[api rarity] error:", e);
    return NextResponse.json({ rank: null, score: null }, { status: 200 });
  }
}