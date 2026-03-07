/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/market/reconcile.ts
import { ethers } from "ethers";
import prisma, { prismaReady } from "@/src/lib/db";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

type ReconcileInput = {
  txHashCreated: string;
  contract: string;
  tokenId: string;
  sellerAddress?: string | null;
};

type ReconcileOk =
  | {
      ok: true;
      kind: "listing";
      reconciled: true;
      txHashCreated: string;
      contract: string;
      tokenId: string;
      result: {
        listingId: string;
        dbId: string;
        status: string;
        sellerAddress: string;
        quantity: number;
        isNative: boolean;
        currencyOnchain: string;
        active: boolean;
        scheduled: boolean;
        startTime: string;
        endTime: string | null;
      };
    }
  | {
      ok: true;
      kind: "auction";
      reconciled: true;
      txHashCreated: string;
      contract: string;
      tokenId: string;
      result: {
        auctionId: string;
        dbId: string;
        status: string;
        bidsCount: number;
        settled: boolean;
        sellerAddress: string;
        quantity: number;
        isNative: boolean;
        currencyOnchain: string;
        startTime: string;
        endTime: string;
      };
    };

type ReconcileFail = {
  ok: false;
  error: string;
  step?: string;
};

type EventKind = "listing" | "auction" | null;

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
    process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS ||
    process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;

  if (!addr || !ethers.isAddress(addr)) {
    throw new Error("Missing MARKETPLACE_CORE_ADDRESS / NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS");
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
    const existingNative = await prisma.currency.findFirst({
      where: { kind: "NATIVE", tokenAddress: null, symbol: NATIVE_SYMBOL },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (existingNative?.id) {
      return { currencyId: existingNative.id, isNative, currencyAddress: currency };
    }

    const createdNative = await prisma.currency.create({
      data: {
        symbol: NATIVE_SYMBOL,
        decimals: NATIVE_DECIMALS,
        kind: "NATIVE",
        tokenAddress: null,
        active: true,
      },
      select: { id: true },
    });

    return { currencyId: createdNative.id, isNative, currencyAddress: currency };
  }

  const existing = await prisma.currency.findFirst({
    where: { tokenAddress: currency },
    select: { id: true },
  });

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

  const created = await prisma.currency.create({
    data: {
      symbol,
      decimals,
      kind: "ERC20",
      tokenAddress: currency,
      active: true,
    },
    select: { id: true },
  });

  return { currencyId: created.id, isNative, currencyAddress: currency };
}

async function detectEventKind(args: {
  receipt: ethers.TransactionReceipt;
  iface: ethers.Interface;
  marketplaceAddr: string;
  contract: string;
  tokenId: string;
}): Promise<EventKind> {
  for (const lg of args.receipt.logs || []) {
    if (!lg?.address || !ethers.isAddress(lg.address)) continue;
    if (!sameAddr(lg.address, args.marketplaceAddr)) continue;

    try {
      const parsed = args.iface.parseLog({
        topics: lg.topics as string[],
        data: lg.data as string,
      });

      if (!parsed) continue;

      const tokenAddr = String(parsed.args?.token ?? parsed.args?.collection ?? "");
      const tokenAddrNorm = ethers.isAddress(tokenAddr) ? normAddr(tokenAddr) : "";

      const eventTokenIdRaw = parsed.args?.tokenId;
      const eventTokenId =
        typeof eventTokenIdRaw === "bigint"
          ? eventTokenIdRaw
          : eventTokenIdRaw != null
          ? BigInt(eventTokenIdRaw.toString())
          : null;

      if (!tokenAddrNorm || !sameAddr(tokenAddrNorm, args.contract)) continue;
      if (eventTokenId == null || eventTokenId.toString() !== args.tokenId) continue;

      if (parsed.name === "ListingCreated") return "listing";
      if (parsed.name === "AuctionCreated") return "auction";
    } catch {
      // ignore unrelated logs
    }
  }

  return null;
}

async function reconcileListing(input: ReconcileInput): Promise<ReconcileOk | ReconcileFail> {
  let step = "start";

  try {
    await prismaReady;

    const txHashCreated = input.txHashCreated.trim().toLowerCase();
    const contract = normAddr(input.contract);
    const tokenId = String(input.tokenId).trim();
    const sellerAddress =
      input.sellerAddress && ethers.isAddress(input.sellerAddress)
        ? normAddr(input.sellerAddress)
        : null;

    step = "setup_provider";
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const marketplaceAddr = getMarketplaceAddress();
    const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
    const mkt = new ethers.Contract(marketplaceAddr, MARKETPLACE_CORE_ABI as any, provider);

    step = "get_receipt";
    const receipt = await provider.getTransactionReceipt(txHashCreated).catch(() => null);
    if (!receipt) return { ok: false, error: "Transaction receipt not found yet", step };
    if (receipt.status !== 1) return { ok: false, error: "Transaction failed on-chain", step };

    step = "decode_event";
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

        const tokenAddr = String(parsed.args?.token ?? parsed.args?.collection ?? "");
        const tokenAddrNorm = ethers.isAddress(tokenAddr) ? normAddr(tokenAddr) : "";

        const eventTokenIdRaw = parsed.args?.tokenId;
        const eventTokenId =
          typeof eventTokenIdRaw === "bigint"
            ? eventTokenIdRaw
            : eventTokenIdRaw != null
            ? BigInt(eventTokenIdRaw.toString())
            : null;

        const eventListingIdRaw = parsed.args?.listingId;
        const eventListingId =
          typeof eventListingIdRaw === "bigint"
            ? eventListingIdRaw
            : eventListingIdRaw != null
            ? BigInt(eventListingIdRaw.toString())
            : null;

        if (!tokenAddrNorm || !sameAddr(tokenAddrNorm, contract)) continue;
        if (eventTokenId == null || eventTokenId.toString() !== tokenId) continue;
        if (eventListingId == null) continue;

        listingId = eventListingId;
        break;
      } catch {
        // ignore
      }
    }

    if (listingId == null) {
      return { ok: false, error: "ListingCreated log not found for this NFT", step };
    }

    step = "read_onchain_listing";
    const L = await mkt.listings(listingId);

    const seller = normAddr(String(L[0]));
    const token = normAddr(String(L[1]));
    const tokenIdChain = String((L[2] as bigint).toString());
    const quantity = (L[3] as bigint) ?? BigInt(1);
    const currencyRaw = String(L[5] ?? ethers.ZeroAddress);
    const price = (L[6] as bigint) ?? BigInt(0);
    const startTimeSec = Number(L[7] ?? 0);
    const endTimeSec = Number(L[8] ?? 0);
    const active = Boolean(L[9]);

    if (!sameAddr(token, contract) || tokenIdChain !== tokenId) {
      return { ok: false, error: "On-chain listing does not match requested NFT", step };
    }

    if (sellerAddress && !sameAddr(seller, sellerAddress)) {
      return { ok: false, error: "Seller mismatch for reconciled listing", step };
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
      currencyRaw,
    });

    step = "compute_status";
    const nowSec = Math.floor(Date.now() / 1000);
    const scheduled = startTimeSec > 0 && startTimeSec > nowSec;
    const expiredByTime = endTimeSec > 0 && endTimeSec <= nowSec;

    let computedStatus: "ACTIVE" | "CANCELLED" | "SOLD" | "EXPIRED" = "CANCELLED";
    if (expiredByTime) computedStatus = "EXPIRED";
    else if (active || scheduled) computedStatus = "ACTIVE";

    const existingListing = await prisma.marketplaceListing.findFirst({
      where: {
        OR: [
          { txHashCreated },
          { nftId: nft.id, sellerAddress: seller, status: "ACTIVE" },
        ],
      },
      select: { id: true, status: true, txHashFilled: true },
      orderBy: { createdAt: "desc" },
    });

    const terminal = new Set(["SOLD", "EXPIRED"]);
    const finalStatus =
      existingListing?.status && terminal.has(existingListing.status)
        ? existingListing.status
        : computedStatus;

    step = "upsert";
    const data = {
      nftId: nft.id,
      sellerAddress: seller,
      quantity:
        quantity > BigInt(Number.MAX_SAFE_INTEGER)
          ? Number.MAX_SAFE_INTEGER
          : Number(quantity),
      status: finalStatus,
      txHashCreated,
      startTime: startTimeSec > 0 ? new Date(startTimeSec * 1000) : new Date(),
      endTime: endTimeSec > 0 ? new Date(endTimeSec * 1000) : null,
      currencyId,
      priceEtnWei: isNative ? price.toString() : "0",
      priceTokenAmount: isNative ? null : price.toString(),
    };

    const dbRow = existingListing?.id
      ? await prisma.marketplaceListing.update({
          where: { id: existingListing.id },
          data,
          select: { id: true, status: true },
        })
      : await prisma.marketplaceListing.create({
          data,
          select: { id: true, status: true },
        });

    return {
      ok: true,
      kind: "listing",
      reconciled: true,
      txHashCreated,
      contract,
      tokenId,
      result: {
        listingId: listingId.toString(),
        dbId: dbRow.id,
        status: dbRow.status,
        sellerAddress: seller,
        quantity:
          quantity > BigInt(Number.MAX_SAFE_INTEGER)
            ? Number.MAX_SAFE_INTEGER
            : Number(quantity),
        isNative,
        currencyOnchain: currencyAddress,
        active,
        scheduled,
        startTime: data.startTime.toISOString(),
        endTime: data.endTime?.toISOString() ?? null,
      },
    };
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Unknown error";
    return { ok: false, error: msg, step };
  }
}

