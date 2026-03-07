/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/listing/reconcile/route.ts

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { confirmListingTx, type ConfirmMarketInput } from "@/src/lib/market/confirm";

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ConfirmMarketInput | null;

  if (!body) {
    return json(400, { ok: false, error: "Invalid request body" });
  }

  const result = await confirmListingTx(body);

  if (!result.ok) {
    return json(400, result);
  }

  return json(200, {
    ok: true,
    kind: "listing",
    reconciled: true,
    txHashCreated: body.txHashCreated,
    contract: body.contract,
    tokenId: body.tokenId,
    result,
  });
}