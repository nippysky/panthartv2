// app/api/minting-now/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getMintingNowPage } from "@/src/lib/server/minting-now";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") || "20", 10)));
    const cursor = url.searchParams.get("cursor"); // base64 cursor token (or null)

    const page = await getMintingNowPage({ limit, cursor });

    const res = NextResponse.json(page);

    // Cache-friendly (tune if you want):
    // - allow edge/CDN to cache briefly
    // - keep it fresh-ish but cheap
    res.headers.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");

    return res;
  } catch (e) {
    console.error("[/api/minting-now] failed:", e);
    return NextResponse.json({ items: [], nextCursor: null }, { status: 500 });
  }
}