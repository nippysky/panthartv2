/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const RPC_HTTP_URL =
  process.env.RPC_HTTP_URL ||
  process.env.RPC_URL ||
  "https://rpc.ankr.com/electroneum";

const MARKETPLACE_ADDR =
  process.env.MARKETPLACE_CORE_ADDRESS ||
  process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS ||
  "";

if (!MARKETPLACE_ADDR) {
  throw new Error("MARKETPLACE_CORE_ADDRESS (or NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS) is required");
}

// Minimal read ABI (keeps server lean)
const MARKETPLACE_READ_ABI = [
  "function activeListingForToken(address collection, uint256 tokenId) view returns (uint256)",
  "function activeAuctionForToken(address collection, uint256 tokenId) view returns (uint256)",
  "function listings(uint256) view returns (address seller,address token,uint256 tokenId,uint256 quantity,uint8 standard,address currency,uint256 price,uint64 startTime,uint64 endTime,bool active)",
  "function auctions(uint256) view returns (address seller,address token,uint256 tokenId,uint256 quantity,uint8 standard,address currency,uint256 startPrice,uint256 minIncrement,uint64 startTime,uint64 endTime,address highestBidder,uint256 highestBid,uint32 bidsCount,bool settled)",
] as const;

function asLower(s: string) {
  return (s || "").toLowerCase();
}

async function chainNowSec(provider: ethers.JsonRpcProvider) {
  const b = await provider.getBlock("latest");
  return Number(b?.timestamp || Math.floor(Date.now() / 1000));
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const contract = url.searchParams.get("contract") || "";
    const tokenIdRaw = url.searchParams.get("tokenId") || "";
    const standard = (url.searchParams.get("standard") || "ERC721").toUpperCase();

    if (!contract || !tokenIdRaw) {
      return NextResponse.json(
        { error: "Missing contract or tokenId" },
        { status: 400 }
      );
    }

    const tokenId = BigInt(tokenIdRaw);
    const provider = new ethers.JsonRpcProvider(RPC_HTTP_URL);
    const mkt = new ethers.Contract(MARKETPLACE_ADDR, MARKETPLACE_READ_ABI, provider);

    // Escrow truth is on-chain. For ERC721 we can reliably use activeListingForToken/activeAuctionForToken.
    // For ERC1155, there can be multiple sellers; this endpoint focuses on ERC721 detail pages.
    const now = await chainNowSec(provider);

    let listing: any = null;
    let auction: any = null;

    if (standard === "ERC721") {
      const listingId = BigInt(await mkt.activeListingForToken(contract, tokenId));
      if (listingId > BigInt(0)) {
        const L = await mkt.listings(listingId);
        // sanity: must match token + active
        const ok =
          Boolean(L.active) &&
          asLower(L.token) === asLower(contract) &&
          BigInt(L.tokenId) === tokenId;

        if (ok) {
          listing = {
            id: listingId.toString(),
            sellerAddress: String(L.seller),
            currencyAddress: String(L.currency),
            price: String(L.price),
            quantity: Number(L.quantity),
            startTime: Number(L.startTime),
            endTime: Number(L.endTime),
            standard: "ERC721",
            // convenient flags
            isLive:
              now >= Number(L.startTime) &&
              (Number(L.endTime) === 0 || now <= Number(L.endTime)),
          };
        }
      }

      const auctionId = BigInt(await mkt.activeAuctionForToken(contract, tokenId));
      if (auctionId > BigInt(0)) {
        const A = await mkt.auctions(auctionId);
        const ok =
          !Boolean(A.settled) &&
          asLower(A.token) === asLower(contract) &&
          BigInt(A.tokenId) === tokenId;

        if (ok) {
          auction = {
            id: auctionId.toString(),
            sellerAddress: String(A.seller),
            currencyAddress: String(A.currency),
            startPrice: String(A.startPrice),
            minIncrement: String(A.minIncrement),
            startTime: Number(A.startTime),
            endTime: Number(A.endTime),
            highestBidder: String(A.highestBidder),
            highestBid: String(A.highestBid),
            bidsCount: Number(A.bidsCount),
            settled: Boolean(A.settled),
            standard: "ERC721",
            isLive: now >= Number(A.startTime) && now <= Number(A.endTime),
            isEnded: now > Number(A.endTime),
          };
        }
      }
    }

    return NextResponse.json({
      ok: true,
      marketplace: MARKETPLACE_ADDR,
      now,
      listing,
      auction,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
