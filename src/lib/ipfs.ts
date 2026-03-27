// src/lib/ipfs.ts

export type GatewayPref = "PINATA" | "PUBLIC";

const FALLBACK_PRIMARY =
  process.env.IPFS_PRIMARY_GATEWAY?.trim() ||
  process.env.NEXT_PUBLIC_IPFS_PRIMARY_GATEWAY?.trim() ||
  "https://ipfs.io/ipfs/";

const FALLBACK_PINATA =
  process.env.IPFS_PINATA_GATEWAY?.trim() ||
  process.env.NEXT_PUBLIC_IPFS_PINATA_GATEWAY?.trim() ||
  "https://lime-traditional-stork-669.mypinata.cloud/ipfs/";

const EXTRA_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

function ensureGatewayBase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function normalizeGateway(value: string) {
  const withSlash = ensureGatewayBase(value);
  return withSlash.endsWith("/ipfs/")
    ? withSlash
    : `${withSlash.replace(/\/+$/, "")}/ipfs/`;
}

const PRIMARY_GATEWAY = normalizeGateway(FALLBACK_PRIMARY);
const PINATA_GATEWAY = normalizeGateway(FALLBACK_PINATA);
const EXTRA_NORMALIZED = EXTRA_GATEWAYS.map(normalizeGateway);

export function isHttpUrl(value?: string | null) {
  return !!value && /^https?:\/\//i.test(value.trim());
}

export function isIpfsUri(value?: string | null) {
  if (!value) return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith("ipfs://") ||
    trimmed.startsWith("/ipfs/") ||
    /\/ipfs\//i.test(trimmed)
  );
}

export function extractIpfsPath(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("ipfs://")) {
    return trimmed
      .replace(/^ipfs:\/\//i, "")
      .replace(/^ipfs\//i, "")
      .replace(/^\/+/, "");
  }

  if (trimmed.startsWith("/ipfs/")) {
    return trimmed.replace(/^\/ipfs\//i, "").replace(/^\/+/, "");
  }

  if (/^ipfs\//i.test(trimmed)) {
    return trimmed.replace(/^ipfs\//i, "").replace(/^\/+/, "");
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/ipfs\/(.+)$/i);
    if (match?.[1]) return match[1].replace(/^\/+/, "");
  } catch {
    // not a valid URL, ignore
  }

  return null;
}

export function toCanonicalIpfsUri(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isHttpUrl(trimmed)) return trimmed;

  const ipfsPath = extractIpfsPath(trimmed);
  if (!ipfsPath) return trimmed || null;

  return `ipfs://${ipfsPath}`;
}

export function getPreferredGateway(pref: GatewayPref = "PINATA") {
  return pref === "PINATA" ? PINATA_GATEWAY : PRIMARY_GATEWAY;
}

/**
 * Source-first resolver:
 * - If DB already gives a full HTTP URL, keep it exactly as-is.
 * - Only rewrite real IPFS URIs/paths.
 */
export function toGatewayUrl(
  value?: string | null,
  pref: GatewayPref = "PINATA",
  preferredGateway?: string | null
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // ✅ Respect DB/stored HTTP URLs first.
  if (isHttpUrl(trimmed)) {
    return trimmed;
  }

  const ipfsPath = extractIpfsPath(trimmed);
  if (!ipfsPath) {
    return null;
  }

  const gateway = preferredGateway?.trim()
    ? normalizeGateway(preferredGateway)
    : getPreferredGateway(pref);

  return `${gateway}${ipfsPath}`;
}

/**
 * Returns candidates in fallback order.
 * If source is already an HTTP URL from DB, try it first before any rewrite.
 */
export function getGatewayCandidates(
  value?: string | null,
  pref: GatewayPref = "PINATA",
  preferredGateway?: string | null
): string[] {
  if (!value) return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  // ✅ Preserve original HTTP URL first.
  if (isHttpUrl(trimmed)) {
    const ipfsPath = extractIpfsPath(trimmed);
    if (!ipfsPath) return [trimmed];

    const preferred = preferredGateway?.trim()
      ? normalizeGateway(preferredGateway)
      : getPreferredGateway(pref);

    const ordered =
      pref === "PINATA"
        ? [trimmed, preferred, PRIMARY_GATEWAY, ...EXTRA_NORMALIZED]
        : [trimmed, preferred, PINATA_GATEWAY, ...EXTRA_NORMALIZED];

    return Array.from(new Set(ordered.map((entry) => {
      if (entry.startsWith("http")) {
        if (entry === trimmed) return trimmed;
        return `${entry}${ipfsPath}`;
      }
      return entry;
    })));
  }

  const ipfsPath = extractIpfsPath(trimmed);
  if (!ipfsPath) return [];

  const preferred = preferredGateway?.trim()
    ? normalizeGateway(preferredGateway)
    : getPreferredGateway(pref);

  const ordered =
    pref === "PINATA"
      ? [preferred, PRIMARY_GATEWAY, ...EXTRA_NORMALIZED]
      : [preferred, PINATA_GATEWAY, ...EXTRA_NORMALIZED];

  return Array.from(new Set(ordered.map((base) => `${base}${ipfsPath}`)));
}

export async function fetchJsonFromIpfs(
  value?: string | null,
  options?: {
    pref?: GatewayPref;
    preferredGateway?: string | null;
    signal?: AbortSignal;
    cache?: RequestCache;
  }
) {
  const candidates = getGatewayCandidates(
    value,
    options?.pref ?? "PINATA",
    options?.preferredGateway ?? null
  );

  let lastError: unknown = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: options?.cache ?? "no-store",
        signal: options?.signal,
      });

      if (!res.ok) {
        lastError = new Error(`Failed ${res.status} for ${url}`);
        continue;
      }

      return await res.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to fetch JSON from IPFS");
}