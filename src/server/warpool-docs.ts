/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { ethers } from "ethers";
import prisma, { prismaReady } from "@/src/lib/db";

type QueueDocItem = {
  slug: string;
  title: string;
  tier: number;
  mode: number;
  enabled: boolean;
  singleEntryPerWallet: boolean;
  targetSize: number;
  minStartSize: number;
  openDurationSeconds: number;
  stakeAmount: string;
  platformFeeBps: number;
  firstPlaceBps: number;
  secondPlaceBps: number;
  thirdPlaceBps: number;
  configVersion: string;
};

type DynamicConfig = {
  configVersion: string | null;
  entriesPaused: boolean | null;
  reservationsPaused: boolean | null;
  settlementsPaused: boolean | null;
  relicsEnabled: boolean | null;
  fatigueEnabled: boolean | null;
  token11FeeShareEnabled: boolean | null;
  token11FeeShareBps: number | null;
  relicMinDiscountBps: number | null;
  relicMaxDiscountBps: number | null;
  discountSeatCap: number | null;
  token11SeatCap: number | null;
  reservationTtlSeconds: number | null;
  fatigueMaxConsecutive: number | null;
  fatigueCooldownSeconds: number | null;
  roundsPerMatch: number | null;
  traitPowerMin: number | null;
  traitPowerMax: number | null;
  roundVarianceMax: number | null;
  microMomentumMax: number | null;
};

type ContractLink = {
  kind: string;
  address: string;
  label: string;
  href: string | null;
};

export type WarpoolDocsData = {
  snapshot: DynamicConfig | null;
  queues: QueueDocItem[];
  contracts: ContractLink[];
};

const QUEUE_TITLES: Record<string, string> = {
  FORGE_SAFEGUARD: "Forge Safeguard",
  LEGION_SAFEGUARD: "Legion Safeguard",
  LEGION_VAULTBOUND: "Legion Vaultbound",
  CROWN_VAULTBOUND: "Crown Vaultbound",
};

function queueTitle(slug: string) {
  return (
    QUEUE_TITLES[slug] ??
    slug
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatDcntRaw(raw?: any) {
  try {
    return `${ethers.formatUnits(String(raw ?? 0), 18)} DCNT`;
  } catch {
    return "0 DCNT";
  }
}

function explorerBase() {
  return (
    process.env.NEXT_PUBLIC_ETN_EXPLORER_URL ||
    process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
    "https://blockexplorer.electroneum.com"
  ).replace(/\/+$/, "");
}

function explorerAddressUrl(address: string | null | undefined) {
  if (!address) return null;
  return `${explorerBase()}/address/${address}`;
}

function contractLabel(kind: string) {
  if (kind === "CONFIG") return "Warpool Config";
  if (kind === "CORE") return "Warpool Core";
  if (kind === "LENS") return "Warpool Lens";
  return kind;
}

export async function loadWarpoolDocsData(): Promise<WarpoolDocsData> {
  await prismaReady;

  const [snapshot, queueConfigs, contracts] = await Promise.all([
    prisma.warpoolGlobalConfigSnapshot.findFirst({
      orderBy: [{ syncedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.warpoolQueueConfig.findMany({
      orderBy: [{ slug: "asc" }, { configVersion: "desc" }, { syncedAt: "desc" }],
    }),
    prisma.warpoolContract.findMany({
      where: { active: true },
      orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const latestQueueMap = new Map<string, any>();
  for (const row of queueConfigs) {
    const slug = String(row.slug);
    if (!latestQueueMap.has(slug)) latestQueueMap.set(slug, row);
  }

  const queues: QueueDocItem[] = Array.from(latestQueueMap.values()).map((row) => ({
    slug: String(row.slug),
    title: queueTitle(String(row.slug)),
    tier: Number(row.tier),
    mode: Number(row.mode),
    enabled: Boolean(row.enabled),
    singleEntryPerWallet: Boolean(row.singleEntryPerWallet),
    targetSize: Number(row.targetSize),
    minStartSize: Number(row.minStartSize),
    openDurationSeconds: Number(row.openDurationSeconds),
    stakeAmount: formatDcntRaw(row.stakeAmountRaw),
    platformFeeBps: Number(row.platformFeeBps),
    firstPlaceBps: Number(row.firstPlaceBps),
    secondPlaceBps: Number(row.secondPlaceBps),
    thirdPlaceBps: Number(row.thirdPlaceBps),
    configVersion: String(row.configVersion),
  }));

  const contractLinks: ContractLink[] = contracts.map((row) => ({
    kind: String(row.kind),
    label: contractLabel(String(row.kind)),
    address: row.address,
    href: explorerAddressUrl(row.address),
  }));

  return {
    snapshot: snapshot
      ? {
          configVersion: String(snapshot.configVersion),
          entriesPaused: snapshot.entriesPaused,
          reservationsPaused: snapshot.reservationsPaused,
          settlementsPaused: snapshot.settlementsPaused,
          relicsEnabled: snapshot.relicsEnabled,
          fatigueEnabled: snapshot.fatigueEnabled,
          token11FeeShareEnabled: snapshot.token11FeeShareEnabled,
          token11FeeShareBps:
            snapshot.token11FeeShareBps != null
              ? Number(snapshot.token11FeeShareBps)
              : null,
          relicMinDiscountBps:
            snapshot.relicMinDiscountBps != null
              ? Number(snapshot.relicMinDiscountBps)
              : null,
          relicMaxDiscountBps:
            snapshot.relicMaxDiscountBps != null
              ? Number(snapshot.relicMaxDiscountBps)
              : null,
          discountSeatCap:
            snapshot.discountSeatCap != null ? Number(snapshot.discountSeatCap) : null,
          token11SeatCap:
            snapshot.token11SeatCap != null ? Number(snapshot.token11SeatCap) : null,
          reservationTtlSeconds:
            snapshot.reservationTtlSeconds != null
              ? Number(snapshot.reservationTtlSeconds)
              : null,
          fatigueMaxConsecutive:
            snapshot.fatigueMaxConsecutive != null
              ? Number(snapshot.fatigueMaxConsecutive)
              : null,
          fatigueCooldownSeconds:
            snapshot.fatigueCooldownSeconds != null
              ? Number(snapshot.fatigueCooldownSeconds)
              : null,
          roundsPerMatch:
            snapshot.roundsPerMatch != null ? Number(snapshot.roundsPerMatch) : null,
          traitPowerMin:
            snapshot.traitPowerMin != null ? Number(snapshot.traitPowerMin) : null,
          traitPowerMax:
            snapshot.traitPowerMax != null ? Number(snapshot.traitPowerMax) : null,
          roundVarianceMax:
            snapshot.roundVarianceMax != null
              ? Number(snapshot.roundVarianceMax)
              : null,
          microMomentumMax:
            snapshot.microMomentumMax != null
              ? Number(snapshot.microMomentumMax)
              : null,
        }
      : null,
    queues,
    contracts: contractLinks,
  };
}