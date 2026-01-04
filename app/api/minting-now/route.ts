// app/api/minting-now/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getMintingNowPage } from "@/lib/server/minting-now";

// Recursively converts any bigint fields to strings, so the JSON response
// can never leak a raw bigint that a client later mis-parses as a Number.
function jsonBigIntSafe<T>(data: T): T {
  const text = JSON.stringify(
    data,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value)
  );
  return JSON.parse(text);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") || "20", 10)));
    const cursorISO = url.searchParams.get("cursorISO"); // may be null

    const page = await getMintingNowPage(limit, cursorISO);

    // Safety belt: even though server mapping stringifies price fields already,
    // this guarantees no stray bigint escapes.
    const safe = jsonBigIntSafe(page);

    return NextResponse.json(safe);
  } catch (e) {
    console.error("[/api/minting-now] failed:", e);
    return NextResponse.json({ items: [], nextCursor: null }, { status: 500 });
  }
}
