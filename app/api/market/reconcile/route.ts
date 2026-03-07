/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/reconcile/route.ts

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {prismaReady} from "@/src/lib/db";
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
  await prismaReady;

  const body = (await req.json().catch(() => null)) as ConfirmMarketInput | null;

  if (!body) {
    return json(400, { ok: false, error: "Invalid request body" });
  }

  const listing = await confirmListingTx(body);

  if (listing.ok) {
    return json(200, {
      ok: true,
      kind: "listing",
      reconciled: true,
      txHashCreated: body.txHashCreated,
      contract: body.contract,
      tokenId: body.tokenId,
      result: listing,
    });
  }

  const auction = await confirmAuctionTx(body);

  if (auction.ok) {
    return json(200, {
      ok: true,
      kind: "auction",
      reconciled: true,
      txHashCreated: body.txHashCreated,
      contract: body.contract,
      tokenId: body.tokenId,
      result: auction,
    });
  }

  /**
   * Reconcile should not mutate unrelated sale history.
   * Its job is to re-read chain truth and heal the DB row,
   * not delete marketplaceSale evidence and pray to the RPC goblins.
   */
  if (shouldTryOtherKind(listing.error) || shouldTryOtherKind(auction.error)) {
    const listingRetry = await confirmListingTx(body);
    if (listingRetry.ok) {
      return json(200, {
        ok: true,
        kind: "listing",
        reconciled: true,
        txHashCreated: body.txHashCreated,
        contract: body.contract,
        tokenId: body.tokenId,
        result: listingRetry,
      });
    }

    const auctionRetry = await confirmAuctionTx(body);
    if (auctionRetry.ok) {
      return json(200, {
        ok: true,
        kind: "auction",
        reconciled: true,
        txHashCreated: body.txHashCreated,
        contract: body.contract,
        tokenId: body.tokenId,
        result: auctionRetry,
      });
    }

    return json(400, {
      ok: false,
      error: auctionRetry.error || listingRetry.error || "Unable to reconcile marketplace transaction",
      listingError: listingRetry.error,
      listingStep: listingRetry.step,
      auctionError: auctionRetry.error,
      auctionStep: auctionRetry.step,
    });
  }

  return json(400, {
    ok: false,
    error: auction.error || listing.error || "Unable to reconcile marketplace transaction",
    listingError: listing.error,
    listingStep: listing.step,
    auctionError: auction.error,
    auctionStep: auction.step,
  });
}