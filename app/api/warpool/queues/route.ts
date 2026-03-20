import { NextResponse } from "next/server";
import { listWarpoolQueues, listWarpoolRecentWinners } from "@/src/server/warpool";
import type { ApiResponse, WarpoolQueuesPayload } from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [queues, recentWinners] = await Promise.all([
    listWarpoolQueues(),
    listWarpoolRecentWinners(),
  ]);

  const payload: ApiResponse<WarpoolQueuesPayload> = {
    ok: true,
    data: {
      queues,
      recentWinners,
    },
  };

  return NextResponse.json(payload);
}