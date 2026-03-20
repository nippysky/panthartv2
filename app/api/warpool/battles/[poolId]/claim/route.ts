import { NextRequest, NextResponse } from "next/server";
import { claimDevBattleResult } from "@/src/server/warpool-dev-state";
import type { ApiResponse, WarpoolActionResult } from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  walletAddress?: string | null;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const walletAddress = body.walletAddress?.trim();

  const result = claimDevBattleResult(
    decodeURIComponent(poolId),
    walletAddress
  );

  if (!result.ok) {
    const payload: ApiResponse<WarpoolActionResult> = {
      ok: false,
      message: result.message,
      code: "CLAIM_FAILED",
    };
    return NextResponse.json(payload, { status: 400 });
  }

  const payload: ApiResponse<WarpoolActionResult> = {
    ok: true,
    data: {
      ok: true,
      message: result.message,
    },
  };

  return NextResponse.json(payload);
}