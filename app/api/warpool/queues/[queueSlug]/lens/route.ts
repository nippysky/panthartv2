import { NextRequest, NextResponse } from "next/server";
import { getWarpoolLensPreview } from "@/src/server/warpool-entry";
import type {
  ApiResponse,
  WarpoolLensPreviewPayload,
} from "@/src/features/warpool/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ queueSlug: string }> }
) {
  const { queueSlug } = await context.params;

  const walletAddress = req.nextUrl.searchParams.get("walletAddress")?.trim();
  const comradeTokenId = req.nextUrl.searchParams.get("comradeTokenId")?.trim();
  const relicTokenId = req.nextUrl.searchParams.get("relicTokenId")?.trim() || null;

  if (!walletAddress || !comradeTokenId) {
    const payload: ApiResponse<WarpoolLensPreviewPayload> = {
      ok: false,
      message: "walletAddress and comradeTokenId are required.",
      code: "INVALID_INPUT",
    };
    return NextResponse.json(payload, { status: 400 });
  }

  const data = await getWarpoolLensPreview({
    queueSlug: decodeURIComponent(queueSlug),
    walletAddress,
    comradeTokenId,
    relicTokenId,
  });

  const payload: ApiResponse<WarpoolLensPreviewPayload> = {
    ok: true,
    data,
  };

  return NextResponse.json(payload);
}