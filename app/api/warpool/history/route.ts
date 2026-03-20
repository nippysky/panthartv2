import { NextResponse } from "next/server";
import { listWarpoolHistory } from "@/src/server/warpool";
import type { ApiResponse, WarpoolHistoryPayload } from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const items = await listWarpoolHistory();

  const payload: ApiResponse<WarpoolHistoryPayload> = {
    ok: true,
    data: {
      items,
      nextCursor: null,
    },
  };

  return NextResponse.json(payload);
}