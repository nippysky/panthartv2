"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/shared/nft/market/components/OwnerActions.tsx

import * as React from "react";
import { useRouter } from "next/navigation";
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
      id: string;
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
      id: string;
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

type ConfirmSuccessPayload = {
  ok: true;
  kind?: "listing" | "auction";
  reconciled?: boolean;
  status?: string;
  result?: {
    kind?: "listing" | "auction";
    status?: string;
    listingId?: string;
    auctionId?: string;
    dbId?: string;
    sellerAddress?: string;
    quantity?: number;
    scheduled?: boolean;
    settled?: boolean;
    bidsCount?: number;
    startTime?: string;
    endTime?: string | null;
  } | null;
  listingId?: string;
  auctionId?: string;
  dbId?: string;
  sellerAddress?: string;
  quantity?: number;
  scheduled?: boolean;
  settled?: boolean;
  bidsCount?: number;
  startTime?: string;
  endTime?: string | null;
  [k: string]: unknown;
};

type ConfirmErrorPayload = {
  ok?: false;
  error?: string;
  step?: string;
  kind?: string;
  [k: string]: unknown;
};

type ConfirmOk = ConfirmSuccessPayload | ConfirmErrorPayload | null;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!res) {
    return {
      ok: false,
      status: 0,
      json: null as ConfirmOk,
    };
  }

  const json = (await res.json().catch(() => null)) as ConfirmOk;
  return {
    ok: res.ok && json?.ok === true,
    status: res.status,
    json,
  };
}

function extractConfirmData(json: ConfirmOk) {
  if (!json || json.ok !== true) return null;

  const nested =
    json.result && typeof json.result === "object"
      ? (json.result as NonNullable<ConfirmSuccessPayload["result"]>)
      : null;

  const kind = (nested?.kind ?? json.kind ?? null) as "listing" | "auction" | null;
  const status = String(nested?.status ?? json.status ?? "");
  const quantity = Number(nested?.quantity ?? json.quantity ?? 0) || 0;
  const bidsCount = Number(nested?.bidsCount ?? json.bidsCount ?? 0) || 0;
  const scheduled = Boolean(nested?.scheduled ?? json.scheduled ?? false);
  const settled = Boolean(nested?.settled ?? json.settled ?? false);
  const listingId = String(nested?.listingId ?? json.listingId ?? "");
  const auctionId = String(nested?.auctionId ?? json.auctionId ?? "");
  const dbId = String(nested?.dbId ?? json.dbId ?? "");
  const sellerAddress = String(nested?.sellerAddress ?? json.sellerAddress ?? "");
  const startTime =
    typeof (nested?.startTime ?? json.startTime) === "string"
      ? String(nested?.startTime ?? json.startTime)
      : "";
  const endTime =
    typeof (nested?.endTime ?? json.endTime) === "string"
      ? String(nested?.endTime ?? json.endTime)
      : null;

  return {
    kind,
    status,
    quantity,
    bidsCount,
    scheduled,
    settled,
    listingId,
    auctionId,
    dbId,
    sellerAddress,
    startTime,
    endTime,
  };
}

