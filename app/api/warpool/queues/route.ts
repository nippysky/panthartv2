import { NextResponse } from "next/server";
import {
  listDevQueues,
  listDevRecentWinners,
} from "@/src/server/warpool-dev-state";
import type { ApiResponse, WarpoolQueuesPayload } from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const payload: ApiResponse<WarpoolQueuesPayload> = {
    ok: true,
    data: {
      queues: listDevQueues(),
      recentWinners: listDevRecentWinners(),
    },
  };

  return NextResponse.json(payload);
}