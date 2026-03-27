// src/lib/media.ts

import { toGatewayUrl } from "@/src/lib/ipfs";

export type MediaType = "video" | "image" | "audio" | "html" | "unknown";

/**
 * Source-of-truth aware:
 * - If DB already stores an HTTP URL (public gateway, Pinata gateway, etc),
 *   keep it exactly as-is.
 * - If DB stores raw ipfs://..., resolve through PUBLIC gateway.
 *
 * This avoids forcing dedicated Pinata for collections whose DB media is
 * intentionally raw IPFS or public-gateway based, while still preserving
 * collections that already store your dedicated Pinata HTTP URLs in DB.
 */
export function ipfsToHttp(url?: string | null) {
  return toGatewayUrl(url, "PUBLIC");
}

function getExtension(url?: string | null) {
  if (!url) return "";

  const raw = String(url).trim();
  if (!raw) return "";

  try {
    const u = new URL(raw);
    const path = u.pathname.toLowerCase();
    const idx = path.lastIndexOf(".");
    return idx >= 0 ? path.slice(idx) : "";
  } catch {
    const cleaned =
      raw.toLowerCase().split("?")[0]?.split("#")[0] ?? raw.toLowerCase();
    const idx = cleaned.lastIndexOf(".");
    return idx >= 0 ? cleaned.slice(idx) : "";
  }
}

export function detectMediaType(
  url?: string | null,
  mimeType?: string | null
): MediaType {
  const mt = (mimeType || "").toLowerCase().trim();

  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("audio/")) return "audio";
  if (mt.includes("text/html") || mt.includes("application/html")) return "html";

  if (!url) return "unknown";

  const resolved = ipfsToHttp(url) ?? url;
  const ext = getExtension(resolved);

  if (
    ext === ".mp4" ||
    ext === ".webm" ||
    ext === ".mov" ||
    ext === ".m4v" ||
    ext === ".ogv"
  ) {
    return "video";
  }

  if (
    ext === ".png" ||
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".webp" ||
    ext === ".avif" ||
    ext === ".gif" ||
    ext === ".svg"
  ) {
    return "image";
  }

  if (
    ext === ".mp3" ||
    ext === ".wav" ||
    ext === ".ogg" ||
    ext === ".aac" ||
    ext === ".flac"
  ) {
    return "audio";
  }

  if (ext === ".html" || ext === ".htm") {
    return "html";
  }

  return "unknown";
}

export function isVideoType(t: MediaType) {
  return t === "video";
}