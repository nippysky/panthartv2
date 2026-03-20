// app/api/admin/warpool/worker/battle/queue/route.ts
import { NextRequest, NextResponse } from "next/server";

import { queueBattleCompute } from "@/src/features/admin/warpool/worker-mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  poolId?: string;
  actorAddress?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body.poolId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "poolId is required." },
        { status: 400 }
      );
    }

    const battle = await queueBattleCompute({
      poolId: body.poolId,
      actorAddress: body.actorAddress ?? null,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: battle.id,
        poolId: battle.poolId,
        status: battle.status,
        updatedAt: battle.updatedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to queue battle compute.",
      },
      { status: 400 }
    );
  }
}