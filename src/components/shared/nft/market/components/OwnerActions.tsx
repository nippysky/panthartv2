"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/shared/nft/market/components/OwnerActions.tsx

import * as React from "react";
import { ethers } from "ethers";
import { toast } from "sonner";

import { Button } from "@/src/ui/Button";
import { Modal } from "@/src/ui/Modal";
import { marketplace, type Standard } from "@/src/lib/services/marketplace";

type CurrencyLite = {
  id: string;
  kind: "NATIVE" | "ERC20" | string;
  symbol: string | null;
  decimals: number | null;
  tokenAddress: string | null;
};

type ListingLike =
  | {
      id: string; // chain id string (digits)
      dbId?: string | null;
      sellerAddress?: string | null;
      seller?: { address?: string | null; username?: string | null } | null;
      currency?: {
        kind?: string;
        symbol?: string | null;
        decimals?: number | null;
        tokenAddress?: string | null;
      } | null;
    }
  | null;

type AuctionLike =
  | {
      id: string; // chain id string (digits)
      dbId?: string | null;
      sellerAddress?: string | null;
      seller?: { address?: string | null; username?: string | null } | null;
      currency?: {
        kind?: string;
        symbol?: string | null;
        decimals?: number | null;
        tokenAddress?: string | null;
      } | null;
      bidsCount?: number | null;
    }
  | null;

export type OwnerMode = "none" | "list" | "auction" | "transfer";

function lc(s?: string | null) {
  return (s ?? "").toLowerCase();
}

function safeEqAddr(a?: string | null, b?: string | null) {
  try {
    if (!a || !b) return false;
    return ethers.getAddress(a) === ethers.getAddress(b);
  } catch {
    return lc(a) === lc(b);
  }
}

function isChainIdDigits(id: unknown): id is string {
  return typeof id === "string" && /^[0-9]+$/.test(id.trim());
}

function parseIntSafe(x: string) {
  const v = Number.parseInt(String(x).trim(), 10);
  return Number.isFinite(v) ? v : NaN;
}

function nowLocalInputValuePlusMinutes(minutes: number) {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Converts decimal string to wei BigInt using decimals */
function parseUnitsSafe(amount: string, decimals: number): bigint {
  const a = (amount || "").trim();
  if (!a) return BigInt(0);

  if (!/^\d+(\.\d+)?$/.test(a)) throw new Error("Invalid amount format.");

  const [whole, fracRaw = ""] = a.split(".");
  const frac = fracRaw.slice(0, decimals);
  const fracPadded = frac.padEnd(decimals, "0");

  const s = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, "");
  return BigInt(s || "0");
}

function humanError(e: unknown, fallback: string) {
  const anyE = e as any;
  const msg =
    anyE?.shortMessage ||
    anyE?.message ||
    (typeof anyE === "string" ? anyE : "") ||
    fallback;
  return String(msg);
}

