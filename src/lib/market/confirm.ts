/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/market/confirm.ts

import { ethers } from "ethers";
import prisma from "@/src/lib/db";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";
import {
  computeAuctionStatus,
  computeListingStatus,
  type AuctionStatus,
  type ListingStatus,
} from "@/src/lib/market/status";

export type ConfirmMarketInput = {
  txHashCreated: string;
  contract: string;
  tokenId: string;
  account?: string | null;
  sellerAddress?: string | null;
  quantity?: number | null;
  standard?: string | null;
};

type ConfirmFail = {
  ok: false;
  error: string;
  step?: string;
};

type ConfirmListingOk = {
  ok: true;
  kind: "listing";
  listingId: string;
  dbId: string;
  status: ListingStatus;
  currencyId: string | null;
  isNative: boolean;
  currencyOnchain: string;
  sellerAddress: string;
  quantity: number;
  scheduled: boolean;
  startTime: string;
  endTime: string | null;
};

type ConfirmAuctionOk = {
  ok: true;
  kind: "auction";
  auctionId: string;
  dbId: string;
  status: AuctionStatus;
  bidsCount: number;
  settled: boolean;
  sellerAddress: string;
  quantity: number;
  currencyId: string | null;
  isNative: boolean;
  currencyOnchain: string;
  startTime: string;
  endTime: string;
};

export type ConfirmMarketResult = ConfirmFail | ConfirmListingOk | ConfirmAuctionOk;