function buildSuccessMessage(args: {
  expectedKind: "listing" | "auction";
  reconciled: boolean;
  symbol: string;
  priceText?: string;
  json: ConfirmOk;
}) {
  const data = extractConfirmData(args.json);
  const status = data?.status?.toUpperCase() ?? "";

  if (args.expectedKind === "listing") {
    if (args.reconciled) {
      if (status === "SOLD") return "Listing recovered, but it is already sold.";
      if (status === "EXPIRED") return "Listing recovered, but it has already expired.";
      if (status === "CANCELLED") return "Listing recovered, but it is no longer active.";
      if (data?.scheduled) return "Listing created and synced. It is scheduled.";
      return args.priceText
        ? `Listing created and synced for ${args.priceText} ${args.symbol}.`
        : "Listing created and synced.";
    }

    if (status === "SOLD") return "Listing created, but it is already sold.";
    if (status === "EXPIRED") return "Listing created, but it has already expired.";
    if (status === "CANCELLED") return "Listing created, but it is no longer active.";
    if (data?.scheduled) {
      return args.priceText
        ? `Listing scheduled for ${args.priceText} ${args.symbol}.`
        : "Listing scheduled successfully.";
    }

    return args.priceText
      ? `Listed for ${args.priceText} ${args.symbol}.`
      : "Listing created successfully.";
  }

  if (args.reconciled) {
    if (status === "ENDED") return "Auction recovered, but it has already ended.";
    if (status === "CANCELLED") return "Auction recovered, but it is no longer active.";
    if (data?.scheduled) return "Auction created and synced. It is scheduled.";
    return args.priceText
      ? `Auction created and synced (${args.priceText} ${args.symbol} start).`
      : "Auction created and synced.";
  }

  if (status === "ENDED") return "Auction created, but it has already ended.";
  if (status === "CANCELLED") return "Auction created, but it is no longer active.";
  if (data?.scheduled) {
    return args.priceText
      ? `Auction scheduled (${args.priceText} ${args.symbol} start).`
      : "Auction scheduled successfully.";
  }

  return args.priceText
    ? `Auction created (${args.priceText} ${args.symbol} start).`
    : "Auction created successfully.";
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
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [localMode, setLocalMode] = React.useState<OwnerMode>("none");

  const [holderBalance, setHolderBalance] = React.useState<number>(0);
  const [holderLoading, setHolderLoading] = React.useState(false);

  const [ownBusyListingId, setOwnBusyListingId] = React.useState<string | null>(null);
  const [ownBusyAuctionId, setOwnBusyAuctionId] = React.useState<string | null>(null);
  const [ownBusyListingQty, setOwnBusyListingQty] = React.useState<number>(0);
  const [ownBusyAuctionQty, setOwnBusyAuctionQty] = React.useState<number>(0);

  const openRef = React.useRef(open);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  const isConnected = !!account;
  const ownerUnknown = !owner;

  const isErc721Owner = !!account && !!owner && safeEqAddr(account, owner);
  const hasActiveListing = !!listing && isChainIdDigits(listing.id);
  const hasActiveAuction = !!auction && isChainIdDigits(auction.id);

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

  React.useEffect(() => {
    if (!account || standard !== "ERC1155") {
      setHolderBalance(0);
      setHolderLoading(false);
      return;
    }

    let cancelled = false;
    setHolderLoading(true);

    fetch(`/api/nft/${encodeURIComponent(contract)}/${encodeURIComponent(tokenId)}/holders`, {
      cache: "no-store",
    })
      .then((r) => r.json().catch(() => null))
      .then((json) => {
        if (cancelled) return;
        const rows = Array.isArray(json?.holders) ? json.holders : [];
        const me = rows.find((x: any) => safeEqAddr(x?.ownerAddress ?? x?.address ?? null, account));
        const bal = Number(me?.balance ?? 0);
        setHolderBalance(Number.isFinite(bal) ? bal : 0);
      })
      .catch(() => {
        if (!cancelled) setHolderBalance(0);
      })
      .finally(() => {
        if (!cancelled) setHolderLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account, standard, contract, tokenId]);

  const refreshOwnBusyState = React.useCallback(async () => {
    if (!account || standard !== "ERC1155" || !ethers.isAddress(contract)) {
      setOwnBusyListingId(null);
      setOwnBusyAuctionId(null);
      setOwnBusyListingQty(0);
      setOwnBusyAuctionQty(0);
      return;
    }

    try {
      const [l, a] = await Promise.all([
        marketplace.readActiveListing({
          collection: ethers.getAddress(contract) as `0x${string}`,
          tokenId: BigInt(tokenId),
          standard: "ERC1155",
          seller: ethers.getAddress(account) as `0x${string}`,
        }),
        marketplace.readActiveAuction({
          collection: ethers.getAddress(contract) as `0x${string}`,
          tokenId: BigInt(tokenId),
          standard: "ERC1155",
          seller: ethers.getAddress(account) as `0x${string}`,
        }),
      ]);

      setOwnBusyListingId(l ? l.id.toString() : null);
      setOwnBusyAuctionId(a ? a.id.toString() : null);
      setOwnBusyListingQty(l ? Number(l.row.quantity ?? BigInt(0)) : 0);
      setOwnBusyAuctionQty(a ? Number(a.row.quantity ?? BigInt(0)) : 0);
    } catch {
      setOwnBusyListingId(null);
      setOwnBusyAuctionId(null);
      setOwnBusyListingQty(0);
      setOwnBusyAuctionQty(0);
    }
  }, [account, standard, contract, tokenId]);

  React.useEffect(() => {
    void refreshOwnBusyState();
  }, [refreshOwnBusyState, listing?.id, auction?.id]);

  const canManageThisAsset =
    standard === "ERC1155" ? !!account && holderBalance > 0 : isErc721Owner;

  const busyForMarketCreation =
    standard === "ERC1155"
      ? !!ownBusyListingId || !!ownBusyAuctionId
      : hasActiveListing || hasActiveAuction;

  const escrowedQty =
    standard === "ERC1155"
      ? Math.max(0, ownBusyListingQty) + Math.max(0, ownBusyAuctionQty)
      : 0;

  const transferableBalance =
    standard === "ERC1155" ? Math.max(0, holderBalance) : canManageThisAsset ? 1 : 0;

  const totalAssociatedBalance =
    standard === "ERC1155"
      ? holderBalance + escrowedQty
      : canManageThisAsset
      ? 1
      : 0;

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
  }, [defaultCurrencyId, listCurrencyId, aucCurrencyId]);

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

  const finalizeSuccessUi = React.useCallback(async () => {
    close();

    try {
      await onRefresh?.();
    } catch {}

    try {
      await refreshOwnBusyState();
    } catch {}

    try {
      onAfterAction?.();
    } catch {}

    router.refresh();
  }, [close, onRefresh, refreshOwnBusyState, onAfterAction, router]);

  const confirmMarketWrite = React.useCallback(
    async (args: {
      txHashCreated: string;
      quantity: number;
      expectedKind: "listing" | "auction";
    }) => {
      const maxAttempts = 6;

      for (let i = 0; i < maxAttempts; i++) {
        const res = await postJson("/api/market/confirm", {
          kind: args.expectedKind,
          txHashCreated: args.txHashCreated,
          contract,
          tokenId: String(tokenId),
          account,
          sellerAddress: account,
          quantity: args.quantity,
          standard,
        });

        if (res.ok) {
          const data = extractConfirmData(res.json);
          const kind = data?.kind ?? null;

          if (kind && kind !== args.expectedKind) {
            return {
              ok: false,
              reconciled: false,
              json: {
                ok: false,
                error: `Confirm detected "${kind}" but expected "${args.expectedKind}".`,
              } satisfies ConfirmOk,
            };
          }

          return { ok: true, reconciled: false, json: res.json };
        }

        const errorText =
          (res.json && typeof res.json === "object" && "error" in res.json
            ? String((res.json as any).error || "")
            : "") || "";

        const shouldRetry =
          res.status === 404 ||
          res.status === 422 ||
          errorText.toLowerCase().includes("receipt not found") ||
          errorText.toLowerCase().includes("nft not found in db yet");

        if (!shouldRetry || i === maxAttempts - 1) break;

        await sleep(1200 + i * 400);
      }

      const reconcile = await postJson("/api/market/reconcile", {
        txHashCreated: args.txHashCreated,
        contract,
        tokenId: String(tokenId),
        sellerAddress: account,
      });

      if (!reconcile.ok) {
        return { ok: false, reconciled: false, json: reconcile.json };
      }

      const data = extractConfirmData(reconcile.json);
      const kind = data?.kind ?? null;

      if (kind !== args.expectedKind) {
        return {
          ok: false,
          reconciled: false,
          json: {
            ok: false,
            error: `Reconcile detected "${kind}" but expected "${args.expectedKind}".`,
          } satisfies ConfirmOk,
        };
      }

      return { ok: true, reconciled: true, json: reconcile.json };
    },
    [contract, tokenId, account, standard]
  );

  const openMode = React.useCallback(
    (m: OwnerMode) => {
      if (!isConnected) {
        toast.error("Connect your wallet to continue.");
        setErr("Connect your wallet to continue.");
        return;
      }

      if (!canManageThisAsset) {
        const msg =
          standard === "ERC1155"
            ? "Only a holder with balance can do this."
            : "Only the owner can do this.";
        toast.error(msg);
        setErr(msg);
        return;
      }

      if ((m === "list" || m === "auction") && busyForMarketCreation) {
        toast.error(
          "You already have an active listing or auction for this token. Cancel or settle it first."
        );
        setErr(
          "You already have an active listing or auction for this token. Cancel or settle it first."
        );
        return;
      }

      if (m === "transfer" && transferableBalance <= 0) {
        toast.error("No transferable balance available right now.");
        setErr("No transferable balance available right now.");
        return;
      }

      setOwnerMode(m);
      setLocalMode(m);
      setOpen(true);
      setErr(null);
    },
    [
      isConnected,
      canManageThisAsset,
      standard,
      busyForMarketCreation,
      transferableBalance,
      setOwnerMode,
      setErr,
    ]
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
  }, [open, localMode, defaultCurrencyId]);

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
    if (standard === "ERC1155") {
      if (ownBusyAuctionId) {
        return `You already have an active auction for this token. Wallet balance: ${holderBalance}. Escrowed in market: ${escrowedQty}.`;
      }
      if (ownBusyListingId) {
        return `You already have an active listing for this token. Wallet balance: ${holderBalance}. Escrowed in market: ${escrowedQty}.`;
      }
      return escrowedQty > 0
        ? `Wallet balance: ${holderBalance}. Escrowed in market: ${escrowedQty}.`
        : null;
    }

    if (hasActiveAuction) return "This NFT already has an active auction.";
    if (hasActiveListing) return "This NFT already has an active listing.";
    return null;
  }, [
    standard,
    ownBusyAuctionId,
    ownBusyListingId,
    holderBalance,
    escrowedQty,
    hasActiveAuction,
    hasActiveListing,
  ]);

  const doSyncOwner = React.useCallback(async () => {
    const tId = toast.loading("Syncing owner…");
    setLoading(true);
    try {
      await onSyncOwnerNow?.();
      await onRefresh?.();
      router.refresh();
      toast.success("Owner synced.", { id: tId });
    } catch (e) {
      toast.error(humanError(e, "Sync failed."), { id: tId });
    } finally {
      setLoading(false);
    }
  }, [onSyncOwnerNow, onRefresh, router, setLoading]);

  const doList = React.useCallback(async () => {
    if (!isConnected || !account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }

    if (!canManageThisAsset) {
      const msg =
        standard === "ERC1155"
          ? "Only a holder with balance can do this."
          : "Only the owner can do this.";
      toast.error(msg);
      setErr(msg);
      return;
    }

    if (busyForMarketCreation) {
      toast.error("You already have an active listing or auction for this token.");
      setErr("You already have an active listing or auction for this token.");
      return;
    }

    setErr(null);

    const { isNative, decimals, symbol, tokenAddress } = getCurrencyMeta(listCurrencyId);
    const qty = standard === "ERC1155" ? parseQty(listQty) : 1;

    if (standard === "ERC1155" && qty > holderBalance) {
      const msg = `You only hold ${holderBalance} unit${holderBalance === 1 ? "" : "s"}.`;
      setErr(msg);
      toast.error(msg);
      return;
    }

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
    const minAllowedStart = Math.floor(Date.now() / 1000) + 300;

    if (listSchedule && startSec < minAllowedStart) {
      setErr("Start time must be at least 5 minutes in the future.");
      toast.error("Start time must be at least 5 minutes in the future.");
      return;
    }

    if (
      listEndEnabled &&
      endSec > 0 &&
      endSec <= Math.max(startSec || minAllowedStart, minAllowedStart)
    ) {
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

      const confirm = await confirmMarketWrite({
        txHashCreated: txHash,
        quantity: qty,
        expectedKind: "listing",
      });

      if (!confirm.ok) {
        const err =
          (confirm.json && typeof confirm.json === "object" && "error" in confirm.json
            ? String((confirm.json as any).error || "")
            : "") || "Listing was created on-chain, but marketplace sync is still pending.";

        setErr(err);
        toast.error(err, { id: tId });
        return;
      }

      const successText = buildSuccessMessage({
        expectedKind: "listing",
        reconciled: confirm.reconciled,
        symbol,
        priceText: listPrice.trim(),
        json: confirm.json,
      });

      toast.success(successText, { id: tId });
      await finalizeSuccessUi();
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
    canManageThisAsset,
    standard,
    busyForMarketCreation,
    setErr,
    getCurrencyMeta,
    listCurrencyId,
    listQty,
    holderBalance,
    listPrice,
    listSchedule,
    listStartAt,
    listEndEnabled,
    listEndAt,
    setLoading,
    contract,
    tokenId,
    confirmMarketWrite,
    finalizeSuccessUi,
  ]);

  const doAuction = React.useCallback(async () => {
    if (!isConnected || !account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }

    if (!canManageThisAsset) {
      const msg =
        standard === "ERC1155"
          ? "Only a holder with balance can do this."
          : "Only the owner can do this.";
      toast.error(msg);
      setErr(msg);
      return;
    }

    if (busyForMarketCreation) {
      toast.error("You already have an active listing or auction for this token.");
      setErr("You already have an active listing or auction for this token.");
      return;
    }

    setErr(null);

    const { isNative, decimals, symbol, tokenAddress } = getCurrencyMeta(aucCurrencyId);
    const qty = standard === "ERC1155" ? parseQty(aucQty) : 1;

    if (standard === "ERC1155" && qty > holderBalance) {
      const msg = `You only hold ${holderBalance} unit${holderBalance === 1 ? "" : "s"}.`;
      setErr(msg);
      toast.error(msg);
      return;
    }

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

      if (incWei <= BigInt(0)) {
        throw new Error("Minimum increment must be greater than zero.");
      }
    } catch (e) {
      const msg = humanError(e, "Invalid increment.");
      setErr(msg);
      toast.error(msg);
      return;
    }

    const startSec = aucSchedule ? parseDateInputToSec(aucStartAt) : 0;
    const endSec = parseDateInputToSec(aucEndsAt);
    const minAllowedStart = Math.floor(Date.now() / 1000) + 300;
    const effectiveStart = startSec > 0 ? Math.max(startSec, minAllowedStart) : minAllowedStart;

    if (aucSchedule && startSec < minAllowedStart) {
      setErr("Start time must be at least 5 minutes in the future.");
      toast.error("Start time must be at least 5 minutes in the future.");
      return;
    }

    if (!endSec || endSec <= effectiveStart) {
      setErr("End time must be after the auction start time.");
      toast.error("End time must be after the auction start time.");
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
        minIncrementHuman: aucMinIncrement.trim(),
        currency: curAddr,
        startTimeSec: startSec,
        endTimeSec: endSec,
      });

      const confirm = await confirmMarketWrite({
        txHashCreated: txHash,
        quantity: qty,
        expectedKind: "auction",
      });

      if (!confirm.ok) {
        const err =
          (confirm.json && typeof confirm.json === "object" && "error" in confirm.json
            ? String((confirm.json as any).error || "")
            : "") || "Auction was created on-chain, but marketplace sync is still pending.";

        setErr(err);
        toast.error(err, { id: tId });
        return;
      }

      const successText = buildSuccessMessage({
        expectedKind: "auction",
        reconciled: confirm.reconciled,
        symbol,
        priceText: aucStartPrice.trim(),
        json: confirm.json,
      });

      toast.success(successText, { id: tId });
      await finalizeSuccessUi();
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
    canManageThisAsset,
    standard,
    busyForMarketCreation,
    setErr,
    getCurrencyMeta,
    aucCurrencyId,
    aucQty,
    holderBalance,
    aucStartPrice,
    aucMinIncrement,
    aucSchedule,
    aucStartAt,
    aucEndsAt,
    setLoading,
    contract,
    tokenId,
    confirmMarketWrite,
    finalizeSuccessUi,
  ]);

  const doTransfer = React.useCallback(async () => {
    if (!isConnected || !account) {
      toast.error("Connect your wallet to continue.");
      setErr("Connect your wallet to continue.");
      return;
    }

    if (!canManageThisAsset) {
      const msg =
        standard === "ERC1155"
          ? "Only a holder with balance can do this."
          : "Only the owner can do this.";
      toast.error(msg);
      setErr(msg);
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

    if (standard === "ERC1155" && qty > transferableBalance) {
      const msg = `You can transfer up to ${transferableBalance} unit${transferableBalance === 1 ? "" : "s"} right now.`;
      setErr(msg);
      toast.error(msg);
      return;
    }

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

      await onSyncOwnerNow?.();

      toast.success("Transfer submitted.", { id: tId });
      await finalizeSuccessUi();
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
    canManageThisAsset,
    standard,
    setErr,
    toAddr,
    txQty,
    transferableBalance,
    contract,
    tokenId,
    setLoading,
    onSyncOwnerNow,
    finalizeSuccessUi,
  ]);

  const modalTitle =
    localMode === "list"
      ? "Create listing"
      : localMode === "auction"
      ? "Create auction"
      : localMode === "transfer"
      ? "Transfer"
      : "Owner actions";

  const showSyncCard = standard === "ERC721" && isConnected && ownerUnknown;
  const canShowOwnerActions =
    isConnected &&
    (standard === "ERC1155" ? holderBalance > 0 : !ownerUnknown && isErc721Owner);

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Owner actions</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {showSyncCard
              ? "Owner isn’t synced yet. Sync to enable owner actions."
              : canShowOwnerActions
              ? standard === "ERC1155"
                ? busyForMarketCreation
                  ? `Your wallet currently holds ${holderBalance} unit${holderBalance === 1 ? "" : "s"}. Market creation is locked while one of your auctions/listings is active, but you can still transfer your wallet balance.`
                  : `Your wallet currently holds ${holderBalance} unit${holderBalance === 1 ? "" : "s"} and you can transfer, list, or auction your quantity.`
                : "List, auction, or transfer — all in one clean flow."
              : isConnected
              ? standard === "ERC1155"
                ? holderLoading
                  ? "Checking your ERC-1155 balance…"
                  : "Connect as a holder wallet with balance to manage this token."
                : "Connect as the owner wallet to manage this NFT."
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
            disabled={loading || currLoading || busyForMarketCreation}
            title={
              busyForMarketCreation
                ? "You already have an active listing or auction for this token"
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
            disabled={loading || currLoading || busyForMarketCreation}
            title={
              busyForMarketCreation
                ? "You already have an active listing or auction for this token"
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
            disabled={loading || transferableBalance <= 0}
            title={
              transferableBalance <= 0
                ? "No transferable balance available right now"
                : standard === "ERC1155"
                ? `Transferable balance: ${transferableBalance}`
                : "Transfer to another address"
            }
          >
            Transfer
          </ActionChip>
        </div>
      ) : null}

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

             <Field label="Total listing price" hint="For the full quantity in this listing">
                <Input
                  inputMode="decimal"
                  placeholder="0.0"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                />
              </Field>
            </div>

            {standard === "ERC1155" ? (
              <Field label="Quantity" hint={`Wallet balance: ${holderBalance}`}>
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
                disabled={loading || currLoading || busyForMarketCreation}
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
              <Field label="Min increment" hint="Required">
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
              <Field label="Quantity" hint={`Wallet balance: ${holderBalance}`}>
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
                disabled={loading || currLoading || busyForMarketCreation}
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
              <Field label="Quantity" hint={`Transferable now: ${transferableBalance}`}>
                <Input
                  inputMode="numeric"
                  placeholder="1"
                  value={txQty}
                  onChange={(e) => setTxQty(e.target.value)}
                />
              </Field>
            ) : null}

            <div className="rounded-2xl border border-border bg-background p-3 text-xs text-muted-foreground">
              {standard === "ERC1155"
                ? `Wallet balance: ${holderBalance}. Escrowed in market: ${escrowedQty}. Total associated: ${totalAssociatedBalance}. Transferable right now: ${transferableBalance}.`
                : "Transfers require ownership. If this NFT is escrowed, you must cancel or settle first."}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={close} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={() => void doTransfer()} disabled={loading || transferableBalance <= 0}>
                Transfer
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}