async function reconcileAuction(input: ReconcileInput): Promise<ReconcileOk | ReconcileFail> {
  let step = "start";

  try {
    await prismaReady;

    const txHashCreated = input.txHashCreated.trim().toLowerCase();
    const contract = normAddr(input.contract);
    const tokenId = String(input.tokenId).trim();
    const sellerAddress =
      input.sellerAddress && ethers.isAddress(input.sellerAddress)
        ? normAddr(input.sellerAddress)
        : null;

    step = "setup_provider";
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const marketplaceAddr = getMarketplaceAddress();
    const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
    const mkt = new ethers.Contract(marketplaceAddr, MARKETPLACE_CORE_ABI as any, provider);

    step = "get_receipt";
    const receipt = await provider.getTransactionReceipt(txHashCreated).catch(() => null);
    if (!receipt) return { ok: false, error: "Transaction receipt not found yet", step };
    if (receipt.status !== 1) return { ok: false, error: "Transaction failed on-chain", step };

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

        const tokenAddr = String(parsed.args?.token ?? parsed.args?.collection ?? "");
        const tokenAddrNorm = ethers.isAddress(tokenAddr) ? normAddr(tokenAddr) : "";

        const eventTokenIdRaw = parsed.args?.tokenId;
        const eventTokenId =
          typeof eventTokenIdRaw === "bigint"
            ? eventTokenIdRaw
            : eventTokenIdRaw != null
            ? BigInt(eventTokenIdRaw.toString())
            : null;

        const eventAuctionIdRaw = parsed.args?.auctionId;
        const eventAuctionId =
          typeof eventAuctionIdRaw === "bigint"
            ? eventAuctionIdRaw
            : eventAuctionIdRaw != null
            ? BigInt(eventAuctionIdRaw.toString())
            : null;

        if (!tokenAddrNorm || !sameAddr(tokenAddrNorm, contract)) continue;
        if (eventTokenId == null || eventTokenId.toString() !== tokenId) continue;
        if (eventAuctionId == null) continue;

        auctionId = eventAuctionId;
        break;
      } catch {
        // ignore
      }
    }

    if (auctionId == null) {
      return { ok: false, error: "AuctionCreated log not found for this NFT", step };
    }

    step = "read_onchain_auction";
    const A = await mkt.auctions(auctionId);

    const seller = normAddr(String(A[0]));
    const token = normAddr(String(A[1]));
    const tokenIdChain = String((A[2] as bigint).toString());
    const quantity = (A[3] as bigint) ?? BigInt(1);
    const currencyRaw = String(A[5] ?? ethers.ZeroAddress);
    const startPrice = (A[6] as bigint) ?? BigInt(0);
    const minIncrement = (A[7] as bigint) ?? BigInt(0);
    const startTimeSec = Number(A[8] ?? 0);
    const endTimeSec = Number(A[9] ?? 0);
    const highestBidderRaw = String(A[10] ?? ethers.ZeroAddress);
    const highestBid = (A[11] as bigint) ?? BigInt(0);
    const bidsCount = Number(A[12] ?? 0);
    const settled = Boolean(A[13]);

    if (!sameAddr(token, contract) || tokenIdChain !== tokenId) {
      return { ok: false, error: "On-chain auction does not match requested NFT", step };
    }

    if (sellerAddress && !sameAddr(seller, sellerAddress)) {
      return { ok: false, error: "Seller mismatch for reconciled auction", step };
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

    step = "compute_status";
    const nowSec = Math.floor(Date.now() / 1000);
    const endedByTime = endTimeSec > 0 && nowSec > endTimeSec;

    let computedStatus: "ACTIVE" | "ENDED" | "CANCELLED" = "ACTIVE";
    if (settled || endedByTime) computedStatus = "ENDED";

    const existingAuction = await prisma.auction.findFirst({
      where: {
        OR: [
          { txHashCreated },
          { nftId: nft.id, sellerAddress: seller, status: "ACTIVE" },
        ],
      },
      select: { id: true, status: true },
      orderBy: { createdAt: "desc" },
    });

    const terminal = new Set(["ENDED", "CANCELLED"]);
    const finalStatus =
      existingAuction?.status && terminal.has(existingAuction.status)
        ? existingAuction.status
        : computedStatus;

    step = "upsert";
    const dbRow = existingAuction?.id
      ? await prisma.auction.update({
          where: { id: existingAuction.id },
          data: {
            nftId: nft.id,
            sellerAddress: seller,
            quantity:
              quantity > BigInt(Number.MAX_SAFE_INTEGER)
                ? Number.MAX_SAFE_INTEGER
                : Number(quantity),
            currencyId,
            startTime: new Date(startTimeSec * 1000),
            endTime: new Date(endTimeSec * 1000),
            txHashCreated,
            status: finalStatus,
            highestBidder,
            startPriceEtnWei: isNative ? startPrice.toString() : "0",
            startPriceTokenAmount: isNative ? null : startPrice.toString(),
            minIncrementEtnWei: isNative ? minIncrement.toString() : null,
            minIncrementTokenAmount: isNative ? null : minIncrement.toString(),
            highestBidEtnWei: isNative ? highestBid.toString() : null,
            highestBidTokenAmount: isNative ? null : highestBid.toString(),
          },
          select: { id: true, status: true },
        })
      : await prisma.auction.create({
          data: {
            nftId: nft.id,
            sellerAddress: seller,
            quantity:
              quantity > BigInt(Number.MAX_SAFE_INTEGER)
                ? Number.MAX_SAFE_INTEGER
                : Number(quantity),
            currencyId,
            startTime: new Date(startTimeSec * 1000),
            endTime: new Date(endTimeSec * 1000),
            txHashCreated,
            status: finalStatus,
            highestBidder,
            startPriceEtnWei: isNative ? startPrice.toString() : "0",
            startPriceTokenAmount: isNative ? null : startPrice.toString(),
            minIncrementEtnWei: isNative ? minIncrement.toString() : null,
            minIncrementTokenAmount: isNative ? null : minIncrement.toString(),
            highestBidEtnWei: isNative ? highestBid.toString() : null,
            highestBidTokenAmount: isNative ? null : highestBid.toString(),
          },
          select: { id: true, status: true },
        });

    return {
      ok: true,
      kind: "auction",
      reconciled: true,
      txHashCreated,
      contract,
      tokenId,
      result: {
        auctionId: auctionId.toString(),
        dbId: dbRow.id,
        status: dbRow.status,
        bidsCount,
        settled,
        sellerAddress: seller,
        quantity:
          quantity > BigInt(Number.MAX_SAFE_INTEGER)
            ? Number.MAX_SAFE_INTEGER
            : Number(quantity),
        isNative,
        currencyOnchain: currencyAddress,
        startTime: new Date(startTimeSec * 1000).toISOString(),
        endTime: new Date(endTimeSec * 1000).toISOString(),
      },
    };
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Unknown error";
    return { ok: false, error: msg, step };
  }
}

