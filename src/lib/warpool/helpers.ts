// src/lib/warpool/helpers.ts
import { keccak256, solidityPacked } from "ethers";
import { WARPOOL_QUEUE, type WarpoolQueueSlug } from "./config";

export function makeQueueKey(tier: number, mode: number): string {
  return keccak256(solidityPacked(["uint8", "uint8"], [tier, mode])).toLowerCase();
}

export function getQueueBySlug(slug: WarpoolQueueSlug) {
  return WARPOOL_QUEUE[slug];
}

export function getQueueKeyBySlug(slug: WarpoolQueueSlug): string {
  const q = getQueueBySlug(slug);
  return makeQueueKey(q.tier, q.mode);
}

export function getQueueSlugFromTierMode(tier: number, mode: number): WarpoolQueueSlug | null {
  const entries = Object.entries(WARPOOL_QUEUE) as Array<
    [WarpoolQueueSlug, { slug: string; tier: number; mode: number }]
  >;

  for (const [slug, q] of entries) {
    if (q.tier === tier && q.mode === mode) return slug;
  }

  return null;
}

export function lower(value?: string | null): string | null {
  return value ? value.toLowerCase() : null;
}