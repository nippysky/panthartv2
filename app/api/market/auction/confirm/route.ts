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
  // ✅ Always checksum; never lowercase
  return ethers.getAddress(a);
}

// Canonical native currency config (no schema changes)
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
    const accountRaw = (body?.account || "").trim();

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
    const account =
      accountRaw && ethers.isAddress(accountRaw) ? normAddr(accountRaw) : "";

    step = "env";
    const RPC_HTTP_URL =
      process.env.RPC_HTTP_URL ||
      process.env.RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_HTTP_URL ||
      "https://rpc.ankr.com/electroneum";

    const MARKETPLACE_ADDR =
      process.env.MARKETPLACE_CORE_ADDRESS ||
      process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ||
      "";

    if (!MARKETPLACE_ADDR || !ethers.isAddress(MARKETPLACE_ADDR)) {
      return json(500, {
        ok: false,
        error:
          "Missing MARKETPLACE_CORE_ADDRESS (or NEXT_PUBLIC_MARKETPLACE_ADDRESS) on server env",
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

    step = "get_receipt";
    const receipt = await provider.getTransactionReceipt(txHashCreated);
    if (!receipt) {
      return json(404, { ok: false, error: "Transaction receipt not found yet" });
    }
    if (receipt.status !== 1) {
      return json(409, { ok: false, error: "Transaction failed on-chain" });
    }

    step = "optional_sender_check";
    if (account) {
      const tx = await provider.getTransaction(txHashCreated).catch(() => null);
      const from = tx?.from && ethers.isAddress(tx.from) ? normAddr(tx.from) : "";
      if (from && !sameAddr(from, account)) {
        console.warn("[auction/confirm] tx.from mismatch", { from, account });
      }
    }

    step = "decode_auction_created";
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
        const tokenAddrNorm = ethers.isAddress(tokenAddr) ? normAddr(tokenAddr) : "";

        const tIdRaw = parsed.args?.tokenId ?? null;
        const tokenIdOnchain =
          typeof tIdRaw === "bigint"
            ? tIdRaw
            : tIdRaw != null
            ? BigInt(tIdRaw.toString())
            : null;

        if (!tokenAddrNorm || !sameAddr(tokenAddrNorm, contract)) continue;
        if (tokenIdOnchain == null) continue;
        if (tokenIdOnchain.toString() !== tokenId) continue;

        const idRaw = parsed.args?.auctionId ?? null;
        if (idRaw == null) continue;

        auctionId = typeof idRaw === "bigint" ? idRaw : BigInt(idRaw.toString());
        break;
      } catch {
        // ignore unrelated logs
      }
    }

    if (auctionId == null) {
      return json(422, {
        ok: false,
        error: "Could not find AuctionCreated log for this NFT in tx receipt",
      });
    }

    step = "read_auction_state";
    // auctions(auctionId) => (seller, token, tokenId, quantity, standard, currency, startPrice, minIncrement, startTime, endTime, highestBidder, highestBid, bidsCount, settled)
    const A = await mkt.auctions(auctionId);

    const sellerRaw = (A?.[0] as string) ?? ethers.ZeroAddress;
    const tokenRaw = (A?.[1] as string) ?? ethers.ZeroAddress;
    const tokenIdChain = (A?.[2] as bigint) ?? BigInt(0);
    const quantity = (A?.[3] as bigint) ?? BigInt(1);
    const currencyRaw = (A?.[5] as string) ?? ethers.ZeroAddress;
    const startPrice = (A?.[6] as bigint) ?? BigInt(0);
    const minIncrement = (A?.[7] as bigint) ?? BigInt(0);
    const startTimeSec = Number(A?.[8] as any) || 0;
    const endTimeSec = Number(A?.[9] as any) || 0;
    const highestBidderRaw = (A?.[10] as string) ?? ethers.ZeroAddress;
    const highestBid = (A?.[11] as bigint) ?? BigInt(0);
    const bidsCount = Number(A?.[12] as any) || 0;
    const settled = Boolean(A?.[13]);

    const seller = ethers.isAddress(sellerRaw) ? normAddr(sellerRaw) : sellerRaw;
    const token = ethers.isAddress(tokenRaw) ? normAddr(tokenRaw) : tokenRaw;
    const currency = ethers.isAddress(currencyRaw) ? normAddr(currencyRaw) : currencyRaw;
    const highestBidder =
      highestBidderRaw &&
      ethers.isAddress(highestBidderRaw) &&
      !sameAddr(highestBidderRaw, ethers.ZeroAddress)
        ? normAddr(highestBidderRaw)
        : null;

    if (!sameAddr(token, contract) || tokenIdChain.toString() !== tokenId) {
      return json(409, {
        ok: false,
        error: "Auction state does not match requested NFT",
      });
    }

    step = "find_nft_in_db";
    const nft = await prisma.nFT.findFirst({
      where: { contract, tokenId },
      select: { id: true },
    });

    if (!nft?.id) {
      return json(404, { ok: false, error: "NFT not found in DB yet" });
    }

    step = "resolve_currency";
    const isNative = sameAddr(currency, ethers.ZeroAddress);
    let currencyId: string | null = null;

    if (isNative) {
      // ✅ match listing confirm behavior: native => currencyId points to Currency(kind=NATIVE)
      const existingNative = await prisma.currency
        .findFirst({
          where: { kind: "NATIVE", tokenAddress: null, symbol: NATIVE_SYMBOL },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
        .catch(() => null);

      if (existingNative?.id) {
        currencyId = existingNative.id;
      } else {
        const createdNative = await prisma.currency
          .create({
            data: {
              symbol: NATIVE_SYMBOL,
              decimals: NATIVE_DECIMALS,
              kind: "NATIVE",
              tokenAddress: null,
              active: true,
            },
            select: { id: true },
          })
          .catch(() => null);

        currencyId = createdNative?.id ?? null;
      }
    } else {
      const tokenAddress = normAddr(currency);

      const existing = await prisma.currency
        .findFirst({
          where: { tokenAddress },
          select: { id: true },
        })
        .catch(() => null);

      if (existing?.id) {
        currencyId = existing.id;
      } else {
        let decimals = 18;
        let symbol = "TOKEN";
        try {
          const erc20 = new ethers.Contract(
            tokenAddress,
            ["function decimals() view returns (uint8)", "function symbol() view returns (string)"],
            provider
          );
          decimals = Number(await erc20.decimals().catch(() => 18));
          symbol = String(await erc20.symbol().catch(() => "TOKEN"));
        } catch {
          // keep defaults
        }

        const created = await prisma.currency
          .create({
            data: {
              symbol,
              decimals,
              kind: "ERC20",
              tokenAddress,
              active: true,
            },
            select: { id: true },
          })
          .catch(() => null);

        currencyId = created?.id ?? null;
      }
    }

    step = "status_compute";
    const nowSec = Math.floor(Date.now() / 1000);

    const startDt = startTimeSec ? new Date(startTimeSec * 1000) : new Date();
    const endDt = endTimeSec ? new Date(endTimeSec * 1000) : new Date();

    const scheduled = startTimeSec > 0 && startTimeSec > nowSec;
    const endedByTime = endTimeSec > 0 && nowSec > endTimeSec;

    const txHashNorm = txHashCreated.toLowerCase();

    // Prefer match by txHashCreated, fallback to nftId+seller ACTIVE
    const existingAuction = await prisma.auction.findFirst({
      where: {
        OR: [
          { txHashCreated: txHashNorm },
          { nftId: nft.id, sellerAddress: seller, status: "ACTIVE" },
        ],
      },
      select: { id: true, status: true, txHashFinalized: true, txHashCancelled: true },
    });

    // Compute status:
    // - settled => ENDED
    // - if ended by time => ENDED (auction is over even if not settled yet)
    // - else ACTIVE (even if scheduled)
    let computedStatus: "ACTIVE" | "CANCELLED" | "ENDED" = "ACTIVE";

    if (settled) computedStatus = "ENDED";
    else if (endedByTime) computedStatus = "ENDED";
    else computedStatus = "ACTIVE";

    // Never downgrade terminal states
    const terminal = new Set<"ENDED" | "CANCELLED">(["ENDED", "CANCELLED"]);
    const finalStatus =
      existingAuction?.status && terminal.has(existingAuction.status as any)
        ? (existingAuction.status as any)
        : computedStatus;

    step = "upsert_auction_row";
    const data: any = {
      nftId: nft.id,
      sellerAddress: seller,
      quantity: Number(quantity || BigInt(1)),
      currencyId, // ✅ native now points to Currency(kind=NATIVE)
      startTime: startDt,
      endTime: endDt,
      txHashCreated: txHashNorm,
      status: finalStatus,
      highestBidder,

      // amounts: keep the same columns (finalizer decides native via currency.kind)
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
      currencyId,
      isNative,
      currencyOnchain: currency,
      scheduled,
      startTime: startDt.toISOString(),
      endTime: endDt.toISOString(),
      bidsCount,
      settled,
    });
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Unknown error";
    console.error("[api/market/auction/confirm] FAIL", { step, msg, stack: e?.stack });
    return json(500, { ok: false, error: msg, step });
  }
}
