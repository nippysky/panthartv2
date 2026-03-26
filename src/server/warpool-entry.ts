/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { ethers } from "ethers";
import prisma, { prismaReady } from "@/src/lib/db";
import type {
  WarpoolLensPreviewPayload,
  WarpoolOwnedAsset,
  WarpoolQueueAssetsPayload,
} from "@/src/features/warpool/types";

const LENS_ABI = [
  "function canReserveRelic(uint256 poolId, address user, uint256 comradeTokenId, uint256 relicTokenId) view returns (bool ok, string reason)",
  "function canEnterPool(uint256 poolId, address user, uint256 comradeTokenId, uint256 relicTokenId, uint256 reservationId) view returns (bool ok, string reason)",
  "function getActiveReservationForUser(uint256 poolId, address user) view returns (uint256)",
  "function getFighterUsage(address collection, uint256 tokenId) view returns (uint8 consecutiveEntries, uint64 fatiguedUntil, uint64 lastSettledPoolId)",
] as const;

function rpcUrl() {
  return (
    process.env.WARPOOL_RPC_URL ||
    process.env.ELECTRONEUM_RPC_URL ||
    process.env.NEXT_PUBLIC_ELECTRONEUM_RPC_URL ||
    process.env.NEXT_PUBLIC_CHAIN_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    ""
  ).trim();
}

function lensAddress() {
  return (
    process.env.NEXT_PUBLIC_WARPOOL_LENS_ADDRESS ||
    process.env.WARPOOL_LENS_ADDRESS ||
    ""
  ).trim();
}

function formatDcnt(raw?: any): string {
  try {
    return `${ethers.formatUnits(String(raw ?? 0), 18)} DCNT`;
  } catch {
    return "0 DCNT";
  }
}

function toIsoFromUnixSeconds(value: bigint | number | string | null | undefined) {
  if (value == null) return null;

  try {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return new Date(seconds * 1000).toISOString();
  } catch {
    return null;
  }
}

async function getLatestGlobalSnapshot() {
  return prisma.warpoolGlobalConfigSnapshot.findFirst({
    orderBy: [{ syncedAt: "desc" }, { createdAt: "desc" }],
  });
}

async function getContractsForAssets() {
  const latest = await getLatestGlobalSnapshot();

  if (latest?.comradesCollection && latest?.relicsCollection) {
    return {
      comradesCollection: latest.comradesCollection,
      relicsCollection: latest.relicsCollection,
    };
  }

  const latestPool = await prisma.warpoolPool.findFirst({
    orderBy: [{ updatedAt: "desc" }],
  });

  return {
    comradesCollection: latestPool?.comradesCollection ?? "",
    relicsCollection: latestPool?.relicsCollection ?? "",
  };
}

function normalizeReason(reason: string | null | undefined) {
  const value = String(reason ?? "").trim();
  if (!value) return "Unavailable";
  return value;
}

