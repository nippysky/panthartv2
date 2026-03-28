/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeCheck,
  Clock,
  Copy,
  Share2,
  XCircle,
  Gavel,
  Sparkles,
  Gem,
} from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { ethers } from "ethers";

import { useAuctionSSE } from "@/src/lib/hooks/useAuctionSSE";
import { useLoaderStore } from "@/src/lib/store/loader-store";
import { marketplace, type Standard } from "@/src/lib/services/marketplace";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";
import { ZERO_ADDRESS, getBrowserSigner } from "@/src/lib/evm/getSigner";
import { formatNumber } from "@/src/lib/utils";

import { Container } from "@/src/ui/Container";
import { BreadcrumbsBar } from "@/src/ui/BreadcrumbsBar";
import { BackButton } from "@/src/ui/BackButton";
import { Badge } from "@/src/ui/Badge";
import { Button } from "@/src/ui/Button";
import { IconButton } from "@/src/ui/IconButton";
import { Input } from "@/src/ui/Input";
import { Skeleton } from "@/src/ui/Skeleton";
import { Progress } from "@/src/ui/Progress";

/* ----------------------- Types ----------------------- */

type NftLite = {
  name?: string | null;
  image?: string | null;
  description?: string | null;
  standard?: Standard | "ERC721" | "ERC1155";
  royaltyBps?: number | null;
  ownerWallet?: string | null;
  contract?: string | null;
  tokenId?: string | null;
  quantity?: number | null;
};

type ConfirmedBidRow = {
  bidder: string;
  amountHuman: string;
  time: number;
  txHash?: string;
  pending?: false;
  timeConfirmed?: number;
  bidderProfile?: {
    walletAddress: string;
    username: string | null;
    imageUrl: string | null;
  } | null;
};

type PendingBidRow = {
  bidder: string;
  amountHuman: string;
  time: number;
  txHash: string;
  pending: true;
};

type BidderMeta = {
  wallet: string;
  username?: string | null;
  avatarUrl?: string | null;
};

type AuctionSnap = {
  currencyAddress: string;
  currencySymbol: string;
  currencyDecimals: number;
  startISO: string | null;
  endISO: string | null;
  highestBidHuman: string | null;
  highestBidder?: string | null;
  startPriceHuman: string | null;
  minIncrementHuman: string | null;
  active: boolean;
  seller: string | null;
  bidsCount: number;
};

type State = {
  booted: boolean;

  nft: NftLite | null;
  apiAuctionSeller: string | null;

  contract: string;
  tokenId: string;

  auctionIdDb: string | null;
  currencyIdDb: string | null;

  auctionIdOnChain: string | null;

  snap: AuctionSnap;

  confirmedBids: ConfirmedBidRow[];
  pendingBids: PendingBidRow[];

  bidInput: string;
};

type Action =
  | { type: "BOOT_FROM_API"; payload: any; auctionIdFallback?: string }
  | { type: "SET_ONCHAIN_ID"; id: string | null }
  | { type: "PATCH_SNAP"; patch: Partial<AuctionSnap> }
  | { type: "SET_BID_INPUT"; value: string }
  | { type: "SET_CONFIRMED_BIDS"; rows: ConfirmedBidRow[] }
  | { type: "ADD_CONFIRMED_BID"; row: ConfirmedBidRow }
  | { type: "ADD_PENDING_BID"; row: PendingBidRow }
  | { type: "REMOVE_PENDING_BY_TX"; txHash: string }
  | { type: "SET_PENDING_BIDS"; rows: PendingBidRow[] };

/* ----------------------- utils ----------------------- */

const keyOf = (addr?: string | null) =>
  (addr || "").startsWith("0x") ? (addr as string).toLowerCase() : (addr || "");

const eqCI = (a?: string | null, b?: string | null) => keyOf(a) !== "" && keyOf(a) === keyOf(b);

function msParts(ms: number) {
  const clamp = Math.max(0, ms);
  const d = Math.floor(clamp / 86400000);
  const h = Math.floor((clamp % 86400000) / 3600000);
  const m = Math.floor((clamp % 3600000) / 60000);
  const s = Math.floor((clamp % 60000) / 1000);
  return { d, h, m, s };
}

const dicebear = (addr: string) => `https://api.dicebear.com/7.x/identicon/svg?seed=${addr}`;

function sanitizeHuman(x: string): string {
  const t = (x || "").trim();
  if (!t) return "";
  if (!/^\d*\.?\d*$/.test(t)) return t.replace(/[^\d.]/g, "");
  return t;
}

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

/** Local ERC20 meta read */
async function readErc20Meta(
  token: string,
  signerOrProvider: ethers.Signer | ethers.Provider
): Promise<{ symbol: string; decimals: number }> {
  const abi = [
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ] as const;

  const c = new ethers.Contract(token, abi, signerOrProvider);
  const [symbol, decimals] = await Promise.all([
    c.symbol().catch(() => "TOKEN"),
    c.decimals().catch(() => 18),
  ]);
  return { symbol: String(symbol || "TOKEN"), decimals: Number(decimals || 18) };
}

/** Read active auction with ERC1155 seller-safe fallback */
async function readActiveAuctionSmart(args: {
  collection: `0x${string}`;
  tokenId: bigint;
  standard: Standard;
  seller?: `0x${string}`;
}) {
  const m: any = marketplace as any;

  if (args.standard === "ERC1155" && args.seller && typeof m.readActiveAuctionForSeller === "function") {
    return m.readActiveAuctionForSeller({
      collection: args.collection,
      tokenId: args.tokenId,
      standard: args.standard,
      seller: args.seller,
    });
  }

  return m.readActiveAuction({
    collection: args.collection,
    tokenId: args.tokenId,
    standard: args.standard,
    ...(args.standard === "ERC1155" && args.seller ? { seller: args.seller } : {}),
  });
}