export async function reconcileMarketTx(input: ReconcileInput): Promise<ReconcileOk | ReconcileFail> {
  let step = "start";

  try {
    await prismaReady;

    const txHashCreated = String(input.txHashCreated || "").trim().toLowerCase();
    const contractRaw = String(input.contract || "").trim();
    const tokenId = String(input.tokenId || "").trim();

    if (!txHashCreated || !ethers.isHexString(txHashCreated, 32)) {
      return { ok: false, error: "Invalid txHashCreated", step: "validate_txHash" };
    }

    if (!contractRaw || !ethers.isAddress(contractRaw)) {
      return { ok: false, error: "Invalid contract", step: "validate_contract" };
    }

    if (!tokenId) {
      return { ok: false, error: "Invalid tokenId", step: "validate_tokenId" };
    }

    const contract = normAddr(contractRaw);

    step = "setup_provider";
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const marketplaceAddr = getMarketplaceAddress();
    const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);

    step = "get_receipt";
    const receipt = await provider.getTransactionReceipt(txHashCreated).catch(() => null);
    if (!receipt) return { ok: false, error: "Transaction receipt not found yet", step };
    if (receipt.status !== 1) return { ok: false, error: "Transaction failed on-chain", step };

    step = "detect_kind";
    const kind = await detectEventKind({
      receipt,
      iface,
      marketplaceAddr,
      contract,
      tokenId,
    });

    if (kind === "listing") {
      return reconcileListing({
        txHashCreated,
        contract,
        tokenId,
        sellerAddress: input.sellerAddress ?? null,
      });
    }

    if (kind === "auction") {
      return reconcileAuction({
        txHashCreated,
        contract,
        tokenId,
        sellerAddress: input.sellerAddress ?? null,
      });
    }

    return { ok: false, error: "No supported marketplace creation event found in transaction", step };
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Unknown error";
    return { ok: false, error: msg, step };
  }
}