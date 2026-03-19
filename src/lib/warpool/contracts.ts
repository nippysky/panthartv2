// src/lib/warpool/contracts.ts
import { WARPOOL_ADDRESSES } from "./config";

export function getWarpoolAddresses() {
  if (!WARPOOL_ADDRESSES.config || !WARPOOL_ADDRESSES.core || !WARPOOL_ADDRESSES.lens) {
    throw new Error("Warpool contract addresses are not fully configured.");
  }

  return WARPOOL_ADDRESSES;
}