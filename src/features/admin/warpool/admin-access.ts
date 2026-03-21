import "server-only";

export const DEFAULT_WARPOOL_ADMIN_SLUGS = ["panthart", "warpool", "comrades-warpool"];

function splitCsv(value: string | undefined | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeAdminAddress(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function getAllowedWarpoolAdminSlugs() {
  const envSlugs = splitCsv(process.env.WARPOOL_ADMIN_ALLOWED_SLUGS);
  return envSlugs.length > 0 ? envSlugs : DEFAULT_WARPOOL_ADMIN_SLUGS;
}

export function isAllowedWarpoolAdminSlug(slug: string | null | undefined) {
  if (!slug) return false;
  const allowed = getAllowedWarpoolAdminSlugs();
  return allowed.includes(String(slug).trim().toLowerCase());
}

export function getAllowedWarpoolAdminWallets() {
  const envWallets = splitCsv(
    process.env.NEXT_PUBLIC_WARPOOL_ADMIN_WALLETS || process.env.WARPOOL_ADMIN_WALLETS
  );

  return [...new Set(envWallets.map((item) => normalizeAdminAddress(item)).filter(Boolean))];
}

export function isAllowedWarpoolAdminWallet(address: string | null | undefined) {
  const normalized = normalizeAdminAddress(address);
  if (!normalized) return false;
  return getAllowedWarpoolAdminWallets().includes(normalized);
}

export function getWarpoolAdminAccessSnapshot() {
  return {
    allowedSlugs: getAllowedWarpoolAdminSlugs(),
    allowedWallets: getAllowedWarpoolAdminWallets(),
  };
}