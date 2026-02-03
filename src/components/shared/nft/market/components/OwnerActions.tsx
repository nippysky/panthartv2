"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { toast } from "sonner";
import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";
import DateTimePicker from "@/src/components/shared/DateTimePicker";
import { CurrencySelect } from "@/src/components/shared/nft/CurrencySelector";

import { marketplace, type Standard } from "@/src/lib/services/marketplace";
import type {
  AuctionActiveItem,
  CurrencyOption,
  ListingActiveItem,
  OwnerMode,
} from "../types";
import {
  addDaysLocalYmdhm,
  confirmAuctionRow,
  confirmListingRow,
  errorMessage,
  localYmdhmToUnix,
  toLocalYMDHM,
} from "../utils";
import { Collapsible } from "./Collapsible";

export function OwnerActions(props: {
  contract: string;
  tokenId: string;
  standard: Standard;

  account: string | null;
  owner?: string | null;

  listing: ListingActiveItem | null;
  auction: AuctionActiveItem | null;

  currencies: CurrencyOption[];
  currLoading: boolean;

  loading: boolean;
  setLoading: (v: boolean) => void;
  setErr: (v: string | null) => void;

  ownerMode: OwnerMode;
  setOwnerMode: React.Dispatch<React.SetStateAction<OwnerMode>>;

  onRefresh: () => Promise<void>;
  onSyncOwnerNow: () => Promise<void>;
  onAfterAction?: () => void;
}) {
  const {
    contract,
    tokenId,
    standard,
    account,
    owner,
    listing,
    auction,
    currencies,
    currLoading,
    loading,
    setLoading,
    setErr,
    ownerMode,
    setOwnerMode,
    onRefresh,
    onSyncOwnerNow,
    onAfterAction,
  } = props;

  // ✅ hydration safety: don’t render account-based decisions until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // IMPORTANT: accountStable is null on first render (server + first client paint)
  const accountStable = mounted ? account : null;

  const closeOwnerPanels = useCallback(() => setOwnerMode("none"), [setOwnerMode]);

  const userOwns = useMemo(() => {
    if (!accountStable || !owner) return false;
    try {
      return ethers.getAddress(accountStable) === ethers.getAddress(owner);
    } catch {
      return accountStable === owner;
    }
  }, [accountStable, owner]);

  const blockedByEscrow = !!listing || !!auction;

  const requireWalletToast = useCallback(() => {
    toast.error("Wallet not connected.");
    setErr("Connect your wallet to continue.");
  }, [setErr]);

  const currencyById = useCallback(
    (id: string) => currencies.find((c) => c.id === id) ?? currencies[0],
    [currencies]
  );

  // ✅ make form defaults mount-deterministic to avoid any dev hydration weirdness
  const [listPrice, setListPrice] = useState("");
  const [listCurrencyId, setListCurrencyId] = useState("native");
  const [listStart, setListStart] = useState<string>(""); // set on mount
  const [listEnd, setListEnd] = useState<string>(""); // set on mount
  const [listQty, setListQty] = useState("1");

  const [aucStartPrice, setAucStartPrice] = useState("");
  const [aucMinInc, setAucMinInc] = useState("0.1");
  const [aucCurrencyId, setAucCurrencyId] = useState("native");
  const [aucStart, setAucStart] = useState<string>(""); // set on mount
  const [aucEnd, setAucEnd] = useState<string>(""); // set on mount
  const [aucQty, setAucQty] = useState("1");

  const [toAddr, setToAddr] = useState("");
  const [xferQty, setXferQty] = useState("1");

  useEffect(() => {
    // initialize once after mount
    const now = toLocalYMDHM(new Date());
    setListStart((v) => v || now);
    setListEnd((v) => v || addDaysLocalYmdhm(7));

    setAucStart((v) => v || now);
    setAucEnd((v) => v || addDaysLocalYmdhm(7));
  }, []);

  const ownerActionSubtitle = useMemo(() => {
    // ✅ keep server + first client render identical
    if (!accountStable) return "Connect your wallet to list, auction, or transfer.";
    if (userOwns)
      return blockedByEscrow
        ? "You own this NFT (currently in market state)."
        : "You own this NFT.";
    return "Not owned by your connected wallet.";
  }, [accountStable, userOwns, blockedByEscrow]);

  const ownerButtonsDisabled = !accountStable || !userOwns || blockedByEscrow || loading;

  const createListing = useCallback(async () => {
    if (!accountStable) return requireWalletToast();
    if (!userOwns) return setErr("Only the owner can list this NFT.");
    if (listing || auction) return setErr("This NFT already has an active listing/auction.");

    const priceStr = (listPrice || "").trim();
    if (!priceStr || Number(priceStr) <= 0) return setErr("Enter a valid price.");

    let qty = BigInt(1);
    if (standard === "ERC1155") {
      const q = Number((listQty || "0").trim());
      if (!Number.isFinite(q) || q <= 0) return setErr("Enter a valid quantity.");
      qty = BigInt(q);
    }

    const cur = currencyById(listCurrencyId);
    const currencyAddr =
      cur.id === "native"
        ? (marketplace.ZERO_ADDRESS as `0x${string}`)
        : (cur.tokenAddress as `0x${string}` | null);

    if (cur.id !== "native" && (!currencyAddr || !ethers.isAddress(currencyAddr))) {
      return setErr("Selected ERC-20 currency is missing an address.");
    }

    if (!listStart || !listEnd) return setErr("Please set start/end time.");

    const startUnix = localYmdhmToUnix(listStart);
    const endUnix = localYmdhmToUnix(listEnd);
    if (endUnix <= startUnix) return setErr("End time must be after start time.");

    const tId = toast.loading("Creating listing…");
    setLoading(true);
    setErr(null);

    try {
      const txHash = await marketplace.createListingJustInTime({
        collection: contract as `0x${string}`,
        tokenId: BigInt(tokenId),
        standard,
        priceHuman: priceStr,
        currency: (currencyAddr ?? marketplace.ZERO_ADDRESS) as `0x${string}`,
        quantity: qty,
        startTimeSec: startUnix,
        endTimeSec: endUnix,
      });

      await confirmListingRow({
        txHashCreated: txHash,
        contract,
        tokenId,
        account: accountStable,
      }).catch(() => null);

      toast.success("Listing created.", { id: tId });
      closeOwnerPanels();
      await onRefresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Create listing failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    accountStable,
    userOwns,
    listing,
    auction,
    listPrice,
    listCurrencyId,
    listStart,
    listEnd,
    listQty,
    standard,
    contract,
    tokenId,
    requireWalletToast,
    currencyById,
    onRefresh,
    onAfterAction,
    closeOwnerPanels,
    setLoading,
    setErr,
  ]);

  const createAuction = useCallback(async () => {
    if (!accountStable) return requireWalletToast();
    if (!userOwns) return setErr("Only the owner can auction this NFT.");
    if (listing || auction) return setErr("This NFT already has an active listing/auction.");

    const spStr = (aucStartPrice || "").trim();
    if (!spStr || Number(spStr) <= 0) return setErr("Enter a valid start price.");

    const miStr = (aucMinInc || "").trim();
    if (!miStr || Number(miStr) <= 0) return setErr("Enter a valid minimum increment.");

    let qty = BigInt(1);
    if (standard === "ERC1155") {
      const q = Number((aucQty || "0").trim());
      if (!Number.isFinite(q) || q <= 0) return setErr("Enter a valid quantity.");
      qty = BigInt(q);
    }

    const cur = currencyById(aucCurrencyId);
    const currencyAddr =
      cur.id === "native"
        ? (marketplace.ZERO_ADDRESS as `0x${string}`)
        : (cur.tokenAddress as `0x${string}` | null);

    if (cur.id !== "native" && (!currencyAddr || !ethers.isAddress(currencyAddr))) {
      return setErr("Selected ERC-20 currency is missing an address.");
    }

    if (!aucStart || !aucEnd) return setErr("Please set start/end time.");

    const startUnix = localYmdhmToUnix(aucStart);
    const endUnix = localYmdhmToUnix(aucEnd);
    if (endUnix <= startUnix) return setErr("Auction end time must be after start time.");

    const tId = toast.loading("Creating auction…");
    setLoading(true);
    setErr(null);

    try {
      const txHash = await marketplace.createAuctionJustInTime({
        collection: contract as `0x${string}`,
        tokenId: BigInt(tokenId),
        standard,
        startPriceHuman: spStr,
        minIncrementHuman: miStr,
        currency: (currencyAddr ?? marketplace.ZERO_ADDRESS) as `0x${string}`,
        quantity: qty,
        startTimeSec: startUnix,
        endTimeSec: endUnix,
      });

      await confirmAuctionRow({
        txHashCreated: txHash,
        contract,
        tokenId,
        account: accountStable,
      }).catch(() => null);

      toast.success("Auction created.", { id: tId });
      closeOwnerPanels();
      await onRefresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Create auction failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    accountStable,
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
    requireWalletToast,
    currencyById,
    onRefresh,
    onAfterAction,
    closeOwnerPanels,
    setLoading,
    setErr,
  ]);

  const transferNow = useCallback(async () => {
    if (!accountStable) return requireWalletToast();
    if (!userOwns) return setErr("Only the owner can transfer this NFT.");
    if (blockedByEscrow) return setErr("Cancel listing/auction first.");

    const to = (toAddr || "").trim();
    if (!ethers.isAddress(to)) return setErr("Enter a valid recipient address.");

    let qty = BigInt(1);
    if (standard === "ERC1155") {
      const q = Number((xferQty || "0").trim());
      if (!Number.isFinite(q) || q <= 0) return setErr("Enter a valid quantity.");
      qty = BigInt(q);
    }

    const tId = toast.loading("Transferring…");
    setLoading(true);
    setErr(null);

    try {
      await marketplace.transferNft({
        collection: contract as `0x${string}`,
        tokenId: BigInt(tokenId),
        standard,
        to: to as `0x${string}`,
        amount: qty,
      });

      toast.success("Transfer confirmed.", { id: tId });
      closeOwnerPanels();

      await onSyncOwnerNow();
      await onRefresh();
      onAfterAction?.();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Transfer failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [
    accountStable,
    userOwns,
    blockedByEscrow,
    toAddr,
    xferQty,
    standard,
    contract,
    tokenId,
    requireWalletToast,
    onSyncOwnerNow,
    onRefresh,
    onAfterAction,
    closeOwnerPanels,
    setLoading,
    setErr,
  ]);

  return (
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
          variant={"primary"}
          onClick={() => setOwnerMode((m) => (m === "list" ? "none" : "list"))}
          disabled={ownerButtonsDisabled}
        >
          List for sale
        </Button>

        <Button
          variant={"primary"}
          onClick={() => setOwnerMode((m) => (m === "auction" ? "none" : "auction"))}
          disabled={ownerButtonsDisabled}
        >
          Start auction
        </Button>

        <Button
          variant={"primary"}
          onClick={() => setOwnerMode((m) => (m === "transfer" ? "none" : "transfer"))}
          disabled={ownerButtonsDisabled}
        >
          Transfer
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        {/* LIST PANEL */}
        <Collapsible open={ownerMode === "list"}>
          <div className="mt-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Create listing</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Listing requires marketplace approval (setApprovalForAll).
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
                  options={currencies as any}
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
                <DateTimePicker
                  label="End time"
                  value={listEnd}
                  onChange={setListEnd}
                  minNow
                  disabled={loading}
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
                  Auction requires marketplace approval (setApprovalForAll).
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
                  options={currencies as any}
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
  );
}
