// src/lib/db.ts
import "server-only";
import { Prisma, PrismaClient } from "./generated/prisma/client";

declare global {
  var __prisma__: PrismaClient | undefined;
  var __prismaReady__: Promise<void> | undefined;
}

function requireEnv(name: "DATABASE_URL"): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[prisma] ${name} is missing. Add it to .env.local (dev) or set it in your production environment.`
    );
  }
  return v;
}

/**
 * Optional safety rails (OFF unless you set marker env vars).
 * Protects you from accidentally pointing your revamp app at prod.
 */
function runOptionalSafetyChecks() {
  if (process.env.PRISMA_DISABLE_SAFETY === "1") return;
  if (process.env.NODE_ENV === "production") return;

  const url = requireEnv("DATABASE_URL");

  const prodMarker = process.env.PRISMA_PROD_URL_MARKER;
  if (prodMarker && url.includes(prodMarker)) {
    throw new Error(
      `[safety] Refusing to run locally against a URL matching PRISMA_PROD_URL_MARKER="${prodMarker}".`
    );
  }

  const devMarker = process.env.PRISMA_DEV_URL_MARKER;
  if (devMarker && !url.includes(devMarker)) {
    throw new Error(
      `[safety] In dev, DATABASE_URL must include PRISMA_DEV_URL_MARKER="${devMarker}".`
    );
  }
}

function resolveLogSetting(): Prisma.LogLevel[] {
  if (process.env.PRISMA_LOG === "query") return ["query", "warn", "error"];
  if (process.env.NODE_ENV === "development") return ["warn", "error"];
  return ["error"];
}

function makeClient(): PrismaClient {
  // Ensure env exists + optional guardrails
  requireEnv("DATABASE_URL");
  runOptionalSafetyChecks();

  return new PrismaClient({
    log: resolveLogSetting(),
  });
}

// HMR-safe singleton
const prisma = globalThis.__prisma__ ?? makeClient();
globalThis.__prisma__ ??= prisma;

// Optional eager connect (nice for early failure in dev)
export const prismaReady =
  globalThis.__prismaReady__ ??
  prisma.$connect().catch((err: unknown) => {
    console.error("[prisma] $connect failed:", err);
    throw err;
  });

globalThis.__prismaReady__ ??= prismaReady;

export default prisma;
