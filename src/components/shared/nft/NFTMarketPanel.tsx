"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { toast } from "sonner";

import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";
import { Modal } from "@/src/ui/Modal";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { useActiveAccount } from "thirdweb/react";
import type { Standard } from "@/src/lib/services/marketplace";
import { CurrencyOption, CurrencySelect } from "./CurrencySelector";
import DateTimePicker from "../DateTimePicker";

type ListingActiveItem = {
  id: string; // chain listingId as string
  sellerAddress: string | null;
  currency?: { symbol?: string | null } | null;
  price?: { unit?: string | null } | null;
  quantity?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  isLive?: boolean | null;
};

type AuctionActiveItem = {
  id: string; // chain auctionId as string
  seller?: { address?: string | null } | null;
  currency?: { symbol?: string | null; decimals?: number | null } | null;
  price?: { current?: string | null } | null;
  endTime?: string | null;
};

type OwnerMode = "none" | "list" | "auction" | "transfer";

function lc(s?: string | null) {
  return (s || "").toLowerCase();
}

function parseIsoToMs(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalYMDHM(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function addDaysLocalYmdhm(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setSeconds(0, 0);
  return toLocalYMDHM(d);
}

function localYmdhmToUnix(local: string): number {
  if (!local) return 0;
  const t = new Date(local).getTime();
  if (!Number.isFinite(t)) throw new Error("Invalid date/time");
  return Math.floor(t / 1000);
}

function errorMessage(e: unknown, fallback: string) {
  const maybe = e as { reason?: string; shortMessage?: string; message?: string };
  return maybe?.reason || maybe?.shortMessage || maybe?.message || fallback;
}

/** Smooth collapsible container (grid row trick = buttery) */
function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "grid transition-[grid-template-rows] duration-300 ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      ].join(" ")}
    >
      <div
        className={[
          "overflow-hidden",
          "transition-all duration-300 ease-out",
          open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

/** Simple "Button-like" link using your tokens */
function ButtonLink({
  href,
  children,
  disabled,
  title,
}: {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  if (disabled) {
    return (
      <span
        title={title}
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-background px-4 text-sm opacity-60 cursor-not-allowed"
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      title={title}
      className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-background px-4 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition"
    >
      {children}
    </a>
  );
}

const MARKET_ABI = [
  "function createListing(address collection,uint256 tokenId,uint256 quantity,address currency,uint256 price,uint64 startTime,uint64 endTime,uint8 standard) returns (uint256)",
  "function cancelListing(uint256 listingId)",
  "function buy(uint256 listingId) payable",
  "function createAuction(address collection,uint256 tokenId,uint256 quantity,address currency,uint256 startPrice,uint256 minIncrement,uint64 startTime,uint64 endTime,uint8 standard) returns (uint256)",
  "function bid(uint256 auctionId,uint256 amount) payable",
  "function finalize(uint256 auctionId)",
  "function cancelAuction(uint256 auctionId)",
  "function listings(uint256 listingId) view returns (address seller,address token,uint256 tokenId,uint256 quantity,uint8 standard,address currency,uint256 price,uint64 startTime,uint64 endTime,bool active)",
  "function auctions(uint256 auctionId) view returns (address seller,address token,uint256 tokenId,uint256 quantity,uint8 standard,address currency,uint256 startPrice,uint256 minIncrement,uint64 startTime,uint64 endTime,address highestBidder,uint256 highestBid,uint32 bidsCount,bool settled)",
] as const;

const APPROVAL_FOR_ALL_ABI = [
  "function isApprovedForAll(address owner,address operator) view returns (bool)",
  "function setApprovalForAll(address operator,bool approved)",
] as const;

const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
] as const;

const ERC721_XFER_ABI = [
  "function safeTransferFrom(address from,address to,uint256 tokenId)",
] as const;

const ERC1155_XFER_ABI = [
  "function safeTransferFrom(address from,address to,uint256 id,uint256 amount,bytes data)",
] as const;

function getMarketplaceAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;
  if (!addr || !ethers.isAddress(addr)) {
    throw new Error("Missing NEXT_PUBLIC_MARKETPLACE_ADDRESS (valid 0x address).");
  }
  return addr as `0x${string}`;
}

async function getSigner() {
  const anyWin = window as any;
  if (!anyWin.ethereum) throw new Error("No wallet found in this browser.");
  const provider = new ethers.BrowserProvider(anyWin.ethereum);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

export default function NFTMarketPanel({
  contract,
  tokenId,
  standard,
  owner,
  onAfterAction,
}: {
  contract: string;
  tokenId: string;
  standard: Standard;
  owner?: string | null;
  onAfterAction?: () => void;
}) {
  const router = useRouter();

  // unified account source (DW inside webview, thirdweb otherwise)
  const dw = useDecentWalletAccount();
  const third = useActiveAccount();

  const account = useMemo(() => {
    if (dw.isDecentWallet) return dw.address ?? null;
    return third?.address ?? null;
  }, [dw.isDecentWallet, dw.address, third?.address]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [listing, setListing] = useState<ListingActiveItem | null>(null);
  const [auction, setAuction] = useState<AuctionActiveItem | null>(null);

  // currencies
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([
    { id: "native", symbol: "ETN", decimals: 18, kind: "NATIVE", tokenAddress: null },
  ]);
  const [currLoading, setCurrLoading] = useState(true);

  // Owner panel (inline, not modal)
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("none");

  // Bid modal (not owner-only)
  const [bidOpen, setBidOpen] = useState(false);

  // LIST form state (strict args)
  const [listPrice, setListPrice] = useState("");
  const [listCurrencyId, setListCurrencyId] = useState("native");
  const [listStart, setListStart] = useState(() => toLocalYMDHM(new Date()));
  const [listEnd, setListEnd] = useState(() => addDaysLocalYmdhm(7));
  const [listNoEnd, setListNoEnd] = useState(false);
  const [listQty, setListQty] = useState("1");

  // AUCTION form state (strict args)
  const [aucStartPrice, setAucStartPrice] = useState("");
  const [aucMinInc, setAucMinInc] = useState("0.1");
  const [aucCurrencyId, setAucCurrencyId] = useState("native");
  const [aucStart, setAucStart] = useState(() => toLocalYMDHM(new Date()));
  const [aucEnd, setAucEnd] = useState(() => addDaysLocalYmdhm(7));
  const [aucQty, setAucQty] = useState("1");

  // BID form
  const [bidAmount, setBidAmount] = useState("");
  const [bidMinLabel, setBidMinLabel] = useState<string | null>(null);
  const [bidSymbol, setBidSymbol] = useState<string>("ETN");

  // TRANSFER form
  const [toAddr, setToAddr] = useState("");
  const [xferQty, setXferQty] = useState("1");

  const stdEnum = standard === "ERC1155" ? 1 : 0;

  const currencyById = useCallback(
    (id: string) => {
      return currencies.find((c) => c.id === id) ?? currencies[0];
    },
    [currencies]
  );

  const closeOwnerPanels = useCallback(() => {
    setOwnerMode("none");
  }, []);

  const ensureApprovalForAll = useCallback(
    async (signer: ethers.Signer) => {
      const marketAddr = getMarketplaceAddress();
      const ownerAddr = await signer.getAddress();
      const token = new ethers.Contract(contract, APPROVAL_FOR_ALL_ABI, signer);

      const ok = (await token
        .isApprovedForAll(ownerAddr, marketAddr)
        .catch(() => false)) as boolean;

      if (ok) return;

      const tId = toast.loading("Approving marketplace…");
      const tx = await token.setApprovalForAll(marketAddr, true);
      await tx.wait();
      toast.success("Marketplace approved.", { id: tId });
    },
    [contract]
  );

  const ensureErc20Allowance = useCallback(
    async (signer: ethers.Signer, tokenAddr: string, required: bigint) => {
      const marketAddr = getMarketplaceAddress();
      const ownerAddr = await signer.getAddress();
      const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, signer);

      const allowance = (await erc20
        .allowance(ownerAddr, marketAddr)
        .catch(() => BigInt(0))) as bigint;

      if (allowance >= required) return;

      const tId = toast.loading("Approving token spend…");
      const tx = await erc20.approve(marketAddr, required);
      await tx.wait();
      toast.success("Token approved.", { id: tId });
    },
    []
  );

  const syncOwnerNow = useCallback(async () => {
    await fetch("/api/nft/sync-owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract, tokenId }),
    }).catch(() => null);

    router.refresh();
  }, [contract, tokenId, router]);

  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const [lRes, aRes] = await Promise.all([
        fetch(
          `/api/listing/active?contract=${encodeURIComponent(
            contract
          )}&tokenId=${encodeURIComponent(tokenId)}&limit=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch(() => null)),
        fetch(
          `/api/auction/active?contract=${encodeURIComponent(
            contract
          )}&tokenId=${encodeURIComponent(tokenId)}&limit=1`,
          { cache: "no-store" }
        ).then((r) => r.json().catch(() => null)),
      ]);

      let li =
        lRes && Array.isArray(lRes.items)
          ? (lRes.items[0] as ListingActiveItem)
          : null;
      const au =
        aRes && Array.isArray(aRes.items)
          ? (aRes.items[0] as AuctionActiveItem)
          : null;

      if (li && typeof li.isLive === "boolean" && li.isLive === false) li = null;

      if (
        standard === "ERC721" &&
        owner &&
        li?.sellerAddress &&
        lc(owner) !== lc(li.sellerAddress)
      ) {
        li = null;
      }

      setListing(li ?? null);
      setAuction(au ?? null);

      // keep UX clean
      closeOwnerPanels();
      setBidOpen(false);
      setBidAmount("");
      setBidMinLabel(null);
      setBidSymbol("ETN");
    } catch {
      setErr("Failed to load market state.");
      setListing(null);
      setAuction(null);
      closeOwnerPanels();
    }
  }, [contract, tokenId, standard, owner, closeOwnerPanels]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setCurrLoading(true);
        const res = await fetch("/api/currencies", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | { currencies?: CurrencyOption[] }
          | null;

        const list = Array.isArray(json?.currencies) ? json!.currencies! : [];
        if (!ok) return;

        const native: CurrencyOption = {
          id: "native",
          symbol: "ETN",
          decimals: 18,
          kind: "NATIVE",
          tokenAddress: null,
        };

        const rest = list.filter((c) => c.id !== "native");
        setCurrencies([native, ...rest]);
      } catch {
        // keep default
      } finally {
        if (ok) setCurrLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  const listingSeller = listing?.sellerAddress ?? null;
  const canManageListing =
    !!account && !!listingSeller && lc(account) === lc(listingSeller);

  const auctionSeller = auction?.seller?.address ?? null;
  const canManageAuction =
    !!account && !!auctionSeller && lc(account) === lc(auctionSeller);

  const auctionEndMs = parseIsoToMs(auction?.endTime ?? null);
  const auctionEndedUi = !!auctionEndMs && Date.now() > auctionEndMs;

  const listingPriceLabel = useMemo(() => {
    if (!listing) return null;
    const unit = listing.price?.unit ?? null;
    const sym = listing.currency?.symbol ?? "ETN";
    return unit ? `${unit} ${sym}` : null;
  }, [listing]);

  const auctionPriceLabel = useMemo(() => {
    if (!auction) return null;
    const cur = auction.price?.current ?? null;
    const sym = auction.currency?.symbol ?? "ETN";
    return cur ? `${cur} ${sym}` : null;
  }, [auction]);

  const userOwns = useMemo(() => {
    if (!account || !owner) return false;
    return lc(account) === lc(owner);
  }, [account, owner]);

  const blockedByEscrow = !!listing || !!auction;

  const requireWalletToast = useCallback(() => {
    toast.error("Wallet not connected.");
    setErr("Connect your wallet to continue.");
  }, []);

  // -----------------------------
  // BUY (strict: read on-chain listing for currency/price)
  // -----------------------------
  const buyNow = useCallback(async () => {
    const listingIdStr = listing?.id;
    if (!listingIdStr) return;

    if (!account) {
      requireWalletToast();
      return;
    }

    const tId = toast.loading("Buying…");
    setLoading(true);
    setErr(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(getMarketplaceAddress(), MARKET_ABI, signer);

      const listingId = BigInt(listingIdStr);
      const L = await market.listings(listingId);

      const currencyAddr = (L[5] as string) ?? ethers.ZeroAddress;
      const price = (L[6] as bigint) ?? BigInt(0);

      if (currencyAddr === ethers.ZeroAddress) {
        const tx = await market.buy(listingId, { value: price });
        await tx.wait();
      } else {
        await ensureErc20Allowance(signer, currencyAddr, price);
        const tx = await market.buy(listingId, { value: BigInt(0) });
        await tx.wait();
      }

      toast.success("Purchase successful.", { id: tId });

      await syncOwnerNow();
      await refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Buy failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    listing?.id,
    account,
    requireWalletToast,
    ensureErc20Allowance,
    syncOwnerNow,
    refresh,
    onAfterAction,
  ]);

  // -----------------------------
  // CANCEL LISTING
  // -----------------------------
  const cancelListing = useCallback(async () => {
    const listingIdStr = listing?.id;
    if (!listingIdStr) return;

    if (!account) {
      requireWalletToast();
      return;
    }

    const tId = toast.loading("Canceling listing…");
    setLoading(true);
    setErr(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(getMarketplaceAddress(), MARKET_ABI, signer);

      const tx = await market.cancelListing(BigInt(listingIdStr));
      await tx.wait();

      toast.success("Listing canceled.", { id: tId });

      await refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Cancel listing failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [listing?.id, account, requireWalletToast, refresh, onAfterAction]);

  // -----------------------------
  // AUCTION: CANCEL / FINALIZE / BID MIN / BID
  // -----------------------------
  const cancelAuction = useCallback(async () => {
    const auctionIdStr = auction?.id;
    if (!auctionIdStr) return;

    if (!account) {
      requireWalletToast();
      return;
    }

    const tId = toast.loading("Canceling auction…");
    setLoading(true);
    setErr(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(getMarketplaceAddress(), MARKET_ABI, signer);

      const tx = await market.cancelAuction(BigInt(auctionIdStr));
      await tx.wait();

      toast.success("Auction canceled.", { id: tId });

      await refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Cancel auction failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [auction?.id, account, requireWalletToast, refresh, onAfterAction]);

  const finalizeAuction = useCallback(async () => {
    const auctionIdStr = auction?.id;
    if (!auctionIdStr) return;

    if (!account) {
      requireWalletToast();
      return;
    }

    const tId = toast.loading("Finalizing auction…");
    setLoading(true);
    setErr(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(getMarketplaceAddress(), MARKET_ABI, signer);

      const auctionId = BigInt(auctionIdStr);

      const A = await market.auctions(auctionId);
      const endTime = Number(A[9] as bigint);
      const now = Math.floor(Date.now() / 1000);
      if (now <= endTime) throw new Error("Auction has not ended yet.");

      const tx = await market.finalize(auctionId);
      await tx.wait();

      toast.success("Auction finalized.", { id: tId });

      await syncOwnerNow();
      await refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Finalize failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [auction?.id, account, requireWalletToast, syncOwnerNow, refresh, onAfterAction]);

  const loadBidMin = useCallback(async () => {
    const auctionIdStr = auction?.id;
    if (!auctionIdStr) return;

    try {
      const anyWin = window as any;
      if (!anyWin.ethereum) return;

      const provider = new ethers.BrowserProvider(anyWin.ethereum);
      const market = new ethers.Contract(getMarketplaceAddress(), MARKET_ABI, provider);

      const A = await market.auctions(BigInt(auctionIdStr));

      const currencyAddr = (A[5] as string) ?? ethers.ZeroAddress;
      const startPrice = (A[6] as bigint) ?? BigInt(0);
      const minInc = (A[7] as bigint) ?? BigInt(0);
      const highestBid = (A[12] as bigint) ?? BigInt(0);
      const bidsCount = Number(A[13] as number);

      const minReq = bidsCount === 0 ? startPrice : highestBid + minInc;

      const sym =
        auction?.currency?.symbol ??
        (currencyAddr === ethers.ZeroAddress ? "ETN" : "TOKEN");

      const dec =
        auction?.currency?.decimals ??
        (currencyAddr === ethers.ZeroAddress ? 18 : 18);

      setBidSymbol(sym);
      setBidMinLabel(`${ethers.formatUnits(minReq, dec)} ${sym}`);
    } catch {
      setBidMinLabel(null);
      setBidSymbol(auction?.currency?.symbol ?? "ETN");
    }
  }, [auction?.id, auction?.currency?.symbol, auction?.currency?.decimals]);

  const placeBid = useCallback(async () => {
    const auctionIdStr = auction?.id;
    if (!auctionIdStr) return;

    if (!account) {
      requireWalletToast();
      return;
    }

    const amtStr = (bidAmount || "").trim();
    if (!amtStr || Number(amtStr) <= 0) {
      toast.error("Enter a valid bid amount.");
      setErr("Enter a valid bid amount.");
      return;
    }

    const tId = toast.loading("Placing bid…");
    setLoading(true);
    setErr(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(getMarketplaceAddress(), MARKET_ABI, signer);

      const auctionId = BigInt(auctionIdStr);
      const A = await market.auctions(auctionId);

      const currencyAddr = (A[5] as string) ?? ethers.ZeroAddress;
      const startPrice = (A[6] as bigint) ?? BigInt(0);
      const minInc = (A[7] as bigint) ?? BigInt(0);
      const endTime = Number(A[9] as bigint);
      const highestBid = (A[12] as bigint) ?? BigInt(0);
      const bidsCount = Number(A[13] as number);

      const now = Math.floor(Date.now() / 1000);
      if (now > endTime) throw new Error("Auction has ended. Finalize to settle.");

      const minReq = bidsCount === 0 ? startPrice : highestBid + minInc;

      const dec =
        currencyAddr === ethers.ZeroAddress ? 18 : auction?.currency?.decimals ?? 18;

      const bidUnits = ethers.parseUnits(amtStr, dec);

      if (bidUnits < minReq) {
        throw new Error(
          `Bid too low. Minimum is ${ethers.formatUnits(minReq, dec)} ${bidSymbol}.`
        );
      }

      if (currencyAddr === ethers.ZeroAddress) {
        const tx = await market.bid(auctionId, BigInt(0), { value: bidUnits });
        await tx.wait();
      } else {
        await ensureErc20Allowance(signer, currencyAddr, bidUnits);
        const tx = await market.bid(auctionId, bidUnits, { value: BigInt(0) });
        await tx.wait();
      }

      toast.success("Bid placed.", { id: tId });
      setBidOpen(false);
      setBidAmount("");
      setBidMinLabel(null);

      await refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Bid failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    auction?.id,
    account,
    bidAmount,
    bidSymbol,
    auction?.currency?.decimals,
    requireWalletToast,
    ensureErc20Allowance,
    refresh,
    onAfterAction,
  ]);

  // -----------------------------
  // CREATE LISTING (inline)
  // -----------------------------
  const createListing = useCallback(async () => {
    if (!account) {
      requireWalletToast();
      return;
    }
    if (!userOwns) {
      toast.error("Only the owner can list this NFT.");
      setErr("Only the owner can list this NFT.");
      return;
    }
    if (listing || auction) {
      toast.error("This NFT already has an active listing/auction.");
      setErr("This NFT already has an active listing/auction.");
      return;
    }

    const priceStr = (listPrice || "").trim();
    if (!priceStr || Number(priceStr) <= 0) {
      toast.error("Enter a valid price.");
      setErr("Enter a valid price.");
      return;
    }

    let qty = BigInt(1);
    if (standard === "ERC1155") {
      const q = Number((listQty || "0").trim());
      if (!Number.isFinite(q) || q <= 0) {
        toast.error("Enter a valid quantity.");
        setErr("Enter a valid quantity.");
        return;
      }
      qty = BigInt(q);
    }

    const cur = currencyById(listCurrencyId);
    const currencyAddr =
      cur.id === "native" ? ethers.ZeroAddress : (cur.tokenAddress ?? "");

    if (cur.id !== "native" && !ethers.isAddress(currencyAddr)) {
      toast.error("Selected ERC-20 currency is missing an address.");
      setErr("Selected ERC-20 currency is missing an address.");
      return;
    }

    const decimals = cur.decimals ?? 18;
    const priceUnits = ethers.parseUnits(priceStr, decimals);

    const startUnix = localYmdhmToUnix(listStart);
    const endUnix = listNoEnd ? 0 : (listEnd ? localYmdhmToUnix(listEnd) : 0);

    if (endUnix !== 0 && endUnix <= startUnix) {
      toast.error("End time must be after start time.");
      setErr("End time must be after start time.");
      return;
    }

    const tId = toast.loading("Creating listing…");
    setLoading(true);
    setErr(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(getMarketplaceAddress(), MARKET_ABI, signer);

      await ensureApprovalForAll(signer);

      const tx = await market.createListing(
        contract,
        BigInt(tokenId),
        qty,
        currencyAddr,
        priceUnits,
        startUnix,
        endUnix,
        stdEnum
      );
      await tx.wait();

      toast.success("Listing created.", { id: tId });
      closeOwnerPanels();

      await refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Create listing failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    account,
    userOwns,
    listing,
    auction,
    listPrice,
    listCurrencyId,
    listStart,
    listEnd,
    listNoEnd,
    listQty,
    standard,
    contract,
    tokenId,
    stdEnum,
    requireWalletToast,
    currencyById,
    ensureApprovalForAll,
    refresh,
    onAfterAction,
    closeOwnerPanels,
  ]);

  // -----------------------------
  // CREATE AUCTION (inline)
  // -----------------------------
  const createAuction = useCallback(async () => {
    if (!account) {
      requireWalletToast();
      return;
    }
    if (!userOwns) {
      toast.error("Only the owner can auction this NFT.");
      setErr("Only the owner can auction this NFT.");
      return;
    }
    if (listing || auction) {
      toast.error("This NFT already has an active listing/auction.");
      setErr("This NFT already has an active listing/auction.");
      return;
    }

    const spStr = (aucStartPrice || "").trim();
    if (!spStr || Number(spStr) <= 0) {
      toast.error("Enter a valid start price.");
      setErr("Enter a valid start price.");
      return;
    }

    const miStr = (aucMinInc || "").trim();
    if (!miStr || Number(miStr) <= 0) {
      toast.error("Enter a valid minimum increment.");
      setErr("Enter a valid minimum increment.");
      return;
    }

    let qty = BigInt(1);
    if (standard === "ERC1155") {
      const q = Number((aucQty || "0").trim());
      if (!Number.isFinite(q) || q <= 0) {
        toast.error("Enter a valid quantity.");
        setErr("Enter a valid quantity.");
        return;
      }
      qty = BigInt(q);
    }

    const cur = currencyById(aucCurrencyId);
    const currencyAddr =
      cur.id === "native" ? ethers.ZeroAddress : (cur.tokenAddress ?? "");

    if (cur.id !== "native" && !ethers.isAddress(currencyAddr)) {
      toast.error("Selected ERC-20 currency is missing an address.");
      setErr("Selected ERC-20 currency is missing an address.");
      return;
    }

    const decimals = cur.decimals ?? 18;
    const spUnits = ethers.parseUnits(spStr, decimals);
    const miUnits = ethers.parseUnits(miStr, decimals);

    const startUnix = localYmdhmToUnix(aucStart);
    const endUnix = localYmdhmToUnix(aucEnd);

    if (endUnix <= startUnix) {
      toast.error("Auction end time must be after start time.");
      setErr("Auction end time must be after start time.");
      return;
    }

    const tId = toast.loading("Creating auction…");
    setLoading(true);
    setErr(null);

    try {
      const signer = await getSigner();
      const market = new ethers.Contract(getMarketplaceAddress(), MARKET_ABI, signer);

      await ensureApprovalForAll(signer);

      const tx = await market.createAuction(
        contract,
        BigInt(tokenId),
        qty,
        currencyAddr,
        spUnits,
        miUnits,
        startUnix,
        endUnix,
        stdEnum
      );
      await tx.wait();

      toast.success("Auction created.", { id: tId });
      closeOwnerPanels();

      await refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Create auction failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    account,
    userOwns,
    listing,
    auction,
    aucStartPrice,
    aucMinInc,
    aucCurrencyId,
    aucStart,
    aucEnd,
    aucQty,
    standard,
    contract,
    tokenId,
    stdEnum,
    requireWalletToast,
    currencyById,
    ensureApprovalForAll,
    refresh,
    onAfterAction,
    closeOwnerPanels,
  ]);

  // -----------------------------
  // TRANSFER (inline)
  // -----------------------------
  const transferNow = useCallback(async () => {
    if (!account) {
      requireWalletToast();
      return;
    }
    if (!userOwns) {
      toast.error("Only the owner can transfer this NFT.");
      setErr("Only the owner can transfer this NFT.");
      return;
    }
    if (blockedByEscrow) {
      toast.error("Cancel listing/auction first.");
      setErr("Cancel listing/auction first.");
      return;
    }

    const to = (toAddr || "").trim();
    if (!ethers.isAddress(to)) {
      toast.error("Enter a valid recipient address.");
      setErr("Enter a valid recipient address.");
      return;
    }

    let qty = BigInt(1);
    if (standard === "ERC1155") {
      const q = Number((xferQty || "0").trim());
      if (!Number.isFinite(q) || q <= 0) {
        toast.error("Enter a valid quantity.");
        setErr("Enter a valid quantity.");
        return;
      }
      qty = BigInt(q);
    }

    const tId = toast.loading("Transferring…");
    setLoading(true);
    setErr(null);

    try {
      const signer = await getSigner();
      const from = await signer.getAddress();

      if (standard === "ERC1155") {
        const t = new ethers.Contract(contract, ERC1155_XFER_ABI, signer);
        const tx = await t.safeTransferFrom(from, to, BigInt(tokenId), qty, "0x");
        await tx.wait();
      } else {
        const t = new ethers.Contract(contract, ERC721_XFER_ABI, signer);
        const tx = await t.safeTransferFrom(from, to, BigInt(tokenId));
        await tx.wait();
      }

      toast.success("Transfer confirmed.", { id: tId });
      closeOwnerPanels();

      await syncOwnerNow();
      await refresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Transfer failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    account,
    userOwns,
    blockedByEscrow,
    toAddr,
    xferQty,
    standard,
    contract,
    tokenId,
    requireWalletToast,
    syncOwnerNow,
    refresh,
    onAfterAction,
    closeOwnerPanels,
  ]);

  const ownerActionSubtitle = useMemo(() => {
    if (!account) return "Connect your wallet to list, auction, or transfer.";
    if (!userOwns) return "Not owned by your connected wallet.";
    return "You own this NFT.";
  }, [account, userOwns]);

  const ownerButtonsDisabled = !account || !userOwns || blockedByEscrow || loading;

  return (
    <div className="space-y-4">
      {/* LISTING CARD */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Listing</div>
            <div className="mt-1 text-sm font-semibold">
              {listing ? (listingPriceLabel ?? "Active") : "No active listing"}
            </div>
            {listingSeller ? (
              <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                Seller: {listingSeller}
              </div>
            ) : null}
          </div>
        </div>

        {listing ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {standard === "ERC1155" ? (
              <ButtonLink
                href={`/list/${contract}/${tokenId}`}
                disabled={loading}
                title="ERC1155 can have multiple sellers — view all listings"
              >
                View listings
              </ButtonLink>
            ) : canManageListing ? (
              <Button variant="outline" onClick={() => void cancelListing()} disabled={loading}>
                Cancel listing
              </Button>
            ) : account ? (
              <Button onClick={() => void buyNow()} disabled={loading}>
                Buy now
              </Button>
            ) : (
              <Button variant="outline" onClick={requireWalletToast} disabled={loading}>
                Connect wallet to buy
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* AUCTION CARD */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Auction</div>
            <div className="mt-1 text-sm font-semibold">
              {auction ? (auctionPriceLabel ?? "Active") : "No active auction"}
            </div>
            {auctionSeller ? (
              <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                Seller: {auctionSeller}
              </div>
            ) : null}
          </div>
        </div>

        {auction ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {standard === "ERC1155" ? (
              <ButtonLink
                href={`/auctions/${contract}/${tokenId}`}
                disabled={loading}
                title="ERC1155 can have multiple sellers — view all auctions"
              >
                View auctions
              </ButtonLink>
            ) : auctionEndedUi ? (
              <Button variant="outline" onClick={() => void finalizeAuction()} disabled={loading}>
                Finalize auction
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBidOpen(true);
                    void loadBidMin();
                  }}
                  disabled={loading}
                >
                  Place bid
                </Button>

                {canManageAuction ? (
                  <Button
                    variant="ghost"
                    onClick={() => void cancelAuction()}
                    disabled={loading}
                    title="Seller can cancel before end"
                  >
                    Cancel auction
                  </Button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* OWNER ACTIONS (INLINE EXPAND PANELS) */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Owner actions</div>
            <div className="mt-1 text-sm font-semibold">{ownerActionSubtitle}</div>
            {blockedByEscrow ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Transfers are disabled while a listing/auction is active (cancel first).
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={ownerMode === "list" ? "primary" : "outline"}
            onClick={() => setOwnerMode((m) => (m === "list" ? "none" : "list"))}
            disabled={ownerButtonsDisabled}
            title={
              !userOwns
                ? "Only owner can list"
                : blockedByEscrow
                ? "Already listed/auctioned"
                : "Create a listing"
            }
          >
            List for sale
          </Button>

          <Button
            variant={ownerMode === "auction" ? "primary" : "outline"}
            onClick={() => setOwnerMode((m) => (m === "auction" ? "none" : "auction"))}
            disabled={ownerButtonsDisabled}
            title={
              !userOwns
                ? "Only owner can auction"
                : blockedByEscrow
                ? "Already listed/auctioned"
                : "Create an auction"
            }
          >
            Start auction
          </Button>

          <Button
            variant={ownerMode === "transfer" ? "primary" : "outline"}
            onClick={() => setOwnerMode((m) => (m === "transfer" ? "none" : "transfer"))}
            disabled={ownerButtonsDisabled}
            title={
              !userOwns
                ? "Only owner can transfer"
                : blockedByEscrow
                ? "Cancel listing/auction first"
                : "Transfer"
            }
          >
            Transfer
          </Button>
        </div>

        {/* INLINE PANELS */}
        <div className="mt-3 space-y-3">
          {/* LIST PANEL */}
          <Collapsible open={ownerMode === "list"}>
            <div className="mt-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Create listing</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    First time listing will prompt an approval (setApprovalForAll).
                  </div>
                </div>
                <Button variant="ghost" onClick={closeOwnerPanels} disabled={loading}>
                  Close
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <Input
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    placeholder="e.g. 10"
                    inputMode="decimal"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Currency</div>
                  <CurrencySelect
                    value={listCurrencyId}
                    onChange={setListCurrencyId}
                    options={currencies}
                    disabled={loading || currLoading}
                  />
                </div>

                <div className="space-y-1">
                  <DateTimePicker
                    label="Start time"
                    value={listStart}
                    onChange={setListStart}
                    minNow
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">End time</div>
                    <button
                      type="button"
                      className="text-xs underline opacity-80 hover:opacity-100"
                      onClick={() => setListNoEnd((v) => !v)}
                    >
                      {listNoEnd ? "Use end time" : "No end"}
                    </button>
                  </div>
                  <DateTimePicker
                    label=""
                    value={listNoEnd ? "" : listEnd}
                    onChange={setListEnd}
                    disabled={loading || listNoEnd}
                    minNow
                  />
                </div>

                {standard === "ERC1155" ? (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Quantity</div>
                    <Input
                      value={listQty}
                      onChange={(e) => setListQty(e.target.value)}
                      placeholder="e.g. 2"
                      inputMode="numeric"
                      disabled={loading}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Quantity</div>
                    <Input value="1 (ERC721)" disabled />
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={closeOwnerPanels} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={() => void createListing()} loading={loading} disabled={loading}>
                  Create listing
                </Button>
              </div>
            </div>
          </Collapsible>

          {/* AUCTION PANEL */}
          <Collapsible open={ownerMode === "auction"}>
            <div className="mt-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Create auction</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    First time auctioning will prompt an approval (setApprovalForAll).
                  </div>
                </div>
                <Button variant="ghost" onClick={closeOwnerPanels} disabled={loading}>
                  Close
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Start price</div>
                  <Input
                    value={aucStartPrice}
                    onChange={(e) => setAucStartPrice(e.target.value)}
                    placeholder="e.g. 10"
                    inputMode="decimal"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Min increment</div>
                  <Input
                    value={aucMinInc}
                    onChange={(e) => setAucMinInc(e.target.value)}
                    placeholder="e.g. 0.1"
                    inputMode="decimal"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Currency</div>
                  <CurrencySelect
                    value={aucCurrencyId}
                    onChange={setAucCurrencyId}
                    options={currencies}
                    disabled={loading || currLoading}
                  />
                </div>

                {standard === "ERC1155" ? (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Quantity</div>
                    <Input
                      value={aucQty}
                      onChange={(e) => setAucQty(e.target.value)}
                      placeholder="e.g. 2"
                      inputMode="numeric"
                      disabled={loading}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Quantity</div>
                    <Input value="1 (ERC721)" disabled />
                  </div>
                )}

                <div className="space-y-1">
                  <DateTimePicker
                    label="Start time"
                    value={aucStart}
                    onChange={setAucStart}
                    minNow
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1">
                  <DateTimePicker
                    label="End time"
                    value={aucEnd}
                    onChange={setAucEnd}
                    minNow
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={closeOwnerPanels} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={() => void createAuction()} loading={loading} disabled={loading}>
                  Create auction
                </Button>
              </div>
            </div>
          </Collapsible>

          {/* TRANSFER PANEL */}
          <Collapsible open={ownerMode === "transfer"}>
            <div className="mt-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Transfer NFT</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Transfers are disabled while a listing/auction is active (cancel first).
                  </div>
                </div>
                <Button variant="ghost" onClick={closeOwnerPanels} disabled={loading}>
                  Close
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Recipient</div>
                  <Input
                    value={toAddr}
                    onChange={(e) => setToAddr(e.target.value)}
                    placeholder="0x..."
                    className="font-mono"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Quantity</div>
                  {standard === "ERC1155" ? (
                    <Input
                      value={xferQty}
                      onChange={(e) => setXferQty(e.target.value)}
                      placeholder="e.g. 2"
                      inputMode="numeric"
                      disabled={loading}
                    />
                  ) : (
                    <Input value="1 (ERC721)" disabled />
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={closeOwnerPanels} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={() => void transferNow()} loading={loading} disabled={loading}>
                  Confirm transfer
                </Button>
              </div>
            </div>
          </Collapsible>
        </div>
      </div>

      {/* BID MODAL (kept) */}
      <Modal
        open={bidOpen}
        onClose={() => setBidOpen(false)}
        title="Place bid"
        className="max-w-md"
        zIndex={1_000_012}
      >
        <div className="space-y-4">
          {bidMinLabel ? (
            <div className="text-xs text-muted-foreground">
              Minimum required: <strong>{bidMinLabel}</strong>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Enter your bid amount.</div>
          )}

          <Input
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={`Amount (${bidSymbol})`}
            inputMode="decimal"
            disabled={loading}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBidOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={() => void placeBid()} loading={loading} disabled={loading}>
              Confirm bid
            </Button>
          </div>
        </div>
      </Modal>

      {err ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {err}
        </div>
      ) : null}
    </div>
  );
}