function ActionChip({
  active,
  children,
  onClick,
  disabled,
  title,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition",
        "border border-border",
        active ? "bg-foreground text-background" : "bg-background hover:bg-card text-foreground",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm",
        "outline-none focus:ring-2 focus:ring-foreground/15 focus:border-foreground/30",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm",
        "outline-none focus:ring-2 focus:ring-foreground/15 focus:border-foreground/30",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Divider() {
  return <div className="my-4 h-px w-full bg-border" />;
}

export function OwnerActions({
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
}: {
  contract: string;
  tokenId: string;
  standard: Standard;

  account: string | null;
  owner?: string | null;

  listing: ListingLike;
  auction: AuctionLike;

  currencies: CurrencyLite[];
  currLoading: boolean;

  loading: boolean;
  setLoading: (v: boolean) => void;
  setErr: (v: string | null) => void;

  ownerMode: OwnerMode;
  setOwnerMode: (v: OwnerMode) => void;

  onRefresh: () => Promise<void> | void;
  onSyncOwnerNow: () => Promise<void> | void;
  onAfterAction?: () => void;
}) {
  // ----------------------------
  // Stable modal state
  // ----------------------------
  const [open, setOpen] = React.useState(false);
  const [localMode, setLocalMode] = React.useState<OwnerMode>("none");

  const openRef = React.useRef(open);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  const isConnected = !!account;
  const ownerUnknown = !owner;
  const isOwner = !!account && !!owner && safeEqAddr(account, owner);

  const hasActiveListing = !!listing && isChainIdDigits(listing.id);
  const hasActiveAuction = !!auction && isChainIdDigits(auction.id);

  // ✅ single source of truth: escrow/busy = NO owner actions at all
  const marketBusy = hasActiveListing || hasActiveAuction;

  const nativeCurrency = React.useMemo(() => {
    return currencies.find((c) => String(c.kind).toUpperCase() === "NATIVE") ?? null;
  }, [currencies]);

  const defaultCurrencyId = nativeCurrency?.id ?? currencies[0]?.id ?? "";

  const currencyById = React.useMemo(() => {
    const m = new Map<string, CurrencyLite>();
    for (const c of currencies) m.set(c.id, c);
    return m;
  }, [currencies]);

  const getCurrencyMeta = React.useCallback(
    (id: string) => {
      const c = currencyById.get(id) ?? null;
      const kind = String(c?.kind ?? "NATIVE").toUpperCase();
      const isNative = kind === "NATIVE";
      const decimals = Number(c?.decimals ?? 18) || 18;
      const symbol = (c?.symbol || (isNative ? "ETN" : "TOKEN")) as string;
      const tokenAddress = c?.tokenAddress ?? null;
      return { c, isNative, decimals, symbol, tokenAddress };
    },
    [currencyById]
  );

  // ----------------------------
  // Forms
  // ----------------------------
  const [listCurrencyId, setListCurrencyId] = React.useState(defaultCurrencyId);
  const [listPrice, setListPrice] = React.useState("");
  const [listQty, setListQty] = React.useState("1");
  const [listSchedule, setListSchedule] = React.useState(false);
  const [listStartAt, setListStartAt] = React.useState(nowLocalInputValuePlusMinutes(5));
  const [listEndEnabled, setListEndEnabled] = React.useState(false);
  const [listEndAt, setListEndAt] = React.useState(nowLocalInputValuePlusMinutes(60 * 24));

  const [aucCurrencyId, setAucCurrencyId] = React.useState(defaultCurrencyId);
  const [aucStartPrice, setAucStartPrice] = React.useState("");
  const [aucMinIncrement, setAucMinIncrement] = React.useState("");
  const [aucQty, setAucQty] = React.useState("1");
  const [aucSchedule, setAucSchedule] = React.useState(false);
  const [aucStartAt, setAucStartAt] = React.useState(nowLocalInputValuePlusMinutes(5));
  const [aucEndsAt, setAucEndsAt] = React.useState(nowLocalInputValuePlusMinutes(60));

  const [toAddr, setToAddr] = React.useState("");
  const [txQty, setTxQty] = React.useState("1");

  React.useEffect(() => {
    if (!listCurrencyId && defaultCurrencyId) setListCurrencyId(defaultCurrencyId);
    if (!aucCurrencyId && defaultCurrencyId) setAucCurrencyId(defaultCurrencyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCurrencyId]);

  React.useEffect(() => {
    if (openRef.current) return;
    setLocalMode(ownerMode);
  }, [ownerMode]);

  const close = React.useCallback(() => {
    setOpen(false);
    setLocalMode("none");
    setOwnerMode("none");
    setErr(null);
  }, [setOwnerMode, setErr]);

  const openMode = React.useCallback(
    (m: OwnerMode) => {
      if (!isConnected) {
        toast.error("Connect your wallet to continue.");
        setErr("Connect your wallet to continue.");
        return;
      }
      if (!isOwner) {
        toast.error("Only the owner can do this.");
        setErr("Only the owner can do this.");
        return;
      }

      // ✅ proactive: if it's escrowed (listed/auctioned), block *everything* including transfer
      if (marketBusy) {
        toast.error("This NFT is currently escrowed (listed/auctioned). Manage it from the active market state first.");
        setErr("This NFT is currently escrowed (listed/auctioned). Cancel/settle first.");
        return;
      }

      setOwnerMode(m);
      setLocalMode(m);
      setOpen(true);
      setErr(null);
    },
    [isConnected, isOwner, marketBusy, setOwnerMode, setErr]
  );

  React.useEffect(() => {
    if (!open) return;

    if (localMode === "list") {
      setListPrice("");
      setListQty("1");
      setListSchedule(false);
      setListStartAt(nowLocalInputValuePlusMinutes(5));
      setListEndEnabled(false);
      setListEndAt(nowLocalInputValuePlusMinutes(60 * 24));
      setListCurrencyId(defaultCurrencyId);
    }

    if (localMode === "auction") {
      setAucStartPrice("");
      setAucMinIncrement("");
      setAucQty("1");
      setAucSchedule(false);
      setAucStartAt(nowLocalInputValuePlusMinutes(5));
      setAucEndsAt(nowLocalInputValuePlusMinutes(60));
      setAucCurrencyId(defaultCurrencyId);
    }

    if (localMode === "transfer") {
      setToAddr("");
      setTxQty("1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, localMode]);

  function parseQty(q: string): number {
    const n = parseIntSafe(q);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.min(n, 10_000);
  }

  function parseDateInputToSec(v: string): number {
    const d = new Date(v);
    const ms = d.getTime();
    if (!Number.isFinite(ms)) return 0;
    return Math.floor(ms / 1000);
  }

  const actionHint = React.useMemo(() => {
    if (hasActiveAuction) return "This NFT already has an active auction.";
    if (hasActiveListing) return "This NFT already has an active listing.";
    return null;
  }, [hasActiveAuction, hasActiveListing]);

  const doSyncOwner = React.useCallback(async () => {
    const tId = toast.loading("Syncing owner…");
    setLoading(true);
    try {
      await onSyncOwnerNow?.();
      await onRefresh?.();
      toast.success("Owner synced.", { id: tId });
    } catch (e) {
      toast.error(humanError(e, "Sync failed."), { id: tId });
    } finally {
      setLoading(false);
    }
  }, [onSyncOwnerNow, onRefresh, setLoading]);

  const doList = React.useCallback(async () => {
    if (!isConnected || !account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }
    if (!isOwner) {
      toast.error("Only the owner can do this.");
      setErr("Only the owner can do this.");
      return;
    }
    if (marketBusy) {
      toast.error("This NFT is currently escrowed (listed/auctioned).");
      setErr("This NFT is currently escrowed (listed/auctioned).");
      return;
    }

    setErr(null);

    const { isNative, decimals, symbol, tokenAddress } = getCurrencyMeta(listCurrencyId);
    const qty = standard === "ERC1155" ? parseQty(listQty) : 1;

    if (!listPrice.trim()) {
      setErr("Enter a price.");
      toast.error("Enter a price.");
      return;
    }

    try {
      const priceWei = parseUnitsSafe(listPrice.trim(), decimals);
      if (priceWei <= BigInt(0)) throw new Error("Price must be greater than zero.");
    } catch (e) {
      const msg = humanError(e, "Invalid price.");
      setErr(msg);
      toast.error(msg);
      return;
    }

    const startSec = listSchedule ? parseDateInputToSec(listStartAt) : 0;
    const endSec = listEndEnabled ? parseDateInputToSec(listEndAt) : 0;

    if (listSchedule && startSec <= Math.floor(Date.now() / 1000) - 5) {
      setErr("Start time must be in the future.");
      toast.error("Start time must be in the future.");
      return;
    }
    if (listEndEnabled && endSec > 0 && listSchedule && endSec <= startSec) {
      setErr("End time must be after start time.");
      toast.error("End time must be after start time.");
      return;
    }

    const tId = toast.loading("Creating listing…");
    setLoading(true);

    try {
      const curAddr = (isNative
        ? marketplace.ZERO_ADDRESS
        : (tokenAddress as `0x${string}`)) as `0x${string}`;

      const txHash = await marketplace.createListingJustInTime({
        collection: ethers.getAddress(contract) as `0x${string}`,
        tokenId: BigInt(tokenId),
        quantity: BigInt(qty),
        standard,
        priceHuman: listPrice.trim(),
        currency: curAddr,
        startTimeSec: startSec,
        endTimeSec: endSec || 0,
      });

      if (txHash) {
        await fetch("/api/market/listing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHashCreated: txHash,
            contract,
            tokenId: String(tokenId),
            account,
          }),
        }).catch(() => null);
      }

      toast.success(`Listed for ${listPrice.trim()} ${symbol}`, { id: tId });

      await onRefresh?.();
      onAfterAction?.();
      // ✅ DO NOT close modal automatically
    } catch (e) {
      const msg = humanError(e, "Create listing failed.");
      setErr(msg);
      toast.error(msg, { id: tId });
    } finally {
      setLoading(false);
    }
  }, [
    isConnected,
    account,
    isOwner,
    marketBusy,
    setErr,
    getCurrencyMeta,
    listCurrencyId,
    standard,
    listQty,
    listPrice,
    listSchedule,
    listStartAt,
    listEndEnabled,
    listEndAt,
    setLoading,
    contract,
    tokenId,
    onRefresh,
    onAfterAction,
  ]);

  const doAuction = React.useCallback(async () => {
    if (!isConnected || !account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }
    if (!isOwner) {
      toast.error("Only the owner can do this.");
      setErr("Only the owner can do this.");
      return;
    }
    if (marketBusy) {
      toast.error("This NFT is currently escrowed (listed/auctioned).");
      setErr("This NFT is currently escrowed (listed/auctioned).");
      return;
    }

    setErr(null);

    const { isNative, decimals, symbol, tokenAddress } = getCurrencyMeta(aucCurrencyId);
    const qty = standard === "ERC1155" ? parseQty(aucQty) : 1;

    if (!aucStartPrice.trim()) {
      setErr("Enter a start price.");
      toast.error("Enter a start price.");
      return;
    }

    try {
      const startWei = parseUnitsSafe(aucStartPrice.trim(), decimals);
      if (startWei <= BigInt(0)) throw new Error("Start price must be greater than zero.");
    } catch (e) {
      const msg = humanError(e, "Invalid start price.");
      setErr(msg);
      toast.error(msg);
      return;
    }

    try {
      const incWei = aucMinIncrement.trim()
        ? parseUnitsSafe(aucMinIncrement.trim(), decimals)
        : BigInt(0);
      if (incWei < BigInt(0)) throw new Error("Invalid increment.");
    } catch (e) {
      const msg = humanError(e, "Invalid increment.");
      setErr(msg);
      toast.error(msg);
      return;
    }

    const startSec = aucSchedule ? parseDateInputToSec(aucStartAt) : 0;
    const endSec = parseDateInputToSec(aucEndsAt);

    if (aucSchedule && startSec <= Math.floor(Date.now() / 1000) - 5) {
      setErr("Start time must be in the future.");
      toast.error("Start time must be in the future.");
      return;
    }
    if (!endSec || endSec <= Math.floor(Date.now() / 1000) + 30) {
      setErr("End time must be at least 30 seconds in the future.");
      toast.error("End time must be at least 30 seconds in the future.");
      return;
    }
    if (aucSchedule && startSec > 0 && endSec <= startSec + 30) {
      setErr("End time must be after start time.");
      toast.error("End time must be after start time.");
      return;
    }

    const tId = toast.loading("Creating auction…");
    setLoading(true);

    try {
      const curAddr = (isNative
        ? marketplace.ZERO_ADDRESS
        : (tokenAddress as `0x${string}`)) as `0x${string}`;

      const txHash = await marketplace.createAuctionJustInTime({
        collection: ethers.getAddress(contract) as `0x${string}`,
        tokenId: BigInt(tokenId),
        quantity: BigInt(qty),
        standard,
        startPriceHuman: aucStartPrice.trim(),
        minIncrementHuman: aucMinIncrement.trim() || "0",
        currency: curAddr,
        startTimeSec: startSec,
        endTimeSec: endSec,
      });

      if (txHash) {
        await fetch("/api/market/auction/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHashCreated: txHash,
            contract,
            tokenId: String(tokenId),
            account,
          }),
        }).catch(() => null);
      }

      toast.success(`Auction created (${aucStartPrice.trim()} ${symbol} start)`, { id: tId });

      await onRefresh?.();
      onAfterAction?.();
      // ✅ DO NOT close modal automatically
    } catch (e) {
      const msg = humanError(e, "Create auction failed.");
      setErr(msg);
      toast.error(msg, { id: tId });
    } finally {
      setLoading(false);
    }
  }, [
    isConnected,
    account,
    isOwner,
    marketBusy,
    setErr,
    getCurrencyMeta,
    aucCurrencyId,
    standard,
    aucQty,
    aucStartPrice,
    aucMinIncrement,
    aucSchedule,
    aucStartAt,
    aucEndsAt,
    setLoading,
    contract,
    tokenId,
    onRefresh,
    onAfterAction,
  ]);

  const doTransfer = React.useCallback(async () => {
    if (!isConnected || !account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }
    if (!isOwner) {
      toast.error("Only the owner can do this.");
      setErr("Only the owner can do this.");
      return;
    }
    if (marketBusy) {
      toast.error("This NFT is currently escrowed (listed/auctioned). Cancel/settle first.");
      setErr("This NFT is currently escrowed (listed/auctioned). Cancel/settle first.");
      return;
    }

    setErr(null);

    const to = toAddr.trim();
    if (!to || !ethers.isAddress(to)) {
      setErr("Enter a valid recipient address.");
      toast.error("Enter a valid recipient address.");
      return;
    }

    const qty = standard === "ERC1155" ? parseQty(txQty) : 1;

    const tId = toast.loading("Transferring…");
    setLoading(true);

    try {
      await marketplace.transferNft({
        collection: ethers.getAddress(contract) as `0x${string}`,
        tokenId: BigInt(tokenId),
        standard,
        to: ethers.getAddress(to) as `0x${string}`,
        amount: BigInt(qty),
      });

      toast.success("Transfer submitted.", { id: tId });

      await onSyncOwnerNow?.();
      await onRefresh?.();
      onAfterAction?.();
      // ✅ DO NOT close modal automatically
    } catch (e) {
      const msg = humanError(e, "Transfer failed.");
      setErr(msg);
      toast.error(msg, { id: tId });
    } finally {
      setLoading(false);
    }
  }, [
    isConnected,
    account,
    isOwner,
    marketBusy,
    setErr,
    toAddr,
    standard,
    txQty,
    contract,
    tokenId,
    setLoading,
    onSyncOwnerNow,
    onRefresh,
    onAfterAction,
  ]);

  const modalTitle =
    localMode === "list"
      ? "Create listing"
      : localMode === "auction"
      ? "Create auction"
      : localMode === "transfer"
      ? "Transfer"
      : "Owner actions";

  const canShowOwnerActions = isConnected && !ownerUnknown && isOwner;
  const showSyncCard = isConnected && ownerUnknown;

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Owner actions</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {showSyncCard
              ? "Owner isn’t synced yet. Sync to enable owner actions."
              : canShowOwnerActions
              ? marketBusy
                ? "This NFT is currently escrowed (listed/auctioned). Manage it from the active market state."
                : "List, auction, or transfer — all in one clean flow."
              : isConnected
              ? "Connect as the owner wallet to manage this NFT."
              : "Connect your wallet to manage this NFT."}
          </div>
        </div>
      </div>

      {showSyncCard ? (
        <div className="mt-3">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void doSyncOwner()}>
            Sync owner
          </Button>
        </div>
      ) : null}

      {canShowOwnerActions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionChip
            active={localMode === "list" && open}
            onClick={() => openMode("list")}
            disabled={loading || currLoading || marketBusy}
            title={
              marketBusy
                ? "This NFT is currently escrowed (listed/auctioned)"
                : currLoading
                ? "Loading currencies…"
                : "Create a fixed-price listing"
            }
          >
            List
          </ActionChip>

          <ActionChip
            active={localMode === "auction" && open}
            onClick={() => openMode("auction")}
            disabled={loading || currLoading || marketBusy}
            title={
              marketBusy
                ? "This NFT is currently escrowed (listed/auctioned)"
                : currLoading
                ? "Loading currencies…"
                : "Create an auction"
            }
          >
            Auction
          </ActionChip>

          <ActionChip
            active={localMode === "transfer" && open}
            onClick={() => openMode("transfer")}
            disabled={loading || marketBusy}
            title={
              marketBusy
                ? "This NFT is currently escrowed (listed/auctioned). Cancel/settle first."
                : "Transfer to another address"
            }
          >
            Transfer
          </ActionChip>
        </div>
      ) : null}

      {/* ✅ Modal should NOT close on backdrop click / ESC.
          Users must use the in-modal Cancel button. */}
      <Modal
        open={open}
        onClose={close}
        closeOnBackdrop={false}
        closeOnEsc={false}
        title={
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate">{modalTitle}</div>
              <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                {standard} · {contract.slice(0, 6)}…{contract.slice(-4)} · #{tokenId}
              </div>
            </div>
          </div>
        }
        className="max-w-xl"
      >
        {actionHint ? (
          <div className="mb-4 rounded-2xl border border-border bg-background p-3 text-sm">
            <div className="font-medium">Heads up</div>
            <div className="mt-1 text-xs text-muted-foreground">{actionHint}</div>
          </div>
        ) : null}

        {localMode === "list" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Currency" hint="How buyers pay">
                <Select
                  value={listCurrencyId}
                  onChange={(e) => setListCurrencyId(e.target.value)}
                  disabled={currLoading}
                >
                  {currencies.map((c) => {
                    const k = String(c.kind).toUpperCase();
                    const sym = c.symbol ?? (k === "NATIVE" ? "ETN" : "TOKEN");
                    return (
                      <option key={c.id} value={c.id}>
                        {sym} {k === "NATIVE" ? "(Native)" : ""}
                      </option>
                    );
                  })}
                </Select>
              </Field>

              <Field label="Price" hint="Per item">
                <Input
                  inputMode="decimal"
                  placeholder="0.0"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                />
              </Field>
            </div>

            {standard === "ERC1155" ? (
              <Field label="Quantity" hint="How many units to list">
                <Input
                  inputMode="numeric"
                  placeholder="1"
                  value={listQty}
                  onChange={(e) => setListQty(e.target.value)}
                />
              </Field>
            ) : null}

            <Divider />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Schedule start" hint="Optional">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={listSchedule}
                    onChange={(e) => setListSchedule(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <div className="text-sm">Enable</div>
                </div>
                <div className="mt-2">
                  <Input
                    type="datetime-local"
                    value={listStartAt}
                    onChange={(e) => setListStartAt(e.target.value)}
                    disabled={!listSchedule}
                  />
                </div>
              </Field>

              <Field label="End time" hint="Optional">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={listEndEnabled}
                    onChange={(e) => setListEndEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <div className="text-sm">Enable</div>
                </div>
                <div className="mt-2">
                  <Input
                    type="datetime-local"
                    value={listEndAt}
                    onChange={(e) => setListEndAt(e.target.value)}
                    disabled={!listEndEnabled}
                  />
                </div>
              </Field>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={close} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={() => void doList()}
                disabled={loading || currLoading || marketBusy}
              >
                Create listing
              </Button>
            </div>
          </div>
        ) : null}

        {localMode === "auction" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Currency" hint="Bids are in this currency">
                <Select
                  value={aucCurrencyId}
                  onChange={(e) => setAucCurrencyId(e.target.value)}
                  disabled={currLoading}
                >
                  {currencies.map((c) => {
                    const k = String(c.kind).toUpperCase();
                    const sym = c.symbol ?? (k === "NATIVE" ? "ETN" : "TOKEN");
                    return (
                      <option key={c.id} value={c.id}>
                        {sym} {k === "NATIVE" ? "(Native)" : ""}
                      </option>
                    );
                  })}
                </Select>
              </Field>

              <Field label="Start price" hint="Minimum opening bid">
                <Input
                  inputMode="decimal"
                  placeholder="0.0"
                  value={aucStartPrice}
                  onChange={(e) => setAucStartPrice(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Min increment" hint="Optional">
                <Input
                  inputMode="decimal"
                  placeholder="0.0"
                  value={aucMinIncrement}
                  onChange={(e) => setAucMinIncrement(e.target.value)}
                />
              </Field>

              <Field label="End time" hint="Required">
                <Input
                  type="datetime-local"
                  value={aucEndsAt}
                  onChange={(e) => setAucEndsAt(e.target.value)}
                />
              </Field>
            </div>

            {standard === "ERC1155" ? (
              <Field label="Quantity" hint="How many units to auction">
                <Input
                  inputMode="numeric"
                  placeholder="1"
                  value={aucQty}
                  onChange={(e) => setAucQty(e.target.value)}
                />
              </Field>
            ) : null}

            <Field label="Schedule start" hint="Optional">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={aucSchedule}
                  onChange={(e) => setAucSchedule(e.target.checked)}
                  className="h-4 w-4"
                />
                <div className="text-sm">Enable</div>
              </div>
              <div className="mt-2">
                <Input
                  type="datetime-local"
                  value={aucStartAt}
                  onChange={(e) => setAucStartAt(e.target.value)}
                  disabled={!aucSchedule}
                />
              </div>
            </Field>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={close} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={() => void doAuction()}
                disabled={loading || currLoading || marketBusy}
              >
                Create auction
              </Button>
            </div>
          </div>
        ) : null}

        {localMode === "transfer" ? (
          <div className="space-y-4">
            <Field label="Recipient address" hint="0x…">
              <Input
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="0x1234…"
                value={toAddr}
                onChange={(e) => setToAddr(e.target.value)}
              />
            </Field>

            {standard === "ERC1155" ? (
              <Field label="Quantity" hint="Units to transfer">
                <Input
                  inputMode="numeric"
                  placeholder="1"
                  value={txQty}
                  onChange={(e) => setTxQty(e.target.value)}
                />
              </Field>
            ) : null}

            <div className="rounded-2xl border border-border bg-background p-3 text-xs text-muted-foreground">
              Transfers require ownership. If this NFT is currently escrowed (listed/auctioned),
              you must cancel or settle first.
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={close} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={() => void doTransfer()} disabled={loading || marketBusy}>
                Transfer
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}