/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

/* ---------------- IPFS helpers ---------------- */
const IPFS_GATEWAY =
  (process.env.NEXT_PUBLIC_IPFS_PRIMARY_GATEWAY as string) ||
  "https://ipfs.io/ipfs/";

function trimSlashes(s: string) {
  return s.replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeIpfsToHttp(uri: string): string {
  const gateway = IPFS_GATEWAY.replace(/\/+$/, "");
  const u = uri.trim();
  if (u.startsWith("ipfs://ipfs/")) return `${gateway}/${trimSlashes(u.slice(12))}`;
  if (u.startsWith("ipfs://")) return `${gateway}/${trimSlashes(u.slice(7))}`;
  if (/^https?:\/\//i.test(u)) return u;
  return `${gateway}/${trimSlashes(u)}`;
}

function ensureTrailingSlash(u: string) {
  return u.endsWith("/") ? u : `${u}/`;
}

function candidatesForBaseUri(baseUri: string, id: number): string[] {
  const httpBase = normalizeIpfsToHttp(baseUri);
  const base = ensureTrailingSlash(httpBase);
  const idStr = String(id);

  const s = new Set<string>();
  s.add(`${base}${idStr}`);
  s.add(`${base}${idStr}.json`);

  if (/\{id\}|\{tokenId\}/i.test(baseUri)) {
    const r = httpBase.replace(/\{id\}|\{tokenId\}/gi, idStr);
    s.add(r);
    s.add(r.endsWith(".json") ? r : `${r}.json`);
  }

  return Array.from(s);
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type Media = { kind: "image"; url: string } | { kind: "video"; url: string };

function detectMediaFromMeta(meta: any): Media | null {
  const rawAnim =
    meta?.animation_url ||
    meta?.animationUrl ||
    meta?.properties?.animation_url ||
    meta?.properties?.animation;

  const rawImg =
    meta?.image ||
    meta?.image_url ||
    meta?.imageUrl ||
    meta?.properties?.image ||
    meta?.properties?.image_url;

  const toUrl = (u?: string) =>
    u && typeof u === "string" ? normalizeIpfsToHttp(u) : undefined;

  const isVideo = (url: string) => {
    const p = (() => {
      try { return new URL(url).pathname.toLowerCase(); } catch { return url.toLowerCase(); }
    })();
    return p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov");
  };

  const anim = toUrl(rawAnim);
  if (anim) {
    const kind = isVideo(anim) || String(meta?.mime_type || "").startsWith("video") ? "video" : "image";
    return { kind, url: anim } as Media;
  }

  const img = toUrl(rawImg);
  if (img) return { kind: isVideo(img) ? "video" : "image", url: img };

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { baseUri?: string } | null;
    const baseUri = (body?.baseUri || "").trim();

    if (!baseUri) {
      return NextResponse.json({ ok: false, error: "Missing baseUri" }, { status: 400 });
    }

    const triedUrls: string[] = [];
    const ids = [1, 0];

    let successMeta: any | null = null;
    let successMedia: Media | null = null;

    for (const id of ids) {
      const urls = candidatesForBaseUri(baseUri, id);
      for (const u of urls) {
        triedUrls.push(u);
        const json = await fetchJsonWithTimeout(u, 12000);
        if (json && typeof json === "object") {
          successMeta = json;
          successMedia = detectMediaFromMeta(json);
          break;
        }
      }
      if (successMeta) break;
    }

    if (!successMeta) {
      return NextResponse.json(
        {
          ok: false,
          error: "We couldn’t fetch valid JSON for token #1 or #0 (with and without .json).",
          triedUrls,
        },
        { status: 200 }
      );
    }

    // Return a trimmed meta payload (keep response small + fast)
    const meta = {
      name: successMeta?.name,
      description: successMeta?.description,
      attributes: Array.isArray(successMeta?.attributes)
        ? successMeta.attributes.slice(0, 24)
        : undefined,
    };

    return NextResponse.json({
      ok: true,
      triedUrls,
      meta,
      media: successMedia,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Preview failed" },
      { status: 500 }
    );
  }
}
