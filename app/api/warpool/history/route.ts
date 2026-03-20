import { NextResponse } from "next/server";
import { listDevHistory } from "@/src/server/warpool-dev-state";
import type { ApiResponse, WarpoolHistoryPayload } from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const payload: ApiResponse<WarpoolHistoryPayload> = {
    ok: true,
    data: {
      items: listDevHistory(),
      nextCursor: null,
    },
  };

  return NextResponse.json(payload);
}