function sameAddr(a?: string | null, b?: string | null) {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

function normAddr(a: string) {
  return ethers.getAddress(a);
}

const NATIVE_SYMBOL = process.env.NATIVE_SYMBOL || "ETN";
const NATIVE_DECIMALS = Number(process.env.NATIVE_DECIMALS || 18);

function getRpcUrl() {
  return (
    process.env.RPC_HTTP_URL ||
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_HTTP_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://rpc.ankr.com/electroneum"
  );
}

function getMarketplaceAddress(): `0x${string}` {
  const addr =
    process.env.MARKETPLACE_CORE_ADDRESS ||
    process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ABI ||
    process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS ||
    process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;

  if (!addr || !ethers.isAddress(addr)) {
    throw new Error(
      "Missing MARKETPLACE_CORE_ADDRESS / NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS / NEXT_PUBLIC_MARKETPLACE_ADDRESS"
    );
  }

  return normAddr(addr) as `0x${string}`;
}

async function resolveCurrencyId(args: {
  provider: ethers.JsonRpcProvider;
  currencyRaw: string;
}) {
  const currency =
    ethers.isAddress(args.currencyRaw) && !sameAddr(args.currencyRaw, ethers.ZeroAddress)
      ? normAddr(args.currencyRaw)
      : ethers.ZeroAddress;

  const isNative = sameAddr(currency, ethers.ZeroAddress);

  if (isNative) {
    const existingNative = await prisma.currency
      .findFirst({
        where: {
          kind: "NATIVE",
          tokenAddress: null,
          symbol: NATIVE_SYMBOL,
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
      .catch(() => null);

    if (existingNative?.id) {
      return { currencyId: existingNative.id, isNative, currencyAddress: currency };
    }

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

    return {
      currencyId: createdNative?.id ?? null,
      isNative,
      currencyAddress: currency,
    };
  }

  const existing = await prisma.currency
    .findFirst({
      where: { tokenAddress: currency },
      select: { id: true },
    })
    .catch(() => null);

  if (existing?.id) {
    return { currencyId: existing.id, isNative, currencyAddress: currency };
  }

  let decimals = 18;
  let symbol = "TOKEN";

  try {
    const erc20 = new ethers.Contract(
      currency,
      ["function decimals() view returns (uint8)", "function symbol() view returns (string)"],
      args.provider
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
        tokenAddress: currency,
        active: true,
      },
      select: { id: true },
    })
    .catch(() => null);

  return {
    currencyId: created?.id ?? null,
    isNative,
    currencyAddress: currency,
  };
}

export async function confirmListingTx(input: ConfirmMarketInput): Promise<ConfirmMarketResult> {
  let step = "start";

  try {
    step = "parse_input";
    const txHashCreated = String(input.txHashCreated || "").trim();
    const contractRaw = String(input.contract || "").trim();
    const tokenId = String(input.tokenId || "").trim();
    const accountRaw = String(input.account || "").trim();
    const sellerAddressRaw = String(input.sellerAddress || input.account || "").trim();

    if (!txHashCreated || !ethers.isHexString(txHashCreated, 32)) {
      return { ok: false, error: "Invalid txHashCreated", step };
    }
    if (!contractRaw || !ethers.isAddress(contractRaw)) {
      return { ok: false, error: "Invalid contract", step };
    }
    if (!tokenId) {
      return { ok: false, error: "Invalid tokenId", step };
    }

    const contract = normAddr(contractRaw);
    const account = accountRaw && ethers.isAddress(accountRaw) ? normAddr(accountRaw) : "";
    const sellerAddressHint =
      sellerAddressRaw && ethers.isAddress(sellerAddressRaw) ? normAddr(sellerAddressRaw) : null;

    step = "setup_provider";
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const marketplaceAddr = getMarketplaceAddress();
    const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
    const mkt = new ethers.Contract(marketplaceAddr, MARKETPLACE_CORE_ABI as any, provider);

    step = "get_receipt";
    const receipt = await provider.getTransactionReceipt(txHashCreated);
    if (!receipt) {
      return { ok: false, error: "Transaction receipt not found yet", step };
    }
    if (receipt.status !== 1) {
      return { ok: false, error: "Transaction failed on-chain", step };
    }

    step = "optional_sender_check";
    if (account) {
      const tx = await provider.getTransaction(txHashCreated).catch(() => null);
      const from = tx?.from && ethers.isAddress(tx.from) ? normAddr(tx.from) : "";
      if (from && !sameAddr(from, account)) {
        console.warn("[listing/confirm] tx.from mismatch", { from, account });
      }
    }

    step = "decode_listing_created";
    let listingId: bigint | null = null;

    for (const lg of receipt.logs || []) {
      if (!lg?.address || !ethers.isAddress(lg.address)) continue;
      if (!sameAddr(lg.address, marketplaceAddr)) continue;

      try {
        const parsed = iface.parseLog({
          topics: lg.topics as string[],
          data: lg.data as string,
        });
        if (!parsed || parsed.name !== "ListingCreated") continue;

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

        const idRaw = parsed.args?.listingId ?? null;
        if (idRaw == null) continue;

        listingId = typeof idRaw === "bigint" ? idRaw : BigInt(idRaw.toString());
        break;
      } catch {
        // ignore unrelated logs
      }
    }

    if (listingId == null) {
      return {
        ok: false,
        error: "Could not find ListingCreated log for this NFT in tx receipt",
        step,
      };
    }

    step = "read_listing_state";
    const L = await mkt.listings(listingId);

    const sellerRaw = (L?.[0] as string) ?? ethers.ZeroAddress;
    const tokenRaw = (L?.[1] as string) ?? ethers.ZeroAddress;
    const tokenIdChain = (L?.[2] as bigint) ?? BigInt(0);
    const quantity = (L?.[3] as bigint) ?? BigInt(1);
    const currencyRaw = (L?.[5] as string) ?? ethers.ZeroAddress;
    const price = (L?.[6] as bigint) ?? BigInt(0);
    const startTime = Number(L?.[7] as any) || 0;
    const endTime = Number(L?.[8] as any) || 0;
    const active = Boolean(L?.[9]);

    const seller = ethers.isAddress(sellerRaw) ? normAddr(sellerRaw) : sellerRaw;
    const token = ethers.isAddress(tokenRaw) ? normAddr(tokenRaw) : tokenRaw;
    const currency = ethers.isAddress(currencyRaw) ? normAddr(currencyRaw) : currencyRaw;

    if (!sameAddr(token, contract) || tokenIdChain.toString() !== tokenId) {
      return { ok: false, error: "Listing state does not match requested NFT", step };
    }

    if (sellerAddressHint && !sameAddr(sellerAddressHint, seller)) {
      console.warn("[listing/confirm] seller hint mismatch", {
        sellerAddressHint,
        seller,
        txHashCreated,
      });
    }

    step = "find_nft";
    const nft = await prisma.nFT.findFirst({
      where: { contract, tokenId },
      select: { id: true },
    });

    if (!nft?.id) {
      return { ok: false, error: "NFT not found in DB yet", step };
    }

    step = "resolve_currency";
    const { currencyId, isNative, currencyAddress } = await resolveCurrencyId({
      provider,
      currencyRaw: currency,
    });

    step = "status_compute";
    const nowSec = Math.floor(Date.now() / 1000);
    const startDt = startTime ? new Date(startTime * 1000) : new Date();
    const endDt = endTime && endTime > 0 ? new Date(endTime * 1000) : null;

    const scheduled = startTime > 0 && startTime > nowSec;
    const expiredByTime = endTime > 0 && endTime <= nowSec;

    const txHashNorm = txHashCreated.toLowerCase();

    const existingListing = await prisma.marketplaceListing.findFirst({
      where: {
        OR: [
          { txHashCreated: txHashNorm },
          ...(sellerAddressHint
            ? [{ nftId: nft.id, sellerAddress: sellerAddressHint, status: "ACTIVE" as const }]
            : []),
          { nftId: nft.id, sellerAddress: seller, status: "ACTIVE" },
        ],
      },
      select: { id: true, status: true, txHashFilled: true },
    });

    /**
     * SOLD evidence must be tied to this exact listing row.
     * Do not infer SOLD from any historical marketplaceSale for the same seller+nft.
     * That old logic falsely killed fresh ERC-1155 listings.
     */
    const soldEvidence =
      Boolean(existingListing?.txHashFilled) || existingListing?.status === "SOLD";

    const finalStatus = computeListingStatus({
      active,
      scheduled,
      expiredByTime,
      soldEvidence,
      existingStatus: existingListing?.status ?? null,
    });

    step = "upsert_listing_row";
    const data = {
      nftId: nft.id,
      sellerAddress: seller,
      quantity: Number(quantity || BigInt(1)),
      status: finalStatus,
      txHashCreated: txHashNorm,
      startTime: startDt,
      endTime: endDt,
      currencyId,
      priceEtnWei: isNative ? price.toString() : "0",
      priceTokenAmount: isNative ? null : price.toString(),
    };

    const dbRow = existingListing?.id
      ? await prisma.marketplaceListing.update({
          where: { id: existingListing.id },
          data,
          select: { id: true },
        })
      : await prisma.marketplaceListing.create({
          data,
          select: { id: true },
        });

    return {
      ok: true,
      kind: "listing",
      listingId: listingId.toString(),
      dbId: dbRow.id,
      status: finalStatus,
      currencyId,
      isNative,
      currencyOnchain: currencyAddress,
      sellerAddress: seller,
      quantity: Number(quantity || BigInt(1)),
      scheduled,
      startTime: startDt.toISOString(),
      endTime: endDt?.toISOString() ?? null,
    };
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Unknown error";
    console.error("[confirmListingTx] FAIL", { step, msg, stack: e?.stack });
    return { ok: false, error: msg, step };
  }
}

export async function confirmAuctionTx(input: ConfirmMarketInput): Promise<ConfirmMarketResult> {
  let step = "start";

  try {
    step = "parse_input";
    const txHashCreated = String(input.txHashCreated || "").trim();
    const contractRaw = String(input.contract || "").trim();
    const tokenId = String(input.tokenId || "").trim();
    const sellerAddressRaw = String(input.sellerAddress || input.account || "").trim();

    if (!txHashCreated || !ethers.isHexString(txHashCreated, 32)) {
      return { ok: false, error: "Invalid txHashCreated", step };
    }
    if (!contractRaw || !ethers.isAddress(contractRaw)) {
      return { ok: false, error: "Invalid contract", step };
    }
    if (!tokenId) {
      return { ok: false, error: "Invalid tokenId", step };
    }

    const contract = normAddr(contractRaw);
    const sellerAddressHint =
      sellerAddressRaw && ethers.isAddress(sellerAddressRaw) ? normAddr(sellerAddressRaw) : null;

    step = "setup_provider";
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const marketplaceAddr = getMarketplaceAddress();
    const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
    const mkt = new ethers.Contract(marketplaceAddr, MARKETPLACE_CORE_ABI as any, provider);

    step = "get_receipt";
    const receipt = await provider.getTransactionReceipt(txHashCreated);
    if (!receipt) {
      return { ok: false, error: "Transaction receipt not found yet", step };
    }
    if (receipt.status !== 1) {
      return { ok: false, error: "Transaction failed on-chain", step };
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
        // ignore
      }
    }

    if (auctionId == null) {
      return { ok: false, error: "AuctionCreated event not found in receipt", step };
    }

    step = "read_chain_state";
    const A = await mkt.auctions(auctionId);

    const seller = normAddr(A[0]);
    const token = normAddr(A[1]);
    const tokenIdChain = (A[2] as bigint).toString();
    const quantity = (A[3] as bigint) ?? BigInt(1);
    const currencyRaw = (A[5] as string) ?? ethers.ZeroAddress;
    const startPrice = (A[6] as bigint) ?? BigInt(0);
    const minIncrement = (A[7] as bigint) ?? BigInt(0);
    const startTimeSec = Number(A[8] ?? 0);
    const endTimeSec = Number(A[9] ?? 0);
    const highestBidderRaw = (A[10] as string) ?? ethers.ZeroAddress;
    const highestBid = (A[11] as bigint) ?? BigInt(0);
    const bidsCount = Number(A[12] ?? 0);
    const settled = Boolean(A[13]);

    if (!sameAddr(token, contract) || tokenIdChain !== tokenId) {
      return { ok: false, error: "On-chain auction does not match NFT", step };
    }

    if (sellerAddressHint && !sameAddr(sellerAddressHint, seller)) {
      console.warn("[auction/confirm] seller hint mismatch", {
        sellerAddressHint,
        seller,
        txHashCreated,
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
      return { ok: false, error: "NFT not found in DB yet", step };
    }

    step = "resolve_currency";
    const { currencyId, isNative, currencyAddress } = await resolveCurrencyId({
      provider,
      currencyRaw,
    });

    step = "status_compute";
    const nowSec = Math.floor(Date.now() / 1000);
    const endedByTime = endTimeSec > 0 && nowSec > endTimeSec;

    const txHashNorm = txHashCreated.toLowerCase();

    const existingAuction = await prisma.auction.findFirst({
      where: {
        OR: [
          { txHashCreated: txHashNorm },
          ...(sellerAddressHint
            ? [{ nftId: nft.id, sellerAddress: sellerAddressHint, status: "ACTIVE" as const }]
            : []),
          { nftId: nft.id, sellerAddress: seller, status: "ACTIVE" },
        ],
      },
      select: { id: true, status: true },
    });

    const finalStatus = computeAuctionStatus({
      settled,
      endedByTime,
      existingStatus: existingAuction?.status ?? null,
    });

    step = "upsert_auction_row";
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
      txHashCreated: txHashNorm,
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

    return {
      ok: true,
      kind: "auction",
      auctionId: auctionId.toString(),
      dbId: dbRow.id,
      status: finalStatus,
      bidsCount,
      settled,
      sellerAddress: seller,
      quantity: qtyNum,
      currencyId,
      isNative,
      currencyOnchain: currencyAddress,
      startTime: data.startTime.toISOString(),
      endTime: data.endTime.toISOString(),
    };
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Unknown error";
    console.error("[confirmAuctionTx] FAIL", { step, msg, stack: e?.stack });
    return { ok: false, error: msg, step };
  }
}