/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ethers } from "ethers";
import prisma, { prismaReady } from "@/src/lib/db";

function getRpcUrl() {
  return (
    process.env.ETN_RPC_URL ||
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    ""
  );
}

function normAddr(a: string) {
  return ethers.getAddress(a);
}

type SyncBody =
  | {
      type: "LISTING_CREATE";
      nftId: string;
      sellerAddress: string;
      quantity: number;
      currencyId: string; // "native" or Currency.id
      priceWei: string; // wei string (native) or token units (erc20)
      startTimeIso: string; // ISO datetime for DB
      endTimeIso?: string | null;
      txHash: string;
    }
  | {
      type: "LISTING_CANCEL";
      nftId: string;
      sellerAddress: string;
      txHash: string;
    }
  | {
      type: "AUCTION_CREATE";
      nftId: string;
      sellerAddress: string;
      quantity: number;
      currencyId: string;
      startPriceWei: string;
      minIncrementWei: string;
      startTimeIso: string;
      endTimeIso: string;
      txHash: string;
    }
  | {
      type: "AUCTION_BID";
      nftId: string;
      bidderAddress: string;
      amountWei: string;
      currencyId: string;
      txHash: string;
      blockNumber?: number;
      timestampIso?: string;
    }
  | {
      type: "AUCTION_CANCEL";
      nftId: string;
      sellerAddress: string;
      txHash: string;
    }
  | {
      type: "AUCTION_FINALIZE";
      nftId: string;
      txHash: string;
      winnerAddress?: string | null;
      priceWei?: string | null;
      currencyId?: string | null;
      timestampIso?: string;
    };

async function assertTxSuccess(txHash: string) {
  const rpcUrl = getRpcUrl();
  if (!rpcUrl) throw new Error("Missing RPC url env (ETN_RPC_URL/RPC_URL)");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== BigInt(1)) throw new Error("Tx not confirmed/success");
  return receipt;
}

export async function POST(req: Request) {
  await prismaReady;

  const body = (await req.json().catch(() => null)) as SyncBody | null;
  if (!body?.type) {
    return NextResponse.json({ error: "Missing body.type" }, { status: 400 });
  }

  try {
    // verify on-chain success so nobody can spoof DB updates
    await assertTxSuccess(body.txHash);

    if (body.type === "LISTING_CREATE") {
      const seller = normAddr(body.sellerAddress);

      const existing = await prisma.marketplaceListing.findFirst({
        where: { nftId: body.nftId, sellerAddress: seller, status: "ACTIVE" },
        select: { id: true },
      });

      const isNative = body.currencyId === "native";

      if (existing) {
        await prisma.marketplaceListing.update({
          where: { id: existing.id },
          data: {
            quantity: body.quantity,
            currencyId: isNative ? null : body.currencyId,
            priceEtnWei: isNative ? body.priceWei : "0",
            priceTokenAmount: isNative ? null : body.priceWei,
            startTime: new Date(body.startTimeIso),
            endTime: body.endTimeIso ? new Date(body.endTimeIso) : null,
            txHashCreated: body.txHash,
            status: "ACTIVE",
          },
        });
      } else {
        await prisma.marketplaceListing.create({
          data: {
            nftId: body.nftId,
            sellerAddress: seller,
            quantity: body.quantity,
            currencyId: isNative ? null : body.currencyId,
            priceEtnWei: isNative ? body.priceWei : "0",
            priceTokenAmount: isNative ? null : body.priceWei,
            startTime: new Date(body.startTimeIso),
            endTime: body.endTimeIso ? new Date(body.endTimeIso) : null,
            txHashCreated: body.txHash,
            status: "ACTIVE",
          },
        });
      }
    }

    if (body.type === "LISTING_CANCEL") {
      const seller = normAddr(body.sellerAddress);
      await prisma.marketplaceListing.updateMany({
        where: { nftId: body.nftId, sellerAddress: seller, status: "ACTIVE" },
        data: { status: "CANCELLED", txHashCancelled: body.txHash },
      });
    }

    if (body.type === "AUCTION_CREATE") {
      const seller = normAddr(body.sellerAddress);
      const existing = await prisma.auction.findFirst({
        where: { nftId: body.nftId, sellerAddress: seller, status: "ACTIVE" },
        select: { id: true },
      });

      const isNative = body.currencyId === "native";

      const data = {
        sellerAddress: seller,
        nftId: body.nftId,
        quantity: body.quantity,
        currencyId: isNative ? null : body.currencyId,
        startPriceEtnWei: isNative ? body.startPriceWei : "0",
        minIncrementEtnWei: isNative ? body.minIncrementWei : null,
        startPriceTokenAmount: isNative ? null : body.startPriceWei,
        minIncrementTokenAmount: isNative ? null : body.minIncrementWei,
        startTime: new Date(body.startTimeIso),
        endTime: new Date(body.endTimeIso),
        txHashCreated: body.txHash,
        status: "ACTIVE" as const,
      };

      if (existing) await prisma.auction.update({ where: { id: existing.id }, data });
      else await prisma.auction.create({ data });
    }

    if (body.type === "AUCTION_BID") {
      const bidder = normAddr(body.bidderAddress);
      const ts = body.timestampIso ? new Date(body.timestampIso) : new Date();

      // create bid row (best-effort: blockNumber/logIndex usually from indexer, but txHash unique+logIndex)
      // we can safely set logIndex=0 here; indexer will later insert the real ones, but this gives instant UI feedback.
      await prisma.auctionBid.create({
        data: {
          auctionId: (await prisma.auction.findFirstOrThrow({
            where: { nftId: body.nftId, status: "ACTIVE" },
            select: { id: true },
          })).id,
          bidderAddress: bidder,
          amountWei: body.amountWei,
          currencyId: body.currencyId === "native" ? null : body.currencyId,
          txHash: body.txHash,
          logIndex: 0,
          blockNumber: body.blockNumber ?? 0,
          timestamp: ts,
        },
      });

      // update auction top bid quickly
      await prisma.auction.updateMany({
        where: { nftId: body.nftId, status: "ACTIVE" },
        data: {
          highestBidder: bidder,
          highestBidEtnWei: body.currencyId === "native" ? body.amountWei : null,
          highestBidTokenAmount: body.currencyId === "native" ? null : body.amountWei,
        },
      });
    }

    if (body.type === "AUCTION_CANCEL") {
      const seller = normAddr(body.sellerAddress);
      await prisma.auction.updateMany({
        where: { nftId: body.nftId, sellerAddress: seller, status: "ACTIVE" },
        data: { status: "CANCELLED", txHashCancelled: body.txHash },
      });
    }

    if (body.type === "AUCTION_FINALIZE") {
      await prisma.auction.updateMany({
        where: { nftId: body.nftId, status: "ACTIVE" },
        data: { status: "ENDED", txHashFinalized: body.txHash },
      });
    }

    const resp = NextResponse.json({ ok: true }, { status: 200 });
    resp.headers.set("Cache-Control", "no-store");
    return resp;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "sync failed" }, { status: 500 });
  }
}
