/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/auction/confirm/route.ts

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import prisma from "@/src/lib/db";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

function json(status: number, data: any) {
  return NextResponse.json(data, { status });
}

function sameAddr(a: string, b: string) {
  return (a || "").toLowerCase() === (b || "").toLowerCase();
}

function normAddr(a: string) {
  return ethers.getAddress(a);
}

const NATIVE_SYMBOL = process.env.NATIVE_SYMBOL || "ETN";
const NATIVE_DECIMALS = Number(process.env.NATIVE_DECIMALS || 18);

export async function POST(req: NextRequest) {
  let step = "start";

  try {
    step = "parse_body";
    const body = (await req.json().catch(() => null)) as
      | {
          txHashCreated?: string;
          contract?: string;
          tokenId?: string;
          account?: string;
        }
      | null;

    const txHashCreated = (body?.txHashCreated || "").trim();
    const contractRaw = (body?.contract || "").trim();
    const tokenId = (body?.tokenId || "").trim();

    if (!txHashCreated || !ethers.isHexString(txHashCreated, 32)) {
      return json(400, { ok: false, error: "Invalid txHashCreated" });
    }
    if (!contractRaw || !ethers.isAddress(contractRaw)) {
      return json(400, { ok: false, error: "Invalid contract" });
    }
    if (!tokenId) {
      return json(400, { ok: false, error: "Invalid tokenId" });
    }

    const contract = normAddr(contractRaw);

    step = "env";
    const RPC_HTTP_URL =
      process.env.RPC_HTTP_URL ||
      process.env.RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_HTTP_URL ||
      "https://rpc.ankr.com/electroneum";

    const MARKETPLACE_ADDR =
      process.env.MARKETPLACE_CORE_ADDRESS ||
      process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS ||
      process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
      "";

    if (!MARKETPLACE_ADDR || !ethers.isAddress(MARKETPLACE_ADDR)) {
      return json(500, {
        ok: false,
        error: "Missing MARKETPLACE_CORE_ADDRESS",
      });
    }

    const marketplaceAddr = normAddr(MARKETPLACE_ADDR);

    step = "ethers_setup";
    const provider = new ethers.JsonRpcProvider(RPC_HTTP_URL);
    const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
    const mkt = new ethers.Contract(
      marketplaceAddr,
      MARKETPLACE_CORE_ABI as any,
      provider
    );

    step = "receipt";
    const receipt = await provider.getTransactionReceipt(txHashCreated);
    if (!receipt) {
      return json(404, { ok: false, error: "Transaction receipt not found yet" });
    }
    if (receipt.status !== 1) {
      return json(409, { ok: false, error: "Transaction failed on-chain" });
    }

    step = "decode_event";
    let auctionId: bigint | null = null;

    for (const lg of receipt.logs || []) {
      if (!lg?.address || !ethers.isAddress(lg.address)) continue;
      if (!sameAddr(lg.address, marketplaceAddr)) continue;

      try {
        const parsed = iface.parseLog({
          topics: lg.topics as string[],
          data: lg.data as string,
        });

        if (!parsed || parsed.name !== "AuctionCreated") continue;

        const tokenAddr =
          (parsed.args?.token ?? parsed.args?.collection ?? "")?.toString?.() ?? "";
        const tokenAddrNorm = ethers.isAddress(tokenAddr)
          ? normAddr(tokenAddr)
          : "";

        const tIdRaw = parsed.args?.tokenId ?? null;
        const tokenIdOnchain =
          typeof tIdRaw === "bigint"
            ? tIdRaw
            : tIdRaw != null
            ? BigInt(tIdRaw.toString())
            : null;

        if (!tokenAddrNorm || !sameAddr(tokenAddrNorm, contract)) continue;
        if (!tokenIdOnchain) continue;
        if (tokenIdOnchain.toString() !== tokenId) continue;

        const idRaw = parsed.args?.auctionId ?? null;
        if (!idRaw) continue;

        auctionId =
          typeof idRaw === "bigint" ? idRaw : BigInt(idRaw.toString());
        break;
      } catch {
        continue;
      }
    }

    if (!auctionId) {
      return json(422, {
        ok: false,
        error: "AuctionCreated event not found in receipt",
      });
    }

    step = "read_chain_state";
    const A = await mkt.auctions(auctionId);

    const seller = normAddr(A[0]);
    const token = normAddr(A[1]);
    const tokenIdChain = (A[2] as bigint).toString();
    const quantity = A[3] as bigint;
    const currencyRaw = A[5] as string;
    const startPrice = A[6] as bigint;
    const minIncrement = A[7] as bigint;
    const startTimeSec = Number(A[8]);
    const endTimeSec = Number(A[9]);
    const highestBidderRaw = A[10] as string;
    const highestBid = A[11] as bigint;
    const bidsCount = Number(A[12]);
    const settled = Boolean(A[13]);

    if (!sameAddr(token, contract) || tokenIdChain !== tokenId) {
      return json(409, {
        ok: false,
        error: "On-chain auction does not match NFT",
      });
    }

    const highestBidder =
      highestBidderRaw &&
      ethers.isAddress(highestBidderRaw) &&
      !sameAddr(highestBidderRaw, ethers.ZeroAddress)
        ? normAddr(highestBidderRaw)
        : null;

    step = "find_nft";
    const nft = await prisma.nFT.findFirst({
      where: { contract, tokenId },
      select: { id: true },
    });

    if (!nft?.id) {
      return json(404, { ok: false, error: "NFT not found in DB yet" });
    }

    step = "currency";
    const currency =
      ethers.isAddress(currencyRaw) && !sameAddr(currencyRaw, ethers.ZeroAddress)
        ? normAddr(currencyRaw)
        : ethers.ZeroAddress;

    const isNative = sameAddr(currency, ethers.ZeroAddress);
    let currencyId: string | null = null;

    if (isNative) {
      const existingNative = await prisma.currency.findFirst({
        where: { kind: "NATIVE", tokenAddress: null, symbol: NATIVE_SYMBOL },
        select: { id: true },
      });

      currencyId =
        existingNative?.id ??
        (
          await prisma.currency.create({
            data: {
              symbol: NATIVE_SYMBOL,
              decimals: NATIVE_DECIMALS,
              kind: "NATIVE",
              tokenAddress: null,
              active: true,
            },
            select: { id: true },
          })
        ).id;
    } else {
      const existing = await prisma.currency.findFirst({
        where: { tokenAddress: currency },
        select: { id: true },
      });

      currencyId =
        existing?.id ??
        (
          await prisma.currency.create({
            data: {
              symbol: "TOKEN",
              decimals: 18,
              kind: "ERC20",
              tokenAddress: currency,
              active: true,
            },
            select: { id: true },
          })
        ).id;
    }

    step = "status";
    const nowSec = Math.floor(Date.now() / 1000);
    const endedByTime = endTimeSec > 0 && nowSec > endTimeSec;

    let computedStatus: "ACTIVE" | "ENDED" | "CANCELLED" = "ACTIVE";
    if (settled) computedStatus = "ENDED";
    else if (endedByTime) computedStatus = "ENDED";

    const existingAuction = await prisma.auction.findFirst({
      where: {
        OR: [
          { txHashCreated: txHashCreated.toLowerCase() },
          { nftId: nft.id, sellerAddress: seller, status: "ACTIVE" },
        ],
      },
      select: { id: true, status: true },
    });

    const terminal = new Set(["ENDED", "CANCELLED"]);
    const finalStatus =
      existingAuction?.status && terminal.has(existingAuction.status)
        ? existingAuction.status
        : computedStatus;

    step = "upsert";

    const qtyNum =
      quantity > BigInt(Number.MAX_SAFE_INTEGER)
        ? Number.MAX_SAFE_INTEGER
        : Number(quantity);

    const data = {
      nftId: nft.id,
      sellerAddress: seller,
      quantity: qtyNum,
      currencyId,
      startTime: new Date(startTimeSec * 1000),
      endTime: new Date(endTimeSec * 1000),
      txHashCreated: txHashCreated.toLowerCase(),
      status: finalStatus,
      highestBidder,
      startPriceEtnWei: isNative ? startPrice.toString() : "0",
      startPriceTokenAmount: isNative ? null : startPrice.toString(),
      minIncrementEtnWei: isNative ? minIncrement.toString() : null,
      minIncrementTokenAmount: isNative ? null : minIncrement.toString(),
      highestBidEtnWei: isNative ? highestBid.toString() : null,
      highestBidTokenAmount: isNative ? null : highestBid.toString(),
    };

    const dbRow = existingAuction?.id
      ? await prisma.auction.update({
          where: { id: existingAuction.id },
          data,
          select: { id: true },
        })
      : await prisma.auction.create({
          data,
          select: { id: true },
        });

    return json(200, {
      ok: true,
      auctionId: auctionId.toString(),
      dbId: dbRow.id,
      status: finalStatus,
      bidsCount,
      settled,
    });
  } catch (e: any) {
    console.error("[auction/confirm] FAIL", { step, message: e?.message });
    return json(500, { ok: false, error: e?.message || "Unknown error", step });
  }
}