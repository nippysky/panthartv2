// app/api/admin/warpool/worker/pending/retry/route.ts
import { NextRequest, NextResponse } from "next/server";

import { retryFailedPendingAction } from "@/src/features/admin/warpool/worker-mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  actionId?: string;
  actorAddress?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body.actionId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "actionId is required." },
        { status: 400 }
      );
    }

    const updated = await retryFailedPendingAction({
      actionId: body.actionId,
      actorAddress: body.actorAddress ?? null,
    });

    return NextResponse.json({
      ok: true,
      item: {
        id: updated.id,
        type: updated.type,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to retry pending action.",
      },
      { status: 400 }
    );
  }
}