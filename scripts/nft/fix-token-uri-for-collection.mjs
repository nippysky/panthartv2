// scripts/nft/fix-token-uri-for-collection.mjs
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/lib/generated/prisma/client.js";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[nft tokenUri fix] Missing required env var: ${name}`);
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

function normalizeAddress(value) {
  return String(value || "").trim().toLowerCase();
}

function ensureBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("[nft tokenUri fix] Base token URI must not be empty.");
  }
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

const databaseUrl = process.env.DIRECT_URL || required("DATABASE_URL");

const TARGET_COLLECTION_ID = "cmhbjrolg0003m9xl7lavmx32";
const TARGET_CONTRACT = "0x9d4E0280B3732fCEAeEeCD870613aB30bCDA7A31";
const TARGET_BASE_TOKEN_URI = ensureBaseUrl(
  "https://ipfs.io/ipfs/bafybeiddyfzrfgcadus4r52zm6lnckhrre5z4kpe22o7uqs4h23jyggo5q/"
);

const REQUIRE_CONFIRM =
  process.env.CONFIRM_FIX_TOKEN_URI === "YES_FIX_TOKEN_URI";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: buildPgSsl(),
  max: 3,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 15000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function findTargetCollection() {
  return prisma.collection.findFirst({
    where: {
      id: TARGET_COLLECTION_ID,
      contract: {
        equals: TARGET_CONTRACT,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      symbol: true,
      contract: true,
      baseUri: true,
      gatewayPref: true,
      itemsCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function findTargetNfts() {
  return prisma.nFT.findMany({
    where: {
      collectionId: TARGET_COLLECTION_ID,
      contract: {
        equals: TARGET_CONTRACT,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      tokenId: true,
      contract: true,
      collectionId: true,
      name: true,
      tokenUri: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ tokenId: "asc" }],
  });
}

function buildTokenUri(tokenId) {
  return `${TARGET_BASE_TOKEN_URI}${String(tokenId).trim()}.json`;
}

async function buildPreview() {
  const collection = await findTargetCollection();
  const nfts = await findTargetNfts();

  const changed = nfts.filter((nft) => nft.tokenUri !== buildTokenUri(nft.tokenId));
  const unchanged = nfts.length - changed.length;

  return {
    collection,
    total: nfts.length,
    changedCount: changed.length,
    unchangedCount: unchanged,
    sample: nfts.slice(0, 25).map((nft) => ({
      id: nft.id,
      tokenId: nft.tokenId,
      currentTokenUri: nft.tokenUri,
      nextTokenUri: buildTokenUri(nft.tokenId),
    })),
  };
}

async function updateTargets() {
  const nfts = await findTargetNfts();

  let updated = 0;

  for (const nft of nfts) {
    const nextTokenUri = buildTokenUri(nft.tokenId);

    if (nft.tokenUri === nextTokenUri) {
      continue;
    }

    await prisma.nFT.update({
      where: { id: nft.id },
      data: {
        tokenUri: nextTokenUri,
      },
    });

    updated += 1;
  }

  return { updated, total: nfts.length };
}

async function verifyAfterUpdate() {
  const nfts = await findTargetNfts();

  let correct = 0;
  let incorrect = 0;

  for (const nft of nfts) {
    if (nft.tokenUri === buildTokenUri(nft.tokenId)) {
      correct += 1;
    } else {
      incorrect += 1;
    }
  }

  return {
    total: nfts.length,
    correct,
    incorrect,
  };
}

async function main() {
  console.log("🛠️ NFT tokenUri collection fix starting...");
  console.log("DB URL:", redactDatabaseUrl(databaseUrl));
  console.log("Target collectionId:", TARGET_COLLECTION_ID);
  console.log("Target contract:", TARGET_CONTRACT);
  console.log("Target base token URI:", TARGET_BASE_TOKEN_URI);

  const preview = await buildPreview();

  if (!preview.collection) {
    throw new Error(
      "[nft tokenUri fix] Target collection was not found with the provided collectionId + contract."
    );
  }

  console.log("Matched collection:");
  console.table([preview.collection]);

  console.log("Preview summary:");
  console.table({
    totalNfts: preview.total,
    changedCount: preview.changedCount,
    unchangedCount: preview.unchangedCount,
  });

  if (preview.sample.length > 0) {
    console.log("Preview sample (first 25 rows):");
    console.table(preview.sample);
  }

  if (preview.total === 0) {
    console.log("✅ No NFTs matched this collection. Nothing to update.");
    return;
  }

  if (!REQUIRE_CONFIRM) {
    console.log("");
    console.log("⚠️ Dry safety stop: no update has been performed yet.");
    console.log(
      "To execute the update, run with: CONFIRM_FIX_TOKEN_URI=YES_FIX_TOKEN_URI"
    );
    console.log("");
    console.log(
      'PowerShell: $env:CONFIRM_FIX_TOKEN_URI="YES_FIX_TOKEN_URI"; node scripts/nft/fix-token-uri-for-collection.mjs'
    );
    console.log("");
    console.log(
      "Linux/macOS: CONFIRM_FIX_TOKEN_URI=YES_FIX_TOKEN_URI node scripts/nft/fix-token-uri-for-collection.mjs"
    );
    return;
  }

  const result = await updateTargets();
  console.log("Updated rows:", result.updated);

  const verification = await verifyAfterUpdate();
  console.log("Post-update verification:");
  console.table(verification);

  console.log("✅ NFT tokenUri collection fix completed.");
}

main()
  .catch((err) => {
    console.error("❌ NFT tokenUri collection fix failed:");
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });