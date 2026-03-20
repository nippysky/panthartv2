// app/api/admin/warpool/runtime/queue/route.ts
import { NextRequest, NextResponse } from "next/server";

import { queueRuntimeAction } from "@/src/features/admin/warpool/worker-mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  actionType?:
    | "WARPOOL_RESERVATION_EXPIRE"
    | "WARPOOL_POOL_PROCESS_EXPIRED"
    | "WARPOOL_POOL_MARK_BATTLE_READY"
    | "WARPOOL_POOL_SETTLE";
  relatedId?: string;
  actorAddress?: string | null;
  payload?: Record<string, unknown> | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body.actionType) {
      return NextResponse.json(
        { ok: false, error: "actionType is required." },
        { status: 400 }
      );
    }

    if (!body.relatedId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "relatedId is required." },
        { status: 400 }
      );
    }

    const created = await queueRuntimeAction({
      actionType: body.actionType,
      relatedId: body.relatedId,
      actorAddress: body.actorAddress ?? null,
      payload: body.payload ?? null,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: created.id,
        type: created.type,
        status: created.status,
        relatedId: created.relatedId,
        createdAt: created.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to queue runtime action.",
      },
      { status: 400 }
    );
  }
}