function queueTitleFromSlug(slug?: string | null) {
  if (!slug) return "Warpool";
  return slug
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function getFighterUsageMap(params: {
  comradesCollection: string;
  tokenIds: string[];
}) {
  const usageMap = new Map<
    string,
    {
      consecutiveEntries: number | null;
      fatiguedUntil: string | null;
      isFatigued: boolean;
      lastSettledPoolId: string | null;
    }
  >();

  const maybeRpc = rpcUrl();
  const maybeLens = lensAddress();

  if (!maybeRpc || !maybeLens || !params.comradesCollection || params.tokenIds.length === 0) {
    return usageMap;
  }

  try {
    const provider = new ethers.JsonRpcProvider(maybeRpc);
    const lens = new ethers.Contract(maybeLens, LENS_ABI, provider);
    const nowSec = Math.floor(Date.now() / 1000);

    const results = await Promise.all(
      params.tokenIds.map(async (tokenId) => {
        try {
          const usage = await lens.getFighterUsage(
            params.comradesCollection,
            BigInt(tokenId)
          );

          const consecutiveEntries = Number(usage.consecutiveEntries ?? 0);
          const fatiguedUntilRaw = BigInt(usage.fatiguedUntil ?? 0);
          const lastSettledPoolIdRaw = BigInt(usage.lastSettledPoolId ?? 0);

          return {
            tokenId,
            value: {
              consecutiveEntries,
              fatiguedUntil: toIsoFromUnixSeconds(fatiguedUntilRaw),
              isFatigued: Number(fatiguedUntilRaw) > nowSec,
              lastSettledPoolId:
                lastSettledPoolIdRaw > BigInt(0)
                  ? lastSettledPoolIdRaw.toString()
                  : null,
            },
          };
        } catch {
          return {
            tokenId,
            value: {
              consecutiveEntries: null,
              fatiguedUntil: null,
              isFatigued: false,
              lastSettledPoolId: null,
            },
          };
        }
      })
    );

    for (const item of results) {
      usageMap.set(item.tokenId, item.value);
    }
  } catch {
    return usageMap;
  }

  return usageMap;
}

export async function listOwnedWarpoolAssets(
  walletAddress: string
): Promise<WarpoolQueueAssetsPayload> {
  await prismaReady;

  const { comradesCollection, relicsCollection } = await getContractsForAssets();

  const user = await prisma.user.findUnique({
    where: { walletAddress },
    select: { id: true },
  });

  if (!user) {
    return { comrades: [], relics: [] };
  }

  const nfts = await prisma.nFT.findMany({
    where: {
      ownerId: user.id,
      contract: {
        in: [comradesCollection, relicsCollection].filter(Boolean),
      },
    },
    orderBy: [{ tokenId: "asc" }],
    select: {
      id: true,
      contract: true,
      tokenId: true,
      name: true,
      imageUrl: true,
      rarityScore: true,
    },
  });

  const normalizedComrades = comradesCollection.toLowerCase();
  const normalizedRelics = relicsCollection.toLowerCase();

  const comradeNftIds = nfts
    .filter((nft) => nft.contract.toLowerCase() === normalizedComrades)
    .map((nft) => nft.id);

  const comradeTokenIds = nfts
    .filter((nft) => nft.contract.toLowerCase() === normalizedComrades)
    .map((nft) => String(nft.tokenId));

  const activeLocks = comradeNftIds.length
    ? await prisma.warpoolEntry.findMany({
        where: {
          nftId: { in: comradeNftIds },
          status: { in: ["JOINED", "SELECTED"] as any[] },
          pool: {
            state: { in: ["OPEN", "LOCKED", "BATTLE_READY", "SETTLING"] as any[] },
          },
        },
        select: {
          nftId: true,
          poolId: true,
          pool: {
            select: {
              id: true,
              queueSlug: true,
              state: true,
            },
          },
        },
      })
    : [];

  const fighterUsageMap = await getFighterUsageMap({
    comradesCollection,
    tokenIds: comradeTokenIds,
  });

  const lockMap = new Map<
    string,
    {
      isLockedInWarpool: boolean;
      lockReason: string;
      lockPoolId: string | null;
      lockQueueTitle: string | null;
    }
  >();

  for (const lock of activeLocks) {
    if (!lock.nftId) continue;

    lockMap.set(lock.nftId, {
      isLockedInWarpool: true,
      lockReason: "Fighter already in pool",
      lockPoolId: lock.pool?.id ? String(lock.pool.id) : null,
      lockQueueTitle: queueTitleFromSlug(lock.pool?.queueSlug),
    });
  }

  const mapAsset = (
    nft: any
  ): WarpoolOwnedAsset => {
    const lock = lockMap.get(String(nft.id));
    const isComrade = String(nft.contract).toLowerCase() === normalizedComrades;
    const usage = isComrade ? fighterUsageMap.get(String(nft.tokenId)) : null;

    return {
      nftId: String(nft.id),
      contract: String(nft.contract),
      tokenId: String(nft.tokenId),
      name: nft.name ?? null,
      imageUrl: nft.imageUrl ?? null,
      rarityScore: nft.rarityScore ? String(nft.rarityScore) : null,

      isLockedInWarpool: lock?.isLockedInWarpool ?? false,
      lockReason: lock?.lockReason ?? null,
      lockPoolId: lock?.lockPoolId ?? null,
      lockQueueTitle: lock?.lockQueueTitle ?? null,

      fatigueUntil: usage?.fatiguedUntil ?? null,
      isFatigued: usage?.isFatigued ?? false,
      consecutiveEntries: usage?.consecutiveEntries ?? null,
      lastSettledPoolId: usage?.lastSettledPoolId ?? null,
    };
  };

  const comrades = nfts
    .filter((nft) => nft.contract.toLowerCase() === normalizedComrades)
    .map(mapAsset);

  const relics = nfts
    .filter((nft) => nft.contract.toLowerCase() === normalizedRelics)
    .map(mapAsset);

  return {
    comrades,
    relics,
  };
}

export async function getWarpoolLensPreview(params: {
  queueSlug: string;
  walletAddress: string;
  comradeTokenId: string;
  relicTokenId?: string | null;
}): Promise<WarpoolLensPreviewPayload> {
  await prismaReady;

  const slug = params.queueSlug.toUpperCase();

  const pool = await prisma.warpoolPool.findFirst({
    where: {
      queueSlug: slug as any,
      state: { in: ["OPEN", "LOCKED", "BATTLE_READY", "SETTLING"] as any[] },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  if (!pool) {
    return {
      queueSlug: slug,
      poolId: "",
      poolIdOnChain: "",
      activeReservationIdOnChain: null,
      activeReservationExpiresAt: null,
      canReserveRelic: false,
      reserveReason: "No live pool available",
      canEnter: false,
      enterReason: "No live pool available",
      queueAcceptsRelics: false,
      expectedStake: "0 DCNT",
      discountBps: null,
      discountSeatsRemaining: null,
      token11SeatsRemaining: null,
    };
  }

  const queueAcceptsRelics = Number(pool.tier) === 3 && Number(pool.mode) === 2;

  const reservation = await prisma.warpoolReservation.findFirst({
    where: {
      poolId: pool.id,
      userAddress: params.walletAddress,
      status: "ACTIVE",
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const discountSeatsRemaining = Math.max(
    0,
    Number(pool.discountSeatCap ?? 0) -
      Number(pool.discountSeatsUsed ?? 0) -
      Number(pool.discountSeatsReserved ?? 0)
  );

  const token11SeatsRemaining = Math.max(
    0,
    Number(pool.token11SeatCap ?? 0) - Number(pool.token11SeatsUsed ?? 0)
  );

  const relicTokenId = params.relicTokenId?.trim() || null;
  const isToken11 = relicTokenId === "11";

  let canReserveRelic = false;
  let reserveReason = queueAcceptsRelics
    ? "Select a discount relic to reserve a seat."
    : "This queue does not use relics.";
  let canEnter = pool.state === "OPEN";
  let enterReason = pool.state === "OPEN" ? "Ready" : "Pool is not open";
  let activeReservationIdOnChain = reservation
    ? String(reservation.reservationIdOnChain)
    : null;
  const activeReservationExpiresAt =
    reservation?.expiresAtOnChain?.toISOString() ?? null;
  const discountBps = reservation?.discountBps ?? null;

  const expectedStake = isToken11
    ? "0 DCNT"
    : reservation?.discountBps
      ? formatDcnt(
          (BigInt(String(pool.stakeAmountRaw)) *
            BigInt(10_000 - Number(reservation.discountBps))) /
            BigInt(10_000)
        )
      : formatDcnt(pool.stakeAmountRaw);

  const maybeRpc = rpcUrl();
  const maybeLens = lensAddress();

  if (maybeRpc && maybeLens) {
    try {
      const provider = new ethers.JsonRpcProvider(maybeRpc);
      const lens = new ethers.Contract(maybeLens, LENS_ABI, provider);

      const chainReservationId = await lens.getActiveReservationForUser(
        BigInt(String(pool.poolIdOnChain)),
        params.walletAddress
      );

      const reservationIdBigInt = BigInt(chainReservationId.toString());
      activeReservationIdOnChain =
        reservationIdBigInt > BigInt(0) ? reservationIdBigInt.toString() : null;

      if (queueAcceptsRelics && relicTokenId && !isToken11) {
        const reserve = await lens.canReserveRelic(
          BigInt(String(pool.poolIdOnChain)),
          params.walletAddress,
          BigInt(params.comradeTokenId),
          BigInt(relicTokenId)
        );

        canReserveRelic = Boolean(reserve[0]);
        reserveReason = normalizeReason(reserve[1]);
      } else {
        canReserveRelic = false;
      }

      const enter = await lens.canEnterPool(
        BigInt(String(pool.poolIdOnChain)),
        params.walletAddress,
        BigInt(params.comradeTokenId),
        relicTokenId ? BigInt(relicTokenId) : BigInt(0),
        activeReservationIdOnChain ? BigInt(activeReservationIdOnChain) : BigInt(0)
      );

      canEnter = Boolean(enter[0]);
      enterReason = normalizeReason(enter[1]);
    } catch {
      if (!queueAcceptsRelics && relicTokenId) {
        canEnter = false;
        enterReason = "This queue does not use relics";
      }

      if (pool.state !== "OPEN") {
        canEnter = false;
        enterReason = "Pool is not open";
      }

      if (queueAcceptsRelics && relicTokenId && !isToken11) {
        canReserveRelic = discountSeatsRemaining > 0 && !reservation;
        reserveReason = canReserveRelic
          ? "Discount seat available"
          : reservation
            ? "Active reservation already exists"
            : "Discount seats full";
      }

      if (queueAcceptsRelics && isToken11) {
        canEnter = token11SeatsRemaining > 0 && pool.state === "OPEN";
        enterReason = canEnter ? "Ready" : "Token 11 seat full";
      }
    }
  } else {
    if (!queueAcceptsRelics && relicTokenId) {
      canEnter = false;
      enterReason = "This queue does not use relics";
    }

    if (pool.state !== "OPEN") {
      canEnter = false;
      enterReason = "Pool is not open";
    }

    if (queueAcceptsRelics && relicTokenId && !isToken11) {
      canReserveRelic = discountSeatsRemaining > 0 && !reservation;
      reserveReason = canReserveRelic
        ? "Discount seat available"
        : reservation
          ? "Active reservation already exists"
          : "Discount seats full";
    }

    if (queueAcceptsRelics && isToken11) {
      canEnter = token11SeatsRemaining > 0 && pool.state === "OPEN";
      enterReason = canEnter ? "Ready" : "Token 11 seat full";
    }
  }

  return {
    queueSlug: slug,
    poolId: String(pool.id),
    poolIdOnChain: String(pool.poolIdOnChain),
    activeReservationIdOnChain,
    activeReservationExpiresAt,
    canReserveRelic,
    reserveReason,
    canEnter,
    enterReason,
    queueAcceptsRelics,
    expectedStake,
    discountBps,
    discountSeatsRemaining: queueAcceptsRelics ? discountSeatsRemaining : null,
    token11SeatsRemaining: queueAcceptsRelics ? token11SeatsRemaining : null,
  };
}