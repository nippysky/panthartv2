import "server-only";

import { ethers } from "ethers";
import prisma, { prismaReady } from "@/src/lib/db";
import { WARPOOL_LENS_ABI } from "@/src/lib/abis/warpoolLensAbi";
import { getWarpoolQueueBySlug } from "@/src/server/warpool";
import type {
  WarpoolLensPreviewPayload,
  WarpoolOwnedAsset,
} from "@/src/features/warpool/types";

function normalizeAddress(address?: string | null) {
  return address?.trim().toLowerCase() ?? "";
}

function getEnv(name: string, fallback = "") {
  const value = process.env[name];
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  return trimmed || fallback;
}

function requireRpcUrl() {
  const rpc =
    getEnv("WARPOOL_RPC_URL") ||
    getEnv("RPC_HTTP_URL") ||
    getEnv("RPC_URL") ||
    "https://rpc.ankr.com/electroneum";

  return rpc;
}

function getLensAddress() {
  return (
    getEnv("WARPOOL_LENS_ADDRESS") ||
    getEnv("NEXT_PUBLIC_WARPOOL_LENS_ADDRESS")
  );
}

async function resolveCollections() {
  const comradesFromEnv =
    getEnv("NEXT_PUBLIC_WARPOOL_COMRADES_COLLECTION") ||
    getEnv("WARPOOL_COMRADES_COLLECTION");

  const relicsFromEnv =
    getEnv("NEXT_PUBLIC_WARPOOL_RELICS_COLLECTION") ||
    getEnv("WARPOOL_RELICS_COLLECTION");

  if (comradesFromEnv) {
    return {
      comradesCollection: comradesFromEnv.toLowerCase(),
      relicsCollection: relicsFromEnv ? relicsFromEnv.toLowerCase() : null,
    };
  }

  const latest = await prisma.warpoolGlobalConfigSnapshot.findFirst({
    orderBy: [{ syncedAt: "desc" }],
    select: {
      comradesCollection: true,
      relicsCollection: true,
    },
  });

  return {
    comradesCollection: latest?.comradesCollection?.toLowerCase() ?? null,
    relicsCollection: latest?.relicsCollection?.toLowerCase() ?? null,
  };
}

export async function listOwnedWarpoolAssets(
  walletAddress: string
): Promise<{
  comrades: WarpoolOwnedAsset[];
  relics: WarpoolOwnedAsset[];
}> {
  await prismaReady;

  const normalizedWallet = normalizeAddress(walletAddress);
  const collections = await resolveCollections();

  if (!normalizedWallet || !collections.comradesCollection) {
    return {
      comrades: [],
      relics: [],
    };
  }

  const comrades = await prisma.nFT.findMany({
    where: {
      contract: collections.comradesCollection,
      owner: {
        walletAddress: normalizedWallet,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      contract: true,
      tokenId: true,
      name: true,
      imageUrl: true,
      rarityScore: true,
    },
  });

  const relics = collections.relicsCollection
    ? await prisma.nFT.findMany({
        where: {
          contract: collections.relicsCollection,
          owner: {
            walletAddress: normalizedWallet,
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          contract: true,
          tokenId: true,
          name: true,
          imageUrl: true,
          rarityScore: true,
        },
      })
    : [];

  return {
    comrades: comrades.map((item) => ({
      nftId: item.id,
      contract: item.contract,
      tokenId: item.tokenId,
      name: item.name ?? null,
      imageUrl: item.imageUrl ?? null,
      rarityScore: item.rarityScore?.toString() ?? null,
    })),
    relics: relics.map((item) => ({
      nftId: item.id,
      contract: item.contract,
      tokenId: item.tokenId,
      name: item.name ?? null,
      imageUrl: item.imageUrl ?? null,
      rarityScore: item.rarityScore?.toString() ?? null,
    })),
  };
}

export async function getWarpoolLensPreview(args: {
  queueSlug: string;
  walletAddress: string;
  comradeTokenId: string;
  relicTokenId?: string | null;
}): Promise<WarpoolLensPreviewPayload> {
  await prismaReady;

  const normalizedWallet = normalizeAddress(args.walletAddress);
  if (!normalizedWallet) {
    throw new Error("Wallet address is required.");
  }

  const queue = await getWarpoolQueueBySlug(args.queueSlug);
  if (!queue?.poolId) {
    throw new Error("No live pool is available for this queue.");
  }

  const pool = await prisma.warpoolPool.findUnique({
    where: { id: queue.poolId },
    select: {
      id: true,
      poolIdOnChain: true,
    },
  });

  if (!pool) {
    throw new Error("Live pool record not found.");
  }

  const lensAddress = getLensAddress();
  if (!lensAddress) {
    throw new Error("WARPOOL_LENS_ADDRESS is not configured.");
  }

  const provider = new ethers.JsonRpcProvider(requireRpcUrl());
  const lens = new ethers.Contract(lensAddress, WARPOOL_LENS_ABI, provider);

  const poolIdOnChain = BigInt(pool.poolIdOnChain.toString());
  const comradeTokenId = BigInt(args.comradeTokenId);
  const relicTokenId = args.relicTokenId ? BigInt(args.relicTokenId) : BigInt(0);

  const activeReservationIdOnChainRaw = await lens.getActiveReservationForUser(
    poolIdOnChain,
    normalizedWallet
  );

  const activeReservationIdOnChain =
    BigInt(activeReservationIdOnChainRaw.toString()) > BigInt(0)
      ? activeReservationIdOnChainRaw.toString()
      : null;

  const reserveCheck =
    relicTokenId > BigInt(0)
      ? await lens.canReserveRelic(
          poolIdOnChain,
          normalizedWallet,
          comradeTokenId,
          relicTokenId
        )
      : [false, "No relic selected"];

  const enterCheck = await lens.canEnterPool(
    poolIdOnChain,
    normalizedWallet,
    comradeTokenId,
    relicTokenId,
    activeReservationIdOnChain ? BigInt(activeReservationIdOnChain) : BigInt(0)
  );

  return {
    queueSlug: args.queueSlug,
    poolId: pool.id,
    poolIdOnChain: pool.poolIdOnChain.toString(),
    activeReservationIdOnChain,
    canReserveRelic: Boolean(reserveCheck[0]),
    reserveReason: String(reserveCheck[1] ?? ""),
    canEnter: Boolean(enterCheck[0]),
    enterReason: String(enterCheck[1] ?? ""),
  };
}