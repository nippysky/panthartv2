/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/listing/feed/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { getActiveListings } from "@/src/lib/server/listings/getActiveListings";
import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const take = Math.min(Math.max(Number(searchParams.get("take") ?? 24), 6), 60);
    const cursor = searchParams.get("cursor");

    const { items, nextCursor } = await getActiveListings({
      take,
      cursor: cursor ?? null,
    });

    return NextResponse.json({ ok: true, items, nextCursor });
  } catch (e: any) {
    console.error("[GET /api/listing/feed] error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}