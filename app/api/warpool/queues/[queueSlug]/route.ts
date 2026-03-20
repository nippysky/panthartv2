import { NextRequest, NextResponse } from "next/server";
import {
  getDevQueueBySlug,
  getDevQueueEligibility,
} from "@/src/server/warpool-dev-state";
import type { ApiResponse, WarpoolQueuePayload } from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ queueSlug: string }> }
) {
  const { queueSlug } = await context.params;
  const decoded = decodeURIComponent(queueSlug);
  const queue = getDevQueueBySlug(decoded);

  if (!queue) {
    const payload: ApiResponse<WarpoolQueuePayload> = {
      ok: false,
      message: "Queue not found.",
      code: "QUEUE_NOT_FOUND",
    };
    return NextResponse.json(payload, { status: 404 });
  }

  const walletAddress = req.nextUrl.searchParams.get("walletAddress");
  const eligibility = getDevQueueEligibility(decoded, walletAddress);

  const payload: ApiResponse<WarpoolQueuePayload> = {
    ok: true,
    data: {
      queue,
      eligibility,
    },
  };

  return NextResponse.json(payload);
}