import { NextRequest, NextResponse } from "next/server";
import { listOwnedWarpoolAssets } from "@/src/server/warpool-entry";
import type {
  ApiResponse,
  WarpoolQueueAssetsPayload,
} from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get("walletAddress")?.trim();

  if (!walletAddress) {
    const payload: ApiResponse<WarpoolQueueAssetsPayload> = {
      ok: false,
      message: "walletAddress is required.",
      code: "WALLET_REQUIRED",
    };
    return NextResponse.json(payload, { status: 400 });
  }

  const data = await listOwnedWarpoolAssets(walletAddress);

  const payload: ApiResponse<WarpoolQueueAssetsPayload> = {
    ok: true,
    data,
  };

  return NextResponse.json(payload);
}