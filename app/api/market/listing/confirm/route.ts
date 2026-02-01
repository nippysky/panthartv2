/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/market/listing/confirm/route.ts
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
  return a.toLowerCase() === b.toLowerCase();
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

    const marketplace = normAddr(MARKETPLACE_ADDR);

    step = "ethers_setup";
    const provider = new ethers.JsonRpcProvider(RPC_HTTP_URL);
    const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
    const mkt = new ethers.Contract(marketplace, MARKETPLACE_CORE_ABI as any, provider);

    step = "get_receipt";
    const receipt = await provider.getTransactionReceipt(txHashCreated);
    if (!receipt) {
      return json(404, { ok: false, error: "Transaction receipt not found yet" });
    }
    // ✅ receipt.status is number | null
    if (receipt.status !== 1) {
      return json(409, { ok: false, error: "Transaction failed on-chain" });
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
      if (!sameAddr(lg.address, marketplace)) continue;

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
      return json(422, {
        ok: false,
        error: "Could not find ListingCreated log for this NFT in tx receipt",
      });
    }

    step = "read_listing_state";
    // listings(listingId) => (seller, token, tokenId, quantity, standard, currency, price, startTime, endTime, active)
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
      return json(409, {
        ok: false,
        error: "Listing state does not match requested NFT",
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
    let currencyId: string | null = null;

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
    const startDt = startTime ? new Date(startTime * 1000) : new Date();
    const endDt = endTime && endTime > 0 ? new Date(endTime * 1000) : null;

    const scheduled = startTime > 0 && startTime > nowSec;
    const expiredByTime = endTime > 0 && endTime <= nowSec;

    // Normalize tx hash for consistent lookups (NOT an address)
    const txHashNorm = txHashCreated.toLowerCase();

    const existingListing = await prisma.marketplaceListing.findFirst({
      where: { txHashCreated: txHashNorm },
      select: { id: true, status: true, txHashFilled: true },
    });

    // Detect SOLD if we already have evidence in DB
    let soldEvidence =
      Boolean(existingListing?.txHashFilled) || existingListing?.status === "SOLD";

    if (!soldEvidence) {
      const sale = await prisma.marketplaceSale
        .findFirst({
          where: { nftId: nft.id, sellerAddress: seller },
          orderBy: { timestamp: "desc" },
          select: { txHash: true },
        })
        .catch(() => null);

      soldEvidence = Boolean(sale?.txHash);
    }

    let computedStatus: "ACTIVE" | "CANCELLED" | "SOLD" | "EXPIRED" = "CANCELLED";

    // Priority order:
    if (soldEvidence) computedStatus = "SOLD";
    else if (expiredByTime) computedStatus = "EXPIRED";
    else if (active || scheduled) computedStatus = "ACTIVE";
    else computedStatus = "CANCELLED";

    // ✅ Never downgrade terminal states due to re-confirm
    const terminal = new Set<"SOLD" | "EXPIRED">(["SOLD", "EXPIRED"]);
    const finalStatus =
      existingListing?.status && terminal.has(existingListing.status as any)
        ? (existingListing.status as any)
        : computedStatus;

    step = "upsert_listing_row";
    const data = {
      nftId: nft.id,
      sellerAddress: seller, // ✅ checksum
      quantity: Number(quantity || BigInt(1)),
      status: finalStatus as any,
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

    return json(200, {
      ok: true,
      listingId: listingId.toString(),
      dbId: dbRow.id,
      status: finalStatus,
      currencyId,
      isNative,
      currencyOnchain: currency,
      scheduled,
      startTime: startDt.toISOString(),
      endTime: endDt?.toISOString() ?? null,
    });
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "Unknown error";
    console.error("[api/market/listing/confirm] FAIL", { step, msg, stack: e?.stack });
    return json(500, { ok: false, error: msg, step });
  }
}