/* ----------------------- Smart Media (IPFS-safe) ----------------------- */

type SmartMediaType = "image" | "video" | "unknown";

const mediaTypeCache = new Map<string, SmartMediaType>();

function looksLikeVideoUrl(u: string) {
  const s = u.toLowerCase();
  return s.includes(".mp4") || s.includes(".webm") || s.includes("video");
}

function looksLikeImageUrl(u: string) {
  const s = u.toLowerCase();
  return (
    s.includes(".png") ||
    s.includes(".jpg") ||
    s.includes(".jpeg") ||
    s.includes(".gif") ||
    s.includes(".webp") ||
    s.includes("image")
  );
}

async function sniffMediaType(url: string, signal: AbortSignal): Promise<SmartMediaType> {
  if (!url) return "unknown";
  if (mediaTypeCache.has(url)) return mediaTypeCache.get(url)!;

  if (looksLikeVideoUrl(url)) {
    mediaTypeCache.set(url, "video");
    return "video";
  }
  if (looksLikeImageUrl(url)) {
    mediaTypeCache.set(url, "image");
    return "image";
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1024" },
      signal,
      cache: "force-cache",
    });

    const ct = (res.headers.get("content-type") || "").toLowerCase();

    if (ct.startsWith("video/")) {
      mediaTypeCache.set(url, "video");
      return "video";
    }
    if (ct.startsWith("image/")) {
      mediaTypeCache.set(url, "image");
      return "image";
    }

    mediaTypeCache.set(url, "unknown");
    return "unknown";
  } catch {
    return "unknown";
  }
}

