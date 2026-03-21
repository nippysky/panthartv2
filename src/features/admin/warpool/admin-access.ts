// src/features/admin/warpool/admin-access.ts
import type { NextRequest } from "next/server";

function splitCsv(value: string | undefined | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeAdminSlug(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeAdminAddress(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function getPrimaryAdminSlug() {
  return normalizeAdminSlug(process.env.ADMIN_SLUG);
}

export function getAllowedWarpoolAdminSlugs() {
  const envSlugs = splitCsv(process.env.WARPOOL_ADMIN_ALLOWED_SLUGS).map(
    normalizeAdminSlug
  );

  if (envSlugs.length > 0) {
    return [...new Set(envSlugs)];
  }

  const adminSlug = getPrimaryAdminSlug();
  return adminSlug ? [adminSlug] : [];
}

export function isAllowedWarpoolAdminSlug(slug: string | null | undefined) {
  const normalizedSlug = normalizeAdminSlug(slug);
  if (!normalizedSlug) return false;
  return getAllowedWarpoolAdminSlugs().includes(normalizedSlug);
}

export function getAllowedWarpoolAdminWallets() {
  const warpoolWallets = splitCsv(process.env.WARPOOL_ADMIN_WALLETS)
    .map(normalizeAdminAddress)
    .filter(Boolean);

  if (warpoolWallets.length > 0) {
    return [...new Set(warpoolWallets)];
  }

  const sharedWallets = splitCsv(process.env.ADMIN_WALLETS)
    .map(normalizeAdminAddress)
    .filter(Boolean);

  return [...new Set(sharedWallets)];
}

export function isAllowedWarpoolAdminWallet(address: string | null | undefined) {
  const normalizedAddress = normalizeAdminAddress(address);
  if (!normalizedAddress) return false;
  return getAllowedWarpoolAdminWallets().includes(normalizedAddress);
}

export function getWarpoolAdminAccessSnapshot() {
  return {
    allowedSlugs: getAllowedWarpoolAdminSlugs(),
    allowedWallets: getAllowedWarpoolAdminWallets(),
  };
}

function extractAddressFromRequest(req: NextRequest) {
  const headerCandidates = [
    req.headers.get("x-admin-wallet"),
    req.headers.get("x-wallet-address"),
    req.headers.get("x-user-wallet"),
    req.headers.get("x-address"),
  ];

  for (const candidate of headerCandidates) {
    const normalized = normalizeAdminAddress(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function extractSlugFromRequest(req: NextRequest) {
  const headerSlug = normalizeAdminSlug(req.headers.get("x-admin-slug"));
  if (headerSlug) return headerSlug;

  const pathname = req.nextUrl.pathname;
  const parts = pathname.split("/").filter(Boolean);
  const adminIndex = parts.findIndex((part) => part === "admin");

  if (adminIndex >= 0 && parts.length > adminIndex + 1) {
    return normalizeAdminSlug(parts[adminIndex + 1]);
  }

  return null;
}

export function ensureAllowedWarpoolAdminRequest(
  req: NextRequest
):
  | { ok: true; address: string | null; slug: string | null }
  | { ok: false; status: number; error: string } {
  const slug = extractSlugFromRequest(req);

  if (!isAllowedWarpoolAdminSlug(slug)) {
    return {
      ok: false,
      status: 403,
      error: "This admin slug is not allowed for Warpool.",
    };
  }

  const address = extractAddressFromRequest(req);

  if (!address) {
    return {
      ok: false,
      status: 401,
      error: "Missing admin wallet address.",
    };
  }

  if (!isAllowedWarpoolAdminWallet(address)) {
    return {
      ok: false,
      status: 403,
      error: "This wallet is not allowed for Warpool admin access.",
    };
  }

  return {
    ok: true,
    address,
    slug,
  };
}