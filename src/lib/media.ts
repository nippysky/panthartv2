// src/lib/media.ts
export type MediaType = "video" | "image" | "unknown";

export function ipfsToHttp(url?: string | null) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;

  if (u.startsWith("ipfs://")) {
    const cid = u.replace("ipfs://", "");
    return `https://ipfs.io/ipfs/${cid}`;
  }
  return u;
}

export function detectMediaType(url?: string | null, mimeType?: string | null): MediaType {
  const mt = (mimeType || "").toLowerCase().trim();

  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("image/")) return "image";

  if (!url) return "unknown";

  const raw = String(url).toLowerCase();

  // Best-effort URL parse (handles query strings reliably)
  try {
    const u = new URL(raw);
    const p = u.pathname.toLowerCase();

    if (p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov") || p.endsWith(".m4v")) return "video";
    if (
      p.endsWith(".png") ||
      p.endsWith(".jpg") ||
      p.endsWith(".jpeg") ||
      p.endsWith(".webp") ||
      p.endsWith(".avif") ||
      p.endsWith(".gif")
    ) return "image";

    return "unknown";
  } catch {
    // fallback: strip query/hash, check extension
    const s = raw.split("?")[0]?.split("#")[0] ?? raw;

    if (s.endsWith(".mp4") || s.endsWith(".webm") || s.endsWith(".mov") || s.endsWith(".m4v")) return "video";
    if (
      s.endsWith(".png") ||
      s.endsWith(".jpg") ||
      s.endsWith(".jpeg") ||
      s.endsWith(".webp") ||
      s.endsWith(".avif") ||
      s.endsWith(".gif")
    ) return "image";

    return "unknown";
  }
}

export function isVideoType(t: MediaType) {
  return t === "video";
}
