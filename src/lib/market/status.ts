// src/lib/market/status.ts

export type ListingStatus = "ACTIVE" | "CANCELLED" | "SOLD" | "EXPIRED";
export type AuctionStatus = "ACTIVE" | "ENDED" | "CANCELLED";

type ListingStatusInput = {
  active: boolean;
  scheduled: boolean;
  expiredByTime: boolean;
  soldEvidence: boolean;
  existingStatus?: string | null;
};

type AuctionStatusInput = {
  settled: boolean;
  endedByTime: boolean;
  existingStatus?: string | null;
};

export function computeListingStatus(input: ListingStatusInput): ListingStatus {
  /**
   * Source of truth order:
   * 1. If chain says active now (or scheduled), it is ACTIVE.
   * 2. SOLD only when we have exact evidence for this specific listing.
   * 3. If time has elapsed, it is EXPIRED.
   * 4. Otherwise CANCELLED.
   *
   * Important:
   * We do NOT blindly preserve an old SOLD status, because a previously
   * mis-written DB row must be able to heal back to ACTIVE when on-chain
   * state proves it is live.
   */
  if (input.active || input.scheduled) {
    return "ACTIVE";
  }

  if (input.soldEvidence) {
    return "SOLD";
  }

  if (input.expiredByTime || input.existingStatus === "EXPIRED") {
    return "EXPIRED";
  }

  if (input.existingStatus === "CANCELLED") {
    return "CANCELLED";
  }

  return "CANCELLED";
}

export function computeAuctionStatus(input: AuctionStatusInput): AuctionStatus {
  /**
   * Auctions are simpler:
   * - settled or ended-by-time => ENDED
   * - explicit prior CANCELLED stays CANCELLED
   * - otherwise ACTIVE
   */
  if (input.settled || input.endedByTime || input.existingStatus === "ENDED") {
    return "ENDED";
  }

  if (input.existingStatus === "CANCELLED") {
    return "CANCELLED";
  }

  return "ACTIVE";
}