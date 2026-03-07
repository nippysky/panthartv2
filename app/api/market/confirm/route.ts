/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/confirm/route.ts

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  confirmAuctionTx,
  confirmListingTx,
  type ConfirmMarketInput,
} from "@/src/lib/market/confirm";

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

function shouldTryOtherKind(error?: string) {
  const msg = String(error || "").toLowerCase();

  return (
    msg.includes("listingcreated") ||
    msg.includes("auctioncreated") ||
    msg.includes("could not find listingcreated") ||
    msg.includes("auctioncreated event not found") ||
    msg.includes("could not find") ||
    msg.includes("event not found in receipt")
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ConfirmMarketInput | null;

  if (!body) {
    return json(400, { ok: false, error: "Invalid request body" });
  }

  const listing = await confirmListingTx(body);

  if (listing.ok) {
    return json(200, listing);
  }

  if (!shouldTryOtherKind(listing.error)) {
    return json(400, listing);
  }

  const auction = await confirmAuctionTx(body);

  if (auction.ok) {
    return json(200, auction);
  }

  return json(400, {
    ok: false,
    error: auction.error || listing.error || "Unable to confirm marketplace transaction",
    listingError: listing.error,
    listingStep: listing.step,
    auctionError: auction.error,
    auctionStep: auction.step,
  });
}