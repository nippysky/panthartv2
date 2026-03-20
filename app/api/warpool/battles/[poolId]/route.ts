import { NextRequest, NextResponse } from "next/server";
import {
  getWarpoolBattleByPoolId,
  getWarpoolBattleEligibility,
} from "@/src/server/warpool";
import type { ApiResponse, WarpoolBattlePayload } from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await context.params;
  const decoded = decodeURIComponent(poolId);

  const [battle, eligibility] = await Promise.all([
    getWarpoolBattleByPoolId(decoded),
    getWarpoolBattleEligibility(
      decoded,
      req.nextUrl.searchParams.get("walletAddress")
    ),
  ]);

  if (!battle) {
    const payload: ApiResponse<WarpoolBattlePayload> = {
      ok: false,
      message: "Battle not found.",
      code: "BATTLE_NOT_FOUND",
    };
    return NextResponse.json(payload, { status: 404 });
  }

  const payload: ApiResponse<WarpoolBattlePayload> = {
    ok: true,
    data: {
      battle,
      eligibility,
    },
  };

  return NextResponse.json(payload);
}