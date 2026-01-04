// src/lib/db.ts
import "server-only";
import { Pool } from "pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __PRISMA__: PrismaClient | undefined;
  var __PRISMA_READY__: Promise<void> | undefined;
}

function requireEnv(name: "DATABASE_URL"): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[db] ${name} is missing. Set it in .env (dev) or your hosting env (prod).`
    );
  }
  return v;
}

function runOptionalSafetyChecks(databaseUrl: string) {
  if (process.env.PRISMA_DISABLE_SAFETY === "1") return;
  if (process.env.NODE_ENV === "production") return;

  const prodMarker = process.env.PRISMA_PROD_URL_MARKER;
  if (prodMarker && databaseUrl.includes(prodMarker)) {
    throw new Error(
      `[safety] Refusing to run locally against a URL matching PRISMA_PROD_URL_MARKER="${prodMarker}".`
    );
  }

  const devMarker = process.env.PRISMA_DEV_URL_MARKER;
  if (devMarker && !databaseUrl.includes(devMarker)) {
    throw new Error(
      `[safety] In dev, DATABASE_URL must include PRISMA_DEV_URL_MARKER="${devMarker}".`
    );
  }
}

function resolveLog(): Prisma.LogLevel[] {
  if (process.env.PRISMA_LOG === "query") return ["query", "warn", "error"];
  if (process.env.NODE_ENV === "development") return ["warn", "error"];
  return ["error"];
}

function buildPgSsl(): false | { rejectUnauthorized: boolean } {
  if (process.env.PGSSL_DISABLE === "1") return false;

  const isProdLike =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  return { rejectUnauthorized: isProdLike };
}

function createClient(): PrismaClient {
  const databaseUrl = requireEnv("DATABASE_URL");
  runOptionalSafetyChecks(databaseUrl);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: buildPgSsl(),
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: resolveLog(),
  });
}

export const prisma: PrismaClient = globalThis.__PRISMA__ ?? createClient();
globalThis.__PRISMA__ ??= prisma;

export const prismaReady: Promise<void> =
  globalThis.__PRISMA_READY__ ??
  prisma.$connect().catch((err) => {
    console.error("[prisma] $connect failed:", err);
    throw err;
  });

globalThis.__PRISMA_READY__ ??= prismaReady;

export default prisma;
