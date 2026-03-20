import { NextRequest, NextResponse } from "next/server";
import {
  getWarpoolQueueBySlug,
  getWarpoolQueueEligibility,
} from "@/src/server/warpool";
import type { ApiResponse, WarpoolQueuePayload } from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ queueSlug: string }> }
) {
  const { queueSlug } = await context.params;
  const decoded = decodeURIComponent(queueSlug);

  const [queue, eligibility] = await Promise.all([
    getWarpoolQueueBySlug(decoded),
    getWarpoolQueueEligibility(
      decoded,
      req.nextUrl.searchParams.get("walletAddress")
    ),
  ]);

  if (!queue) {
    const payload: ApiResponse<WarpoolQueuePayload> = {
      ok: false,
      message: "Queue not found.",
      code: "QUEUE_NOT_FOUND",
    };
    return NextResponse.json(payload, { status: 404 });
  }

  const payload: ApiResponse<WarpoolQueuePayload> = {
    ok: true,
    data: {
      queue,
      eligibility,
    },
  };

  return NextResponse.json(payload);
}