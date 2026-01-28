// src/lib/services/marketplace.ts
import { ethers } from "ethers";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";
import { getBrowserSigner, ZERO_ADDRESS } from "@/src/lib/evm/getSigner";
import {
  readActiveListing as readActiveListingCore,
  readActiveAuction as readActiveAuctionCore,
  createListingOnChain as createListingCore,
  createAuctionOnChain as createAuctionCore,
  cancelListingOnChain as cancelListingCore,
  cancelAuctionOnChain as cancelAuctionCore,
  getErc20Meta as getErc20MetaCore,
  type Standard as StdForHelper,
} from "@/src/lib/evm/marketplace-actions";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 52014);

// Public provider for read-only helpers (no wallet dependency)
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  "https://rpc.ankr.com/electroneum";
const publicProvider = new ethers.JsonRpcProvider(RPC_URL);

async function ensureRightNetwork() {
  const { chainId } = await getBrowserSigner();
  if (Number(chainId) !== CHAIN_ID) {
    throw new Error("Wrong network. Please switch to Electroneum.");
  }
}

function toWeiHuman(amount: string, decimals: number): bigint {
  return ethers.parseUnits((amount || "0").trim(), decimals);
}

function stdEnum(standard: StdForHelper): number {
  // Contract enum Panthart.TokenStandard is almost certainly: 0=ERC721, 1=ERC1155
  return standard === "ERC1155" ? 1 : 0;
}

const ERC721_ABI = [
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function transferFrom(address from, address to, uint256 tokenId)",
] as const;

const ERC1155_ABI = [
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
] as const;

async function ensureMarketplaceApproval(args: {
  collection: `0x${string}`;
  standard: StdForHelper;
  owner: `0x${string}`;
  operator: `0x${string}`;
  signer: ethers.Signer;
}) {
  if (args.standard === "ERC1155") {
    const c = new ethers.Contract(args.collection, ERC1155_ABI, args.signer);
    const ok: boolean = await c.isApprovedForAll(args.owner, args.operator);
    if (ok) return;
    const tx = await c.setApprovalForAll(args.operator, true);
    await tx.wait();
    return;
  }

  const c = new ethers.Contract(args.collection, ERC721_ABI, args.signer);
  const ok: boolean = await c.isApprovedForAll(args.owner, args.operator);
  if (ok) return;
  const tx = await c.setApprovalForAll(args.operator, true);
  await tx.wait();
}

export const marketplace = {
  ZERO_ADDRESS,

  /* ------------------------------------------------------------------ */
  /* Read helpers (existing)                                            */
  /* ------------------------------------------------------------------ */
  readActiveListing: readActiveListingCore,
  readActiveAuction: readActiveAuctionCore,
  getErc20Meta: getErc20MetaCore,

  /* ------------------------------------------------------------------ */
  /* Seller-scoped readers for ERC1155                                  */
  /* ------------------------------------------------------------------ */
  async readActiveListingForSeller(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: StdForHelper;
    seller: `0x${string}`;
  }) {
    return readActiveListingCore({
      collection: args.collection,
      tokenId: args.tokenId,
      standard: args.standard,
      seller: args.seller,
    });
  },

  async readActiveAuctionForSeller(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: StdForHelper;
    seller: `0x${string}`;
  }) {
    return readActiveAuctionCore({
      collection: args.collection,
      tokenId: args.tokenId,
      standard: args.standard,
      seller: args.seller,
    });
  },

  /* ------------------------------------------------------------------ */
  /* By-ID readers (public provider)                                    */
  /* ------------------------------------------------------------------ */
  async readListingById(listingId: bigint) {
    const mktAddr = process.env
      .NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
    const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, publicProvider);
    const raw = await mkt.listings(listingId);
    if (!raw) return null;

    const row = {
      seller: raw.seller as `0x${string}`,
      currency: raw.currency as `0x${string}`,
      price: raw.price as bigint,
      quantity: raw.quantity as bigint,
      start: raw.startTime as bigint,
      end: raw.endTime as bigint,
      standard: raw.standard as bigint,
      active: Boolean(raw.active),
    };

    return { id: listingId, row };
  },

  async readAuctionById(auctionId: bigint) {
    const mktAddr = process.env
      .NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
    const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, publicProvider);
    const raw = await mkt.auctions(auctionId);
    if (!raw) return null;

    const row = {
      seller: raw.seller as `0x${string}`,
      currency: raw.currency as `0x${string}`,
      startPrice: raw.startPrice as bigint,
      minIncrement: raw.minIncrement as bigint,
      start: raw.startTime as bigint,
      end: raw.endTime as bigint,
      highestBidder: raw.highestBidder as `0x${string}`,
      highestBid: raw.highestBid as bigint,
      bidsCount: Number(raw.bidsCount || 0),
      standard: raw.standard as bigint,
      settled: Boolean(raw.settled),
    };

    return { id: auctionId, row };
  },

  /* ------------------------------------------------------------------ */
  /* Create/Cancel (existing exports)                                   */
  /* ------------------------------------------------------------------ */
  createListing: createListingCore,
  createAuction: createAuctionCore,
  cancelListing: cancelListingCore,
  cancelAuction: cancelAuctionCore,

  /* ------------------------------------------------------------------ */
  /* NEW: Just-in-time create listing/auction with approvals            */
  /* ------------------------------------------------------------------ */
  async createListingJustInTime(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: StdForHelper;
    priceHuman: string;
    currency?: `0x${string}`; // default ZERO_ADDRESS
    quantity?: bigint; // default 1
    durationDays?: number; // default 7
    startTimeSec?: number; // optional override
    endTimeSec?: number; // optional override
  }) {
    await ensureRightNetwork();

    const { signer } = await getBrowserSigner();
    const seller = (await signer.getAddress()) as `0x${string}`;

    const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
    const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

    await ensureMarketplaceApproval({
      collection: args.collection,
      standard: args.standard,
      owner: seller,
      operator: mktAddr,
      signer,
    });

    const currency = (args.currency ?? ZERO_ADDRESS) as `0x${string}`;
    const decimals =
      currency === ZERO_ADDRESS ? 18 : (await getErc20MetaCore(currency)).decimals;

    const priceWei = toWeiHuman(args.priceHuman, decimals);

    const qty = args.standard === "ERC1155" ? (args.quantity ?? BigInt(1)) : BigInt(1);

    const now = Math.floor(Date.now() / 1000);
    const start = args.startTimeSec ?? now;
    const durationDays = args.durationDays ?? 7;
    const end = args.endTimeSec ?? start + Math.max(1, durationDays) * 24 * 60 * 60;

    const tx = await mkt.createListing(
      args.collection,
      args.tokenId,
      qty,
      currency,
      priceWei,
      start,
      end,
      stdEnum(args.standard)
    );

    const rc = await tx.wait();
    return rc?.hash ?? tx.hash;
  },

  async createAuctionJustInTime(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: StdForHelper;
    startPriceHuman: string;
    minIncrementHuman: string;
    currency?: `0x${string}`; // default ZERO_ADDRESS
    quantity?: bigint; // default 1
    durationDays?: number; // default 7
    startTimeSec?: number; // optional override
    endTimeSec?: number; // optional override
  }) {
    await ensureRightNetwork();

    const { signer } = await getBrowserSigner();
    const seller = (await signer.getAddress()) as `0x${string}`;

    const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
    const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

    await ensureMarketplaceApproval({
      collection: args.collection,
      standard: args.standard,
      owner: seller,
      operator: mktAddr,
      signer,
    });

    const currency = (args.currency ?? ZERO_ADDRESS) as `0x${string}`;
    const decimals =
      currency === ZERO_ADDRESS ? 18 : (await getErc20MetaCore(currency)).decimals;

    const startPriceWei = toWeiHuman(args.startPriceHuman, decimals);
    const minIncWei = toWeiHuman(args.minIncrementHuman || "0", decimals);

    const qty = args.standard === "ERC1155" ? (args.quantity ?? BigInt(1)) : BigInt(1);

    const now = Math.floor(Date.now() / 1000);
    const start = args.startTimeSec ?? now;
    const durationDays = args.durationDays ?? 7;
    const end = args.endTimeSec ?? start + Math.max(1, durationDays) * 24 * 60 * 60;

    const tx = await mkt.createAuction(
      args.collection,
      args.tokenId,
      qty,
      currency,
      startPriceWei,
      minIncWei,
      start,
      end,
      stdEnum(args.standard)
    );

    const rc = await tx.wait();
    return rc?.hash ?? tx.hash;
  },

  /* ------------------------------------------------------------------ */
  /* Cleanup expired listing                                            */
  /* ------------------------------------------------------------------ */
  async cleanupExpired(listingId: bigint) {
    await ensureRightNetwork();
    const { signer } = await getBrowserSigner();
    const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
    const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);
    const tx = await mkt.cleanupExpiredListing(listingId);
    const rc = await tx.wait();
    return rc?.hash ?? tx.hash;
  },

  /* ------------------------------------------------------------------ */
  /* Buy/Bid/Finalize (existing)                                        */
  /* ------------------------------------------------------------------ */
  async buyListingJustInTime(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: StdForHelper;
  }) {
    await ensureRightNetwork();

    const li = await readActiveListingCore(args);
    if (!li) throw new Error("Listing unavailable.");

    const listingId = li.id;
    const currency = li.row.currency as `0x${string}`;
    const price = li.row.price as bigint;

    const { signer } = await getBrowserSigner();
    const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
    const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

    if (currency && currency !== ZERO_ADDRESS) {
      const erc20 = new ethers.Contract(
        currency,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 value) returns (bool)",
        ],
        signer
      );
      const ownerAddr = await signer.getAddress();
      const allowance: bigint = await erc20.allowance(ownerAddr, mktAddr);
      if (allowance < price) {
        const txA = await erc20.approve(mktAddr, price);
        await txA.wait();
      }
      const tx = await mkt.buy(listingId);
      const rc = await tx.wait();
      return rc?.hash ?? tx.hash;
    } else {
      const tx = await mkt.buy(listingId, { value: price });
      const rc = await tx.wait();
      return rc?.hash ?? tx.hash;
    }
  },

  async placeBidJustInTime(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: StdForHelper;
    amountHuman: string;
  }) {
    await ensureRightNetwork();

    const au = await readActiveAuctionCore({
      collection: args.collection,
      tokenId: args.tokenId,
      standard: args.standard,
    });
    if (!au) throw new Error("Auction unavailable.");

    const auctionId = au.id;
    const currency = au.row.currency as `0x${string}`;

    const decimals =
      currency === ZERO_ADDRESS ? 18 : (await getErc20MetaCore(currency)).decimals;

    const amountWei = toWeiHuman(args.amountHuman, decimals);

    const { signer } = await getBrowserSigner();
    const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
    const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

    if (currency !== ZERO_ADDRESS) {
      const erc20 = new ethers.Contract(
        currency,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 value) returns (bool)",
        ],
        signer
      );
      const ownerAddr = await signer.getAddress();
      const allowance: bigint = await erc20.allowance(ownerAddr, mktAddr);
      if (allowance < amountWei) {
        const txA = await erc20.approve(mktAddr, amountWei);
        await txA.wait();
      }
      const tx = await mkt.bid(auctionId, amountWei);
      const rc = await tx.wait();
      return { txHash: rc?.hash ?? tx.hash, auctionId, currency, decimals };
    } else {
      const tx = await mkt.bid(auctionId, amountWei, { value: amountWei });
      const rc = await tx.wait();
      return { txHash: rc?.hash ?? tx.hash, auctionId, currency, decimals };
    }
  },

  async finalizeAuction(auctionId: bigint) {
    await ensureRightNetwork();
    const { signer } = await getBrowserSigner();
    const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
    const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);
    const tx = await mkt.finalize(auctionId);
    const rc = await tx.wait();
    return rc?.hash ?? tx.hash;
  },

  /* ------------------------------------------------------------------ */
  /* NEW: Transfer helper                                               */
  /* ------------------------------------------------------------------ */
  async transferNft(args: {
    collection: `0x${string}`;
    tokenId: bigint;
    standard: StdForHelper;
    to: `0x${string}`;
    amount?: bigint; // ERC1155 only
  }) {
    await ensureRightNetwork();

    const { signer } = await getBrowserSigner();
    const from = (await signer.getAddress()) as `0x${string}`;

    if (args.standard === "ERC1155") {
      const c = new ethers.Contract(args.collection, ERC1155_ABI, signer);
      const amt = args.amount ?? BigInt(1);
      const tx = await c.safeTransferFrom(from, args.to, args.tokenId, amt, "0x");
      const rc = await tx.wait();
      return rc?.hash ?? tx.hash;
    }

    // ERC721: prefer safeTransferFrom, fallback to transferFrom
    const c = new ethers.Contract(args.collection, ERC721_ABI, signer);

    try {
      const tx = await c.safeTransferFrom(from, args.to, args.tokenId);
      const rc = await tx.wait();
      return rc?.hash ?? tx.hash;
    } catch {
      const tx = await c.transferFrom(from, args.to, args.tokenId);
      const rc = await tx.wait();
      return rc?.hash ?? tx.hash;
    }
  },
};

export type { StdForHelper as Standard };