function SmartMedia({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [kind, setKind] = React.useState<SmartMediaType>(() => mediaTypeCache.get(src) ?? "unknown");

  React.useEffect(() => {
    if (!src) return;

    if (mediaTypeCache.has(src)) {
      setKind(mediaTypeCache.get(src)!);
      return;
    }

    const ac = new AbortController();
    let alive = true;

    (async () => {
      const t = await sniffMediaType(src, ac.signal);
      if (!alive) return;
      setKind(t);
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [src]);

  if (kind === "video") {
    return (
      <video
        className="absolute inset-0 w-full h-full object-contain"
        controls
        playsInline
        preload="metadata"
      >
        <source src={src} />
      </video>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 1024px) 92vw, 520px"
      className="object-contain object-center"
      priority
    />
  );
}

/* ----------------------- Skeleton ----------------------- */

function AuctionNowSkeleton() {
  return (
    <section className="pt-8 pb-10">
      <Container>
        <div className="mb-6">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="mt-4 h-9 w-[min(560px,92%)]" />
          <Skeleton className="mt-2 h-5 w-[min(720px,92%)]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
          <div className="lg:col-span-5">
            <div className="relative w-full aspect-square rounded-[28px] overflow-hidden bg-foreground/5 ring-1 ring-border">
              <Skeleton className="w-full h-full" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Skeleton className="h-11 rounded-[20px]" />
              <Skeleton className="h-11 rounded-[20px]" />
              <Skeleton className="h-11 rounded-[20px] col-span-2" />
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="rounded-[28px] border border-border bg-card p-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>

              <div className="mt-5 rounded-3xl border border-border bg-background/50 p-4">
                <Skeleton className="h-11 w-full rounded-2xl" />
                <div className="mt-3 flex gap-3">
                  <Skeleton className="h-11 w-full rounded-2xl" />
                  <Skeleton className="h-11 w-28 rounded-2xl" />
                </div>
                <Skeleton className="mt-3 h-4 w-72" />
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-card p-5 sm:p-6">
              <Skeleton className="h-6 w-36" />
              <div className="mt-3 space-y-2">
                <Skeleton className="h-12 w-full rounded-[20px]" />
                <Skeleton className="h-12 w-full rounded-[20px]" />
                <Skeleton className="h-12 w-full rounded-[20px]" />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------- State ----------------------- */

const initialState: State = {
  booted: false,

  nft: null,
  apiAuctionSeller: null,

  contract: "",
  tokenId: "",

  auctionIdDb: null,
  currencyIdDb: null,

  auctionIdOnChain: null,

  snap: {
    currencyAddress: ZERO_ADDRESS,
    currencySymbol: "ETN",
    currencyDecimals: 18,
    startISO: null,
    endISO: null,
    highestBidHuman: null,
    highestBidder: null,
    startPriceHuman: null,
    minIncrementHuman: null,
    active: false,
    seller: null,
    bidsCount: 0,
  },

  confirmedBids: [],
  pendingBids: [],
  bidInput: "",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "BOOT_FROM_API": {
      const a = action.payload;
      const nftLite: NftLite = {
        name: a?.nft?.name ?? null,
        image: a?.nft?.image ?? null,
        description: a?.nft?.description ?? null,
        standard: (a?.nft?.standard ?? "ERC721") as Standard,
        royaltyBps: a?.nft?.royaltyBps ?? null,
        ownerWallet: a?.owner?.walletAddress ?? null,
        contract: a?.nft?.contract ?? null,
        tokenId: a?.nft?.tokenId ?? null,
        quantity: a?.quantity ?? null,
      };

      const currencyAddress = a?.currency?.tokenAddress ?? ZERO_ADDRESS;
      const currencySymbol = a?.currency?.symbol ?? (currencyAddress === ZERO_ADDRESS ? "ETN" : "ERC20");
      const currencyDecimals = a?.currency?.decimals ?? (currencyAddress === ZERO_ADDRESS ? 18 : 18);

      const auctionIdDb = a?.id ?? action.auctionIdFallback ?? null;

      return {
        ...state,
        booted: true,
        nft: nftLite,
        contract: a?.nft?.contract ?? state.contract,
        tokenId: a?.nft?.tokenId ?? state.tokenId,
        apiAuctionSeller: a?.sellerAddress ?? null,
        auctionIdDb,
        currencyIdDb: a?.currency?.id ?? null,
        snap: {
          ...state.snap,
          currencyAddress,
          currencySymbol,
          currencyDecimals,
          startISO: a?.startTime ?? null,
          endISO: a?.endTime ?? null,
          highestBidHuman: a?.amounts?.highestBid ?? null,
          highestBidder: a?.highestBidder ?? null,
          startPriceHuman: a?.amounts?.startPrice ?? null,
          minIncrementHuman: a?.amounts?.minIncrement ?? null,
          active: a?.status === "ACTIVE",
          seller: a?.sellerAddress ?? null,
          bidsCount: a?.bidsCount ?? state.snap.bidsCount ?? 0,
        },
      };
    }

    case "SET_ONCHAIN_ID":
      return { ...state, auctionIdOnChain: action.id };

    case "PATCH_SNAP":
      return { ...state, snap: { ...state.snap, ...action.patch } };

    case "SET_BID_INPUT":
      return { ...state, bidInput: action.value };

    case "SET_CONFIRMED_BIDS":
      return { ...state, confirmedBids: action.rows };

    case "ADD_CONFIRMED_BID":
      return { ...state, confirmedBids: [action.row, ...state.confirmedBids].slice(0, 220) };

    case "ADD_PENDING_BID":
      if (state.pendingBids.some((r) => eqCI(r.txHash, action.row.txHash))) return state;
      return { ...state, pendingBids: [action.row, ...state.pendingBids].slice(0, 80) };

    case "REMOVE_PENDING_BY_TX":
      return { ...state, pendingBids: state.pendingBids.filter((r) => !eqCI(r.txHash, action.txHash)) };

    case "SET_PENDING_BIDS":
      return { ...state, pendingBids: action.rows };

    default:
      return state;
  }
}

/* ====================================================================== */

export default function NFTAuctionNowPage({
  initialAuction,
  initialRarityRank = null,
}: {
  initialAuction?: any | null;
  initialRarityRank?: number | null;
}) {
  const pathname = usePathname();
  const account = useActiveAccount();
  const loader = useLoaderStore();

  const [state, dispatch] = React.useReducer(reducer, {
    ...initialState,
    booted: !!initialAuction,
  });

  const [rarityRank, setRarityRank] = React.useState<number | null>(
    typeof initialRarityRank === "number" ? initialRarityRank : null
  );

  const bidderCache = React.useRef<Map<string, BidderMeta>>(new Map());
  const decimalsRef = React.useRef<number>(18);

  const [isTxBusy, setIsTxBusy] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const refreshOffTimer = React.useRef<number | null>(null);

  const isRefreshingRef = React.useRef(false);
  React.useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const endRefreshingSoon = React.useCallback(() => {
    if (!isRefreshingRef.current) return;

    if (refreshOffTimer.current) window.clearTimeout(refreshOffTimer.current);
    refreshOffTimer.current = window.setTimeout(() => setIsRefreshing(false), 350);
  }, []);

  const auctionIdParam = React.useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    const idx = segs.indexOf("auction-now");
    if (idx !== -1 && segs[idx + 1]) return segs[idx + 1];
    return segs[segs.length - 1];
  }, [pathname]);

  const snap = state.snap;

  const warmMeta = React.useCallback((wallet: string, meta?: { username?: string | null; imageUrl?: string | null }) => {
    const k = keyOf(wallet);
    if (!k) return;
    const existing = bidderCache.current.get(k);
    if (existing) {
      bidderCache.current.set(k, {
        wallet: existing.wallet,
        username: meta?.username ?? existing.username ?? null,
        avatarUrl: meta?.imageUrl ?? existing.avatarUrl ?? dicebear(existing.wallet),
      });
    } else {
      bidderCache.current.set(k, {
        wallet,
        username: meta?.username ?? null,
        avatarUrl: meta?.imageUrl ?? dicebear(wallet),
      });
    }
  }, []);

  React.useEffect(() => {
    if (!initialAuction) return;
    dispatch({ type: "BOOT_FROM_API", payload: initialAuction, auctionIdFallback: auctionIdParam });

    const currencyDecimals =
      initialAuction?.currency?.decimals ??
      (initialAuction?.currency?.tokenAddress === ZERO_ADDRESS ? 18 : 18);
    decimalsRef.current = currencyDecimals;

    if (initialAuction?.highestBidder) warmMeta(initialAuction.highestBidder);
  }, [initialAuction, auctionIdParam, warmMeta]);

  React.useEffect(() => {
    if (initialAuction) return;
    if (!auctionIdParam) return;

    let cancel = false;
    const ac = new AbortController();

    (async () => {
      try {
        const r = await fetch(`/api/auction/${auctionIdParam}`, { cache: "no-store", signal: ac.signal });
        if (!r.ok) return;
        const j = await r.json();
        if (cancel) return;

        const a = j?.auction;
        if (!a) return;

        dispatch({ type: "BOOT_FROM_API", payload: a, auctionIdFallback: auctionIdParam });

        const currencyDecimals = a?.currency?.decimals ?? (a?.currency?.tokenAddress === ZERO_ADDRESS ? 18 : 18);
        decimalsRef.current = currencyDecimals;

        if (a?.highestBidder) warmMeta(a.highestBidder);
      } catch {
        /* noop */
      }
    })();

    return () => {
      cancel = true;
      ac.abort();
    };
  }, [auctionIdParam, initialAuction, warmMeta]);

  React.useEffect(() => {
    if (typeof rarityRank === "number") return;
    if (!state.contract || !state.tokenId) return;

    let alive = true;
    const ac = new AbortController();

    (async () => {
      try {
        const r = await fetch(
          `/api/nft/${encodeURIComponent(state.contract)}/${encodeURIComponent(state.tokenId)}/rarity`,
          {
            cache: "no-store",
            signal: ac.signal,
          }
        );

        if (!r.ok) return;

        const json = await r.json().catch(() => null);
        if (!alive) return;

        const rank = json && typeof json === "object" ? (json as any).rank : null;
        if (typeof rank === "number") setRarityRank(rank);
      } catch {
        /* noop */
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [rarityRank, state.contract, state.tokenId]);

  React.useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        if (!state.contract || !state.tokenId || !state.nft?.standard) return;

        const standard = (state.nft.standard ?? "ERC721") as Standard;
        const seller = state.apiAuctionSeller ? (state.apiAuctionSeller as `0x${string}`) : undefined;

        const au = await readActiveAuctionSmart({
          collection: state.contract as `0x${string}`,
          tokenId: BigInt(state.tokenId),
          standard,
          seller,
        });

        if (cancel) return;

        if (!au) {
          dispatch({ type: "SET_ONCHAIN_ID", id: null });
          return;
        }

        dispatch({ type: "SET_ONCHAIN_ID", id: String(au.id) });

        const currencyAddress = String(au.row.currency);
        let currencySymbol = currencyAddress === ZERO_ADDRESS ? "ETN" : snap.currencySymbol || "ERC20";
        let currencyDecimals = currencyAddress === ZERO_ADDRESS ? 18 : snap.currencyDecimals || 18;

        if (currencyAddress !== ZERO_ADDRESS) {
          try {
            const { signer } = await getBrowserSigner();
            const meta = await readErc20Meta(currencyAddress, signer);
            currencySymbol = meta.symbol || currencySymbol;
            currencyDecimals = meta.decimals || currencyDecimals;
          } catch {
            /* ignore */
          }
        }

        decimalsRef.current = currencyDecimals;

        const toHuman = (x?: bigint | null) => (x == null ? null : ethers.formatUnits(x, currencyDecimals));

        const startISO = au.row.start ? new Date(Number(au.row.start) * 1000).toISOString() : null;
        const endISO = au.row.end ? new Date(Number(au.row.end) * 1000).toISOString() : null;

        dispatch({
          type: "PATCH_SNAP",
          patch: {
            currencyAddress,
            currencySymbol,
            currencyDecimals,
            startISO,
            endISO,
            highestBidHuman:
              au.row.highestBid && au.row.highestBid > BigInt(0) ? toHuman(au.row.highestBid) : snap.highestBidHuman,
            highestBidder: au.row.highestBidder ? String(au.row.highestBidder) : snap.highestBidder ?? null,
            startPriceHuman: toHuman(au.row.startPrice) ?? snap.startPriceHuman,
            minIncrementHuman: toHuman(au.row.minIncrement) ?? snap.minIncrementHuman,
            active: true,
            seller: state.apiAuctionSeller ?? String(au.row.seller ?? "") ?? snap.seller ?? null,
            bidsCount: Number(au.row.bidsCount || snap.bidsCount || 0),
          },
        });
      } catch {
        if (!cancel) dispatch({ type: "SET_ONCHAIN_ID", id: null });
      } finally {
        if (isRefreshing) endRefreshingSoon();
      }
    })();

    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.contract, state.tokenId, state.nft?.standard, state.apiAuctionSeller]);

  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const startDeltaMs =
    snap.startISO && Number.isFinite(new Date(snap.startISO).getTime()) ? new Date(snap.startISO).getTime() - now : 0;

  const endDeltaMs =
    snap.endISO && Number.isFinite(new Date(snap.endISO).getTime()) ? new Date(snap.endISO).getTime() - now : 0;

  const notStartedYet = !!snap.startISO && startDeltaMs > 0;
  const auctionEnded = state.booted ? !snap.active || (snap.endISO ? endDeltaMs <= 0 : false) : false;

  const { d: sd, h: sh, m: sm, s: ss } = msParts(startDeltaMs);
  const { d, h, m, s } = msParts(endDeltaMs);

  const fetchRecentBids = React.useCallback(async () => {
    try {
      if (!auctionIdParam) return;
      const r = await fetch(`/api/auction/${auctionIdParam}/bids`, { cache: "no-store" });
      if (!r.ok) return;
      const j: any = await r.json();
      const rowsRaw: any[] = Array.isArray(j?.bids) ? j.bids : [];
      const rows: ConfirmedBidRow[] = rowsRaw.map((b) => ({
        bidder: b.bidder,
        amountHuman: b.amountHuman,
        time: b.time,
        txHash: b.txHash,
        pending: false,
        bidderProfile: b.bidderProfile ?? null,
      }));

      dispatch({ type: "SET_CONFIRMED_BIDS", rows: rows.slice(0, 200) });

      for (const row of rows) {
        if (row.bidderProfile) {
          warmMeta(row.bidderProfile.walletAddress, {
            username: row.bidderProfile.username,
            imageUrl: row.bidderProfile.imageUrl ?? undefined,
          });
        } else {
          warmMeta(row.bidder);
        }
      }
      if (snap.highestBidder) warmMeta(snap.highestBidder);
    } catch {
      /* noop */
    } finally {
      if (isRefreshingRef.current) endRefreshingSoon();
    }
  }, [auctionIdParam, warmMeta, snap.highestBidder, endRefreshingSoon]);

  React.useEffect(() => {
    if (!auctionIdParam) return;

    let alive = true;
    let t: number | null = null;

    const run = async () => {
      await fetchRecentBids();
      if (!alive) return;

      t = window.setTimeout(async () => {
        if (!alive) return;
        if (document.visibilityState !== "visible") {
          run();
          return;
        }
        run();
      }, 25_000);
    };

    run();

    return () => {
      alive = false;
      if (t) window.clearTimeout(t);
    };
  }, [auctionIdParam, fetchRecentBids]);

  const mergedBids = React.useMemo(() => {
    const map = new Map<string, ConfirmedBidRow | PendingBidRow>();
    const keyFor = (b: any) => (b.txHash && typeof b.txHash === "string" ? b.txHash : `${keyOf(b.bidder)}-${b.time}`);
    state.pendingBids.forEach((b) => map.set(keyFor(b), b));
    state.confirmedBids.forEach((b) => map.set(keyFor(b), b));
    return Array.from(map.values())
      .sort((a, b) => (b.time || 0) - (a.time || 0))
      .slice(0, 50);
  }, [state.pendingBids, state.confirmedBids]);

  useAuctionSSE(state.auctionIdDb ?? undefined, account?.address, {
    onReady: () => {},
    onBidPending: (ev) => {
      if (!ev?.auctionId || String(ev.auctionId) !== String(state.auctionIdDb ?? "")) return;

      const decimals = decimalsRef.current;
      const human = ethers.formatUnits(ev.amount || "0", decimals);

      dispatch({
        type: "ADD_PENDING_BID",
        row: { bidder: ev.from, amountHuman: human, time: ev.at || Date.now(), txHash: ev.txHash, pending: true },
      });

      warmMeta(ev.from);

      dispatch({
        type: "PATCH_SNAP",
        patch: {
          highestBidHuman:
            !snap.highestBidHuman || Number(human) > Number(snap.highestBidHuman) ? human : snap.highestBidHuman,
          bidsCount: (snap.bidsCount || 0) + 1,
        },
      });
    },
    onBidConfirmed: (ev) => {
      if (!ev?.auctionId || String(ev.auctionId) !== String(state.auctionIdDb ?? "")) return;

      const decimals = decimalsRef.current;
      const human = ethers.formatUnits(ev.amount || "0", decimals);

      dispatch({ type: "REMOVE_PENDING_BY_TX", txHash: ev.txHash });

      dispatch({
        type: "ADD_CONFIRMED_BID",
        row: {
          bidder: ev.from,
          amountHuman: human,
          time: ev.at || Date.now(),
          txHash: ev.txHash,
          pending: false,
          timeConfirmed: Date.now(),
        },
      });

      warmMeta(ev.from);

      dispatch({
        type: "PATCH_SNAP",
        patch: {
          highestBidHuman:
            !snap.highestBidHuman || Number(human) > Number(snap.highestBidHuman) ? human : snap.highestBidHuman,
          highestBidder: ev.from,
        },
      });
    },
    onBidFailed: (ev) => {
      if (!ev?.auctionId || String(ev.auctionId) !== String(state.auctionIdDb ?? "")) return;
      dispatch({ type: "REMOVE_PENDING_BY_TX", txHash: ev.txHash });
    },
    onAuctionExtended: (ev) => {
      if (!ev?.auctionId || String(ev.auctionId) !== String(state.auctionIdDb ?? "")) return;
      const endISO = new Date(Number(ev.newEndTimeSec) * 1000).toISOString();
      dispatch({ type: "PATCH_SNAP", patch: { endISO } });
    },
    onAuctionSettled: (ev) => {
      if (!ev?.auctionId || String(ev.auctionId) !== String(state.auctionIdDb ?? "")) return;
      const decimals = decimalsRef.current;
      const base = ev.price ?? ev.amount ?? null;
      const priceHuman = base ? ethers.formatUnits(base, decimals) : null;

      dispatch({ type: "SET_ONCHAIN_ID", id: null });
      dispatch({ type: "PATCH_SNAP", patch: { active: false, highestBidHuman: priceHuman ?? snap.highestBidHuman } });
    },
    onAuctionCancelled: (ev) => {
      if (!ev?.auctionId || String(ev.auctionId) !== String(state.auctionIdDb ?? "")) return;
      dispatch({ type: "SET_ONCHAIN_ID", id: null });
      dispatch({ type: "PATCH_SNAP", patch: { active: false } });
    },
  });

  const minRequiredHuman = React.useMemo(() => {
    const start = parseFloat(snap.startPriceHuman ?? "0") || 0;
    const inc = parseFloat(snap.minIncrementHuman ?? "0") || 0;
    const highest = parseFloat(snap.highestBidHuman ?? "0") || 0;
    return highest > 0 ? highest + inc : start;
  }, [snap.startPriceHuman, snap.minIncrementHuman, snap.highestBidHuman]);

  const isSeller = !!(snap.seller && account?.address) && eqCI(snap.seller, account.address);

  const minValid = React.useMemo(() => {
    const n = parseFloat(state.bidInput || "0");
    if (!Number.isFinite(n) || n <= 0) return false;
    return n >= (minRequiredHuman || 0);
  }, [state.bidInput, minRequiredHuman]);

  const marketplaceAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS || "";
  const isEscrowOwner = eqCI(state.nft?.ownerWallet, marketplaceAddr);

  const canManageAuction = !!(snap.seller && account?.address) && eqCI(snap.seller, account.address);
  const canCancelAuction = React.useMemo(() => canManageAuction && state.confirmedBids.length === 0, [
    canManageAuction,
    state.confirmedBids.length,
  ]);

  const minReqLine =
    Number.isFinite(minRequiredHuman) ? `${formatNumber(Number(minRequiredHuman))} ${snap.currencySymbol}` : "—";

  function fillMin() {
    if (!minRequiredHuman) return;
    const decimals = snap.currencyDecimals || 18;
    const out = Number(minRequiredHuman).toFixed(Math.min(6, decimals));
    dispatch({ type: "SET_BID_INPUT", value: out.replace(/\.?0+$/, "") });
  }

  async function placeBid() {
    if (isTxBusy) return;

    try {
      if (!account?.address) return toast.info("Connect your wallet to place a bid.");
      if (!state.auctionIdOnChain) return toast.error("No active auction found.");
      if (!state.auctionIdDb) return toast.error("Auction reference not ready. Try again.");
      if (auctionEnded) return toast.error("Auction has ended.");
      if (notStartedYet) return toast.error("Bidding hasn’t opened yet.");
      if (isSeller) return toast.error("Sellers can’t bid on their own auction.");

      const amount = parseFloat((state.bidInput || "").trim());
      if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid bid amount.");
      if (amount < minRequiredHuman) return toast.error(`Bid must be at least ${minReqLine}.`);

      setIsTxBusy(true);

      const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 52014);
      const { signer, chainId } = await getBrowserSigner();
      if (Number(chainId) !== expectedChainId) {
        setIsTxBusy(false);
        return toast.error("Wrong network. Please switch to Electroneum.");
      }

      const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
      const contractMkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);
      const wei = ethers.parseUnits(String(amount), snap.currencyDecimals);

      loader.show("Submitting your bid on-chain…");

      let tx: any;
      if (snap.currencyAddress && snap.currencyAddress !== ZERO_ADDRESS) {
        const erc20 = new ethers.Contract(
          snap.currencyAddress as `0x${string}`,
          [
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 value) returns (bool)",
          ],
          signer
        );
        const ownerAddr = await signer.getAddress();
        const allowance: bigint = await erc20.allowance(ownerAddr, mktAddr);
        if (allowance < wei) {
          loader.show("Approving token spend…");
          const txA = await erc20.approve(mktAddr, wei);
          await txA.wait();
        }
        loader.show("Placing bid…");
        tx = await contractMkt.bid(BigInt(state.auctionIdOnChain), wei);
      } else {
        loader.show("Placing bid…");
        tx = await contractMkt.bid(BigInt(state.auctionIdOnChain), wei, { value: wei });
      }

      try {
        await fetch("/api/pending-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "NFT_AUCTION_BID",
            txHash: tx.hash,
            from: account.address,
            chainId: Number(chainId),
            payload: {
              auctionId: state.auctionIdDb,
              bidAmountBaseUnits: wei.toString(),
            },
            relatedId: state.auctionIdDb,
          }),
        });
      } catch {
        // ignore
      }

      toast.success("Bid submitted! Waiting to confirm…");
      dispatch({ type: "SET_BID_INPUT", value: "" });
    } catch (e: any) {
      toast.error(e?.reason || e?.message || "Bid failed");
    } finally {
      loader.hide();
      setIsTxBusy(false);
    }
  }

  async function cancelAuction() {
    if (isTxBusy) return;

    try {
      if (!state.auctionIdOnChain) return;
      if (!canCancelAuction) return toast.error("You can only cancel before any bids.");

      setIsTxBusy(true);

      const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 52014);
      const { signer, chainId } = await getBrowserSigner();
      if (Number(chainId) !== expectedChainId) {
        setIsTxBusy(false);
        return toast.error("Wrong network. Please switch to Electroneum.");
      }

      const mktAddr = process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS as `0x${string}`;
      const mkt = new ethers.Contract(mktAddr, MARKETPLACE_CORE_ABI, signer);

      loader.show("Cancelling auction…");
      const tx = await mkt.cancelAuction(BigInt(state.auctionIdOnChain));
      const receipt = await tx.wait();
      loader.hide();

      dispatch({ type: "SET_ONCHAIN_ID", id: null });
      dispatch({ type: "PATCH_SNAP", patch: { active: false } });

      toast.success("Auction cancelled");

      try {
        await fetch("/api/marketplace/auctions/attach-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CANCELLED",
            auctionId: state.auctionIdDb,
            txHash: tx.hash || receipt?.transactionHash || null,
          }),
        });
      } catch {
        // ignore
      }
    } catch (e: any) {
      loader.hide();
      toast.error(e?.message || "Cancel failed");
    } finally {
      setIsTxBusy(false);
    }
  }

  const shareTitle =
    state.nft?.name ||
    (state.nft?.tokenId ? `NFT #${state.nft.tokenId}` : `Auction #${auctionIdParam?.slice(0, 6)}…`);
  const shareText =
    (state.nft?.description && state.nft.description.slice(0, 120)) ||
    `Join the live auction for ${shareTitle} on Panthart`;

  const shareNow = async () => {
    if (isTxBusy) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: shareTitle, text: shareText, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // ignore
    }
  };

  const highestBidderMeta = React.useMemo(() => {
    const w = snap.highestBidder || "";
    if (!w) return null;
    return bidderCache.current.get(keyOf(w)) ?? { wallet: w, username: null, avatarUrl: dicebear(w) };
  }, [snap.highestBidder]);

  const is1155 = state.nft?.standard === "ERC1155";
  const editionQty = Math.max(1, Number(state.nft?.quantity ?? 1));

  const headerBadge = (() => {
    if (auctionEnded) return <Badge variant="outline" className="text-red-500 border-red-500/30">Ended</Badge>;
    if (notStartedYet) return <Badge variant="outline">Scheduled</Badge>;
    if (snap.active) return <Badge variant="soft" className="gap-1"><Sparkles className="h-3.5 w-3.5" /> Live</Badge>;
    return <Badge variant="outline">Inactive</Badge>;
  })();

  const timeLabel = notStartedYet ? "Starts In" : "Ends In";

  const progressPct = React.useMemo(() => {
    if (!snap.startISO || !snap.endISO) return 0;
    const start = new Date(snap.startISO).getTime();
    const end = new Date(snap.endISO).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    const t = Math.min(end, Math.max(start, now));
    return ((t - start) / (end - start)) * 100;
  }, [snap.startISO, snap.endISO, now]);

  if (!state.booted || isRefreshing) return <AuctionNowSkeleton />;
  if (!state.contract || !state.tokenId) return <AuctionNowSkeleton />;

  const uiDisabled = isTxBusy || isRefreshing;

  return (
    <section className="pt-8 pb-10">
      <Container>
        <div className="flex items-center justify-between gap-3">
          <BackButton fallbackHref="/auction" variant="ghost" />
          <div className="flex items-center gap-2">
            <IconButton
              onClick={shareNow}
              aria-label="Share auction"
              title="Share"
              disabled={uiDisabled}
            >
              <Share2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className="mt-3">
          <BreadcrumbsBar
            items={[
              { type: "link", href: "/", label: "Home" },
              { type: "link", href: "/auction-now", label: "Auctioning Now" },
              { type: "page", label: `${auctionIdParam?.slice(0, 6)}…${auctionIdParam?.slice(-4)}` },
            ]}
          />
        </div>

        <div className="mt-4 relative overflow-hidden rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.14),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.10),transparent_38%)]" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {headerBadge}
                {isEscrowOwner ? (
                  <Badge variant="soft" className="gap-1">
                    <BadgeCheck className="h-3.5 w-3.5" /> Escrowed
                  </Badge>
                ) : null}
                {is1155 && editionQty > 1 ? <Badge variant="outline">Edition of {editionQty}</Badge> : null}
              </div>

              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight wrap-break-word">
                {state.nft?.name || (state.tokenId ? `NFT #${state.tokenId}` : `Auction #${auctionIdParam?.slice(0, 6)}…`)}
              </h1>

              {state.nft?.description ? (
                <p className="mt-2 text-sm text-muted leading-6 max-w-3xl line-clamp-3">{state.nft.description}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                <Link
                  href={`/collections/${state.contract}/${state.tokenId}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5 hover:bg-background transition"
                >
                  <Gavel className="h-3.5 w-3.5" />
                  <span className="font-mono">
                    {state.contract.slice(0, 6)}…{state.contract.slice(-4)} #{state.tokenId}
                  </span>
                </Link>

                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5">
                  Seller:{" "}
                  <span className="font-mono">
                    {(snap.seller ?? state.apiAuctionSeller ?? "—").slice(0, 6)}…{(snap.seller ?? state.apiAuctionSeller ?? "—").slice(-4)}
                  </span>
                </span>
              </div>
            </div>

            {typeof rarityRank === "number" ? (
              <div className="shrink-0 self-start sm:pl-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2.5 shadow-sm backdrop-blur">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/6">
                    <Gem className="h-4 w-4" />
                  </span>

                  <div className="leading-tight">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
                      Rarity Rank
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      #{rarityRank}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
          <div className="lg:col-span-5 min-w-0">
            <div className="relative w-full aspect-square rounded-[28px] overflow-hidden bg-foreground/5 ring-1 ring-border flex items-center justify-center">
              {state.nft?.image ? (
                <div className="absolute inset-0">
                  <SmartMedia
                    src={state.nft.image}
                    alt={state.nft?.name || (state.tokenId ? `NFT #${state.tokenId}` : "NFT")}
                  />
                  <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_45%)]" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Skeleton className="w-28 h-28 rounded-2xl" />
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <InfoPill label="Standard" value={(state.nft?.standard ?? "ERC721").toString()} />

              {typeof state.nft?.royaltyBps === "number" ? (
                <InfoPill label="Royalties" value={`${(state.nft.royaltyBps / 100).toFixed(2)}%`} />
              ) : null}

              <div className={cx("col-span-2 flex items-center gap-2 min-w-0 rounded-[20px] border border-border bg-card px-3 py-2")}>
                <span className="text-muted">Contract</span>
                <span className="font-mono text-[11px] sm:text-xs truncate" title={state.contract}>
                  {state.contract}
                </span>
                <IconButton
                  className="h-9 w-9 rounded-full"
                  onClick={() => {
                    navigator.clipboard.writeText(state.contract);
                    toast.success("Contract copied");
                  }}
                  title="Copy contract address"
                  disabled={uiDisabled}
                >
                  <Copy className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6 min-w-0">
            <div className="rounded-[28px] border border-border bg-card p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.12),transparent_42%)]" />

              <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <StatBlock
                  label="Highest Bid"
                  value={snap.highestBidHuman ? `${formatNumber(Number(snap.highestBidHuman))} ${snap.currencySymbol}` : "—"}
                  sub={
                    snap.highestBidder ? (
                      <div className="mt-2 flex items-center gap-2 min-w-0">
                        <Image
                          src={highestBidderMeta?.avatarUrl || dicebear(snap.highestBidder)}
                          alt="bidder"
                          width={18}
                          height={18}
                          className="rounded-full"
                        />
                        <Link
                          href={`/profile/${snap.highestBidder}`}
                          className="truncate font-semibold text-foreground hover:opacity-80 transition"
                          title={snap.highestBidder}
                        >
                          {highestBidderMeta?.username?.trim()
                            ? highestBidderMeta.username
                            : `${snap.highestBidder.slice(0, 6)}…${snap.highestBidder.slice(-4)}`}
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-muted">No bidder yet</div>
                    )
                  }
                />

                <StatBlock
                  label="Minimum Bid"
                  value={
                    <span className="text-foreground">
                      {minReqLine}
                    </span>
                  }
                  sub={
                    <div className="mt-2 text-xs text-muted">
                      Min increment:{" "}
                      <span className="font-semibold text-foreground/90">
                        {snap.minIncrementHuman ? `${snap.minIncrementHuman} ${snap.currencySymbol}` : "—"}
                      </span>
                    </div>
                  }
                />

                <StatBlock
                  label={timeLabel}
                  value={
                    auctionEnded ? (
                      <span className="text-red-500">Auction Ended</span>
                    ) : notStartedYet ? (
                      <span>
                        {sd > 0 && `${sd}d `}
                        {sh}h {sm}m {ss}s
                      </span>
                    ) : (
                      <span>
                        {d > 0 && `${d}d `}
                        {h}h {m}m {s}s
                      </span>
                    )
                  }
                  sub={
                    <div className="mt-2 space-y-2">
                      <Progress value={progressPct} />
                      <div className="text-[11px] text-muted leading-relaxed">
                        {snap.startISO ? <div>Start: {new Date(snap.startISO).toLocaleString()}</div> : null}
                        {snap.endISO ? <div>End: {new Date(snap.endISO).toLocaleString()}</div> : null}
                      </div>
                    </div>
                  }
                />
              </div>

              <div className="relative mt-5 rounded-3xl border border-border bg-background/50 p-4">
                {isSeller ? (
                  <div className="mb-3 rounded-[18px] border border-border bg-card px-4 py-3 text-xs text-muted">
                    Sellers cannot place bids on their own items.
                  </div>
                ) : null}

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="relative w-full sm:flex-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      placeholder={`Your bid in ${snap.currencySymbol}`}
                      value={state.bidInput}
                      onChange={(e) => dispatch({ type: "SET_BID_INPUT", value: sanitizeHuman(e.target.value) })}
                      disabled={uiDisabled || !snap.active || auctionEnded || notStartedYet || isSeller}
                      className="pr-24"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                      onClick={fillMin}
                      disabled={uiDisabled || !snap.active || auctionEnded || notStartedYet || isSeller}
                      title="Set to minimum bid"
                    >
                      Min
                    </Button>
                  </div>

                  <Button
                    onClick={placeBid}
                    disabled={uiDisabled || !snap.active || auctionEnded || notStartedYet || isSeller || !minValid}
                    title={
                      uiDisabled
                        ? "Please wait…"
                        : !snap.active || auctionEnded
                          ? "Auction is not active"
                          : notStartedYet
                            ? "Bidding opens at the start time"
                            : isSeller
                              ? "Sellers cannot bid"
                              : minValid
                                ? "Place your bid"
                                : "Enter at least the minimum bid"
                    }
                  >
                    <Clock className="h-4 w-4" />
                    {isTxBusy ? "Placing…" : "Place Bid"}
                  </Button>
                </div>

                <div className="mt-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="text-[11px] text-muted">Minimum bid required</div>
                  <div className="mt-0.5 text-lg font-semibold text-foreground">
                    {minReqLine}
                  </div>
                  {!minValid && state.bidInput ? (
                    <div className="mt-1 text-xs text-red-500">Your bid must be at least the minimum.</div>
                  ) : null}
                </div>

                {state.auctionIdOnChain && canManageAuction ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      variant="danger"
                      onClick={cancelAuction}
                      disabled={uiDisabled || !canCancelAuction}
                      title={canCancelAuction ? "Cancel Auction" : "Cannot cancel after first bid"}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel Auction
                    </Button>
                    {!canCancelAuction ? (
                      <span className="text-xs text-muted">Cancel is only available before any bids.</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Live Bids</h3>
                  {snap.active && !auctionEnded ? <Badge variant="soft">Streaming</Badge> : <Badge variant="outline">Static</Badge>}
                </div>
                <span className="text-xs text-muted">
                  {mergedBids.length} shown · {snap.bidsCount} total
                </span>
              </div>

              {mergedBids.length === 0 ? (
                <p className="text-sm text-muted mt-3">No bids yet. Be the first to bid!</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {mergedBids.map((b) => {
                    const key =
                      (b as any).txHash && typeof (b as any).txHash === "string"
                        ? (b as any).txHash
                        : `${keyOf((b as any).bidder)}-${b.time}`;

                    const isPending = (b as any).pending === true;
                    const wallet = (b as any).bidder as string;
                    const meta =
                      bidderCache.current.get(keyOf(wallet)) ??
                      ({ wallet, username: null, avatarUrl: dicebear(wallet) } as BidderMeta);

                    return (
                      <li
                        key={key}
                        className={cx(
                          "flex items-center justify-between gap-3 text-sm",
                          "rounded-[20px] border border-border bg-background/50 px-4 py-3"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Image src={meta.avatarUrl || dicebear(wallet)} alt="bidder" width={20} height={20} className="rounded-full" />
                          <Link
                            href={`/profile/${wallet}`}
                            className="truncate font-semibold text-foreground hover:opacity-80 transition"
                            title={wallet}
                          >
                            {meta.username?.trim() ? meta.username : `${wallet.slice(0, 6)}…${wallet.slice(-4)}`}
                          </Link>
                          {isPending ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                              Pending…
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-semibold">
                            {b.amountHuman} {snap.currencySymbol}
                          </span>
                          <span className="text-muted text-xs">{new Date(b.time).toLocaleTimeString()}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------- helpers ----------------------------- */

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0 rounded-[20px] border border-border bg-card px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-foreground truncate">{value}</span>
    </div>
  );
}

function StatBlock({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl sm:text-2xl font-semibold text-foreground wrap-break-word">{value}</div>
      {sub ? <div className="min-w-0">{sub}</div> : null}
    </div>
  );
}