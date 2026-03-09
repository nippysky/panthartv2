// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";
const MAINTENANCE_ALLOW_ADMIN = process.env.MAINTENANCE_ALLOW_ADMIN !== "false";
const ADMIN_SLUG = process.env.ADMIN_SLUG || "";

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/site.webmanifest") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

function isMaintenancePath(pathname: string) {
  return pathname === "/maintenance";
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api");
}

function isAdminPath(pathname: string) {
  if (!ADMIN_SLUG) return false;
  return pathname === `/${ADMIN_SLUG}` || pathname.startsWith(`/${ADMIN_SLUG}/`);
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!MAINTENANCE_MODE) {
    return NextResponse.next();
  }

  if (
    isMaintenancePath(pathname) ||
    isStaticAsset(pathname) ||
    isApiPath(pathname) ||
    (MAINTENANCE_ALLOW_ADMIN && isAdminPath(pathname))
  ) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/maintenance";
  url.searchParams.set("from", pathname + search);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/favicon.ico", "/robots.txt", "/sitemap.xml"],
};