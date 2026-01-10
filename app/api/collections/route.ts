/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/collections/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getCollectionsPage } from "@/src/lib/collections";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const sort = (url.searchParams.get("sort") ?? "volume") as any;
  const currency = url.searchParams.get("currency") ?? "native";
  const cursor = url.searchParams.get("cursor");
  const limit = Number(url.searchParams.get("limit") ?? "24");

  const data = await getCollectionsPage({
    sort,
    currency,
    cursor: cursor ?? null,
    limit,
  });

  const resp = NextResponse.json(data, { status: 200 });
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}
