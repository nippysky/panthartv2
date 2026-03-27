// script/warpool/bootstrap-contracts.mjs
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/lib/generated/prisma/client.js";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[warpool bootstrap] Missing required env var: ${name}`);
  }
  return value;
}

function buildPgSsl() {
  if (process.env.PGSSL_DISABLE === "1") return false;

  const isProdLike =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  return { rejectUnauthorized: isProdLike };
}

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "****";
    return parsed.toString();
  } catch {
    return "[unparseable DATABASE_URL]";
  }
}

const databaseUrl = process.env.DIRECT_URL || required("DATABASE_URL");

const WARPOOL_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 5201420);

const WARPOOL_ADDRESSES = {
  config: required("NEXT_PUBLIC_WARPOOL_CONFIG_ADDRESS"),
  core: required("NEXT_PUBLIC_WARPOOL_CORE_ADDRESS"),
  lens: required("NEXT_PUBLIC_WARPOOL_LENS_ADDRESS"),
};

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: buildPgSsl(),
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkDbContext() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      current_database() AS database_name,
      current_schema()   AS schema_name,
      current_user       AS db_user
  `);

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function listWarpoolTables() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name ILIKE 'warpool%'
    ORDER BY table_name
  `);

  return Array.isArray(rows) ? rows : [];
}

async function listRecentMigrations() {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
      LIMIT 10
    `);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function main() {
  console.log("🔎 Warpool bootstrap starting...");
  console.log("DB URL:", redactDatabaseUrl(databaseUrl));
  console.log("Warpool target:", {
    chainId: WARPOOL_CHAIN_ID,
    config: WARPOOL_ADDRESSES.config,
    core: WARPOOL_ADDRESSES.core,
    lens: WARPOOL_ADDRESSES.lens,
  });

  const dbContext = await checkDbContext();
  console.log("Connected DB context:", dbContext);

  const migrations = await listRecentMigrations();
  if (migrations.length) {
    console.log("Recent migrations:");
    console.table(migrations);
  }

  const warpoolTables = await listWarpoolTables();
  console.log(
    "Found Warpool tables:",
    warpoolTables.map((t) => `${t.table_schema}.${t.table_name}`)
  );

  if (warpoolTables.length === 0) {
    throw new Error(
      "[warpool bootstrap] No tables matching ILIKE 'warpool%' were found in public schema."
    );
  }

  const contracts = [
    {
      kind: "CONFIG",
      address: WARPOOL_ADDRESSES.config,
      chainId: WARPOOL_CHAIN_ID,
      label: "Warpool Config",
    },
    {
      kind: "CORE",
      address: WARPOOL_ADDRESSES.core,
      chainId: WARPOOL_CHAIN_ID,
      label: "Warpool Core",
    },
    {
      kind: "LENS",
      address: WARPOOL_ADDRESSES.lens,
      chainId: WARPOOL_CHAIN_ID,
      label: "Warpool Lens",
    },
  ];

  for (const item of contracts) {
    await prisma.warpoolContract.upsert({
      where: { address: item.address },
      update: {
        active: true,
        label: item.label,
        chainId: item.chainId,
      },
      create: {
        kind: item.kind,
        address: item.address,
        chainId: item.chainId,
        label: item.label,
        active: true,
      },
    });
  }

  console.log("✅ Warpool contracts bootstrapped successfully.");
  console.table(contracts);
}

main()
  .catch((err) => {
    console.error("❌ Warpool bootstrap failed:");
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });