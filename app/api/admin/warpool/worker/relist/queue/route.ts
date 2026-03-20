// app/api/admin/warpool/worker/relist/queue/route.ts
import { NextRequest, NextResponse } from "next/server";

import { queueCaptureRelist } from "@/src/features/admin/warpool/worker-mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  captureId?: string;
  actorAddress?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body.captureId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "captureId is required." },
        { status: 400 }
      );
    }

    const result = await queueCaptureRelist({
      captureId: body.captureId,
      actorAddress: body.actorAddress ?? null,
    });

    return NextResponse.json({
      ok: true,
      item: {
        captureId: result.capture.id,
        relistStatus: result.capture.relistStatus,
        pendingActionId: result.pending.id,
        pendingStatus: result.pending.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to queue capture relist.",
      },
      { status: 400 }
    );
  }
}