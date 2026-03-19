// src/lib/warpool/config.ts
export const WARPOOL_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 5201420);

export const WARPOOL_ADDRESSES = {
  config: (process.env.NEXT_PUBLIC_WARPOOL_CONFIG_ADDRESS || "").toLowerCase(),
  core: (process.env.NEXT_PUBLIC_WARPOOL_CORE_ADDRESS || "").toLowerCase(),
  lens: (process.env.NEXT_PUBLIC_WARPOOL_LENS_ADDRESS || "").toLowerCase(),
} as const;

export const WARPOOL_QUEUE = {
  FORGE_SAFEGUARD: {
    slug: "FORGE_SAFEGUARD",
    tier: 1,
    mode: 1,
  },
  LEGION_SAFEGUARD: {
    slug: "LEGION_SAFEGUARD",
    tier: 2,
    mode: 1,
  },
  LEGION_VAULTBOUND: {
    slug: "LEGION_VAULTBOUND",
    tier: 2,
    mode: 2,
  },
  CROWN_VAULTBOUND: {
    slug: "CROWN_VAULTBOUND",
    tier: 3,
    mode: 2,
  },
} as const;

export type WarpoolQueueSlug = keyof typeof WARPOOL_QUEUE;