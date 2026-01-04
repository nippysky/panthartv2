import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "missing u" }, { status: 400 });

  try {
    // Try HEAD first
    let r = await fetch(u, { method: "HEAD", redirect: "follow", cache: "no-store" });
    // Some gateways don’t support HEAD; fall back to GET with range
    if (!r.ok || !r.headers.get("content-type")) {
      r = await fetch(u, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        cache: "no-store",
      });
    }
    const contentType = r.headers.get("content-type") || "";
    return NextResponse.json({ contentType });
  } catch {
    return NextResponse.json({ contentType: "" });
  }
}
