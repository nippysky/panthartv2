/* eslint-disable @typescript-eslint/no-explicit-any */
// components/form-config/index.tsx
"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";
import { ethers } from "ethers";

import { useLoaderStore } from "@/src/lib/store/loader-store";
import { formatNumber } from "@/src/lib/utils";
import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";
import { Textarea } from "@/src/ui/Textarea";
import { Skeleton } from "@/src/ui/Skeleton";
import { Switch } from "@/src/ui/Switch";

import WhitelistInput from "./WhitelistInput";
import DateTimePicker from "../shared/DateTimePicker";
import type {
  DeployPayload,
  AllowlistState,
  PrepareResult,
  MetaPreview,
  FieldErrors,
  Mode,
} from "@/src/types/dropCollection";
import PreviewDeployModal from "./PreviewDeployModal";

/* ----------------------- constants ----------------------- */
const MIN_LEAD_MINUTES = 5;

// Lagos is stable UTC+01:00 (no DST)
const LAGOS_OFFSET_MIN = 60;

/* ----------------------- helpers ----------------------- */
function etnToWeiStr(input: string): string {
  const cleaned = input.replace(/etn/i, "").trim();
  if (!/^\d+(\.\d{0,18})?$/.test(cleaned)) throw new Error("Enter a valid ETN amount (max 18 decimals).");
  const [intPart, fracRaw = ""] = cleaned.split(".");
  const frac = (fracRaw + "0".repeat(18)).slice(0, 18);
  const wei = BigInt(intPart || "0") * BigInt(10) ** BigInt(18) + BigInt(frac || "0");
  return wei.toString();
}

function weiToEtnStr(wei: string | bigint, maxFrac = 6) {
  try {
    const w = typeof wei === "bigint" ? wei : BigInt(wei);
    const int = w / BigInt(10) ** BigInt(18);
    const frac = w % (BigInt(10) ** BigInt(18));
    const fracStr = frac
      .toString()
      .padStart(18, "0")
      .slice(0, maxFrac)
      .replace(/0+$/, "");
    return fracStr ? `${int.toString()}.${fracStr}` : int.toString();
  } catch {
    return "0";
  }
}

function weiToEtnNum(wei: string | bigint): number {
  try {
    const w = typeof wei === "bigint" ? wei : BigInt(wei);
    return Number(w) / 1e18;
  } catch {
    return 0;
  }
}

function normalizeBaseUri(uri: string) {
  return uri.trim().replace(/\/+$/, "");
}

function toHttp(url: string) {
  return url?.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${url.slice(7)}` : url;
}

function sniffMediaType(link: string): "video" | "image" {
  const u = link.toLowerCase().split("?")[0];
  if (u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov")) return "video";
  return "image";
}

/**
 * Convert "YYYY-MM-DDTHH:mm" (interpreted as Africa/Lagos local time) to a Date instant.
 * This avoids relying on the viewer's OS/browser timezone.
 */
function fromLagosLocalYMDHM(s: string): Date | null {
  if (!s) return null;
  const [datePart, timePart] = s.split("T");
  if (!datePart || !timePart) return null;

  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);

  if (!y || !m || !d || hh === undefined || mm === undefined) return null;

  // Lagos local time = UTC + 1h => UTC instant = local - 1h
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0) - LAGOS_OFFSET_MIN * 60 * 1000;
  const dt = new Date(utcMs);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function AssetRenderer({ url }: { url: string }) {
  const resolved = url ? toHttp(url) : "";
  if (!resolved) {
    return (
      <div className="relative w-full aspect-square rounded-2xl border border-border overflow-hidden bg-background flex items-center justify-center">
        <div className="text-xs text-muted-foreground">No preview media</div>
      </div>
    );
  }

  const kind = sniffMediaType(resolved);

  return (
    <div className="relative w-full aspect-square rounded-2xl border border-border overflow-hidden bg-background">
      {kind === "video" ? (
        <video className="h-full w-full object-contain bg-black" src={resolved} controls playsInline preload="metadata" />
      ) : (
        <Image src={resolved} alt="Preview" fill className="object-contain" />
      )}
    </div>
  );
}

function formatUsd(n?: number | null) {
  if (!n || !isFinite(n)) return "—";
  try {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return "—";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

/* ----------------------- tiny UI helpers ----------------------- */
function TinyError({ text }: { text?: string | null }) {
  return text ? <p className="mt-1.5 text-[11px] leading-snug text-red-500">{text}</p> : null;
}

function TipIcon({ tip }: { tip: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full"
        onClick={() => setOpen((v) => !v)}
        aria-label="Info"
      >
        <Info className="h-4 w-4 opacity-80" />
      </Button>

      {open ? (
        <>
          <button aria-label="Close tip" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-50 w-80 max-w-[85vw] rounded-2xl border border-border bg-card p-3 text-sm shadow-xl">
            {tip}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Shared Field wrapper = consistent Apple-air spacing:
 * label row + optional tip + optional rightSlot (e.g. switch)
 * control + optional hint + optional error.
 */
function Field({
  label,
  tip,
  rightSlot,
  hint,
  error,
  children,
}: {
  label: React.ReactNode;
  tip?: React.ReactNode;
  rightSlot?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-medium leading-5">{label}</div>
          {tip ? <TipIcon tip={tip} /> : null}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>

      <div className="pt-0.5">{children}</div>

      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
      <TinyError text={error ?? null} />
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["rounded-3xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 shadow-sm", className].join(" ")}>
      {title ? (
        <div className="mb-6 space-y-1">
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ----------------------- component ----------------------- */
type Props = {
  mode: Mode;
  baseUriFromUploads?: string;
  detectedSupply?: number;
  onBack: () => void;
  onDeploy: (payload: DeployPayload) => Promise<void>;
  showBackButton?: boolean;
};

export default function ConfigForm({
  mode,
  baseUriFromUploads,
  detectedSupply,
  onBack,
  onDeploy,
  showBackButton = true,
}: Props) {
  const { show, hide } = useLoaderStore();

  // Basic state
  const [supplyWarning, setSupplyWarning] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");

  // Keep Base URI in sync with parent (important for upload mode)
  const [baseUri, setBaseUri] = useState(baseUriFromUploads ?? "");
  useEffect(() => {
    setBaseUri(baseUriFromUploads ?? "");
  }, [baseUriFromUploads]);

  const [totalSupplyStr, setTotalSupplyStr] = useState("");
  const [royaltyRecipient, setRoyaltyRecipient] = useState("");
  const [royaltyPercentStr, setRoyaltyPercentStr] = useState("5");

  const [publicStart, setPublicStart] = useState("");
  const [publicPriceEtn, setPublicPriceEtn] = useState("");
  const [maxPerWalletStr, setMaxPerWalletStr] = useState("");
  const [maxPerTxStr, setMaxPerTxStr] = useState("");
  const [walletUnlimited, setWalletUnlimited] = useState(false);

  // Images required
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);

  // IMPORTANT: use native input refs (your Input does not forward refs)
  const logoRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);

  const [uploadingImg, setUploadingImg] = useState(false);
  const logoInputId = useId();
  const coverInputId = useId();

  // Presale
  const [enablePresale, setEnablePresale] = useState(false);
  const [presaleStart, setPresaleStart] = useState("");
  const [presaleEnd, setPresaleEnd] = useState("");
  const [presalePriceEtn, setPresalePriceEtn] = useState("");
  const [presaleSupplyStr, setPresaleSupplyStr] = useState("1");

  // Allowlist + merkle
  const [allowState, setAllowState] = useState<AllowlistState | null>(null);
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);

  // Base preview
  const [pvLoading, setPvLoading] = useState(false);
  const [pvError, setPvError] = useState<string | null>(null);
  const [pvErrorCount, setPvErrorCount] = useState(0);
  const [pv, setPv] = useState<MetaPreview | null>(null);
  const [debouncedBase, setDebouncedBase] = useState(baseUri);

  // Supply detection
  const [detectingSupply, setDetectingSupply] = useState(false);
  const [detectedFromBase, setDetectedFromBase] = useState<number | null>(null);

  // Modal / action locks
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openingPreview, setOpeningPreview] = useState(false);
  const [confirmingDeploy, setConfirmingDeploy] = useState(false);

  // Inline errors
  const [errors, setErrors] = useState<FieldErrors>({});

  // Touched tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const showIfTouched = (key: keyof FieldErrors) => (touched[key as string] ? errors[key] : null);

  // ---- Platform fee ----
  type FeeInfo = {
    feeRecipient: string;
    feeAmountEtnWei: string;
    targetUsdCents?: number;
    lastPriceUsd?: string | number;
    lastPriceAt?: string;
    pricingSource?: string;
    pricingPair?: string;
  };
  const [fee, setFee] = useState<FeeInfo | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeErr, setFeeErr] = useState<string | null>(null);

  const feeEtnDisplay = weiToEtnStr(fee?.feeAmountEtnWei ?? "0", 6);
  const feeEtnNum = weiToEtnNum(fee?.feeAmountEtnWei ?? "0");
  const mktPrice = fee?.lastPriceUsd != null ? Number(fee.lastPriceUsd) : null;
  const feeUsdApprox = mktPrice ? feeEtnNum * mktPrice : null;
  const lastUpdatedStr = timeAgo(fee?.lastPriceAt);

  const fetchFee = useCallback(async () => {
    setFeeLoading(true);
    setFeeErr(null);
    try {
      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractType: "ERC721_DROP",
          metadataOption: mode === "upload" ? "UPLOAD" : "EXTERNAL",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch fee config");

      if (!json?.feeRecipient || !ethers.isAddress(json.feeRecipient)) {
        throw new Error("Fee recipient is misconfigured (must be a 0x address).");
      }

      setFee(json as FeeInfo);
    } catch (e: any) {
      setFee(null);
      setFeeErr(e?.message || "Could not load fee.");
    } finally {
      setFeeLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchFee();
  }, [fetchFee]);

  // If wizard passed a detected supply from uploads, prefer it and auto-fill
  useEffect(() => {
    if (typeof detectedSupply === "number" && detectedSupply > 0) {
      setTotalSupplyStr(String(detectedSupply));
      if (walletUnlimited) setMaxPerWalletStr(String(detectedSupply));
    }
  }, [detectedSupply, walletUnlimited]);

  const uploadToCloudinary = useCallback(
    async (file: File, setter: (url: string) => void, ref?: React.RefObject<HTMLInputElement | null>) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Only image formats are allowed.");
        return;
      }
      setUploadingImg(true);
      show("Uploading image…");
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload-image", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok || !json?.success || !json?.data?.secure_url) throw new Error(json?.error || "Upload failed");
        setter(json.data.secure_url);

        if (ref?.current) ref.current.value = "";
        toast.success("Uploaded!");
      } catch (e: any) {
        toast.error(e.message || "Upload failed");
      } finally {
        hide();
        setUploadingImg(false);
      }
    },
    [show, hide]
  );

  // Debounce base URI changes for preview + counting
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBase(normalizeBaseUri(baseUri)), 450);
    return () => clearTimeout(t);
  }, [baseUri]);

  const fetchPreview = useCallback(async () => {
    const b = debouncedBase;
    setPv(null);
    if (!b || !b.startsWith("ipfs://")) return;

    setPvLoading(true);
    setPvError(null);

    try {
      const tryUrls = [toHttp(`${b}/1.json`), toHttp(`${b}/0.json`)];
      let got: any = null;

      for (const u of tryUrls) {
        const res = await fetch(u, { cache: "no-store" });
        if (res.ok) {
          got = await res.json();
          break;
        }
      }

      if (!got) throw new Error("Could not fetch metadata (tried 1.json and 0.json).");

      setPv({
        name: got?.name,
        description: got?.description,
        image: got?.image,
        animation_url: got?.animation_url,
        attributes: Array.isArray(got?.attributes) ? got.attributes : [],
      });

      setPvError(null);
      setPvErrorCount(0);
    } catch (e: any) {
      setPv(null);
      setPvError(e?.message || "Failed to fetch preview.");
      setPvErrorCount((c) => c + 1);
    } finally {
      setPvLoading(false);
    }
  }, [debouncedBase]);

  useEffect(() => {
    if (debouncedBase && debouncedBase.startsWith("ipfs://")) {
      fetchPreview();
    }
  }, [debouncedBase, fetchPreview]);

  // ---- Base-URI item counting ----------------------
  const existsAt = useCallback(async (base: string, id: number): Promise<boolean> => {
    const url = toHttp(`${base}/${id}.json`);
    try {
      const h = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (h.ok) return true;

      if (h.status === 405 || h.status === 403) {
        const g = await fetch(url, { cache: "no-store" });
        return g.ok;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const estimateFromBase = useCallback(
    async (base: string): Promise<number | null> => {
      const one = await existsAt(base, 1);
      const zero = await existsAt(base, 0);
      if (!one && !zero) return null;
      const start = one ? 1 : 0;

      const CAP = 100_000;
      let lo = start;

      if (!(await existsAt(base, lo))) return null;

      let hi = start === 0 ? 1 : 2;

      while (hi <= CAP) {
        const ok = await existsAt(base, hi);
        if (!ok) break;
        lo = hi;
        hi = hi * 2;
      }

      if (hi > CAP) return start === 0 ? lo + 1 : lo;

      while (lo + 1 < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const ok = await existsAt(base, mid);
        if (ok) lo = mid;
        else hi = mid;
      }

      return start === 0 ? lo + 1 : lo;
    },
    [existsAt]
  );

  useEffect(() => {
    const b = debouncedBase;
    if (!b || !b.startsWith("ipfs://")) {
      setDetectedFromBase(null);
      return;
    }

    let cancelled = false;
    setDetectingSupply(true);

    estimateFromBase(b)
      .then((count) => {
        if (cancelled) return;
        setDetectedFromBase(count ?? null);
      })
      .finally(() => {
        if (!cancelled) setDetectingSupply(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedBase, estimateFromBase]);

  useEffect(() => {
    const fromUploads = typeof detectedSupply === "number" && detectedSupply > 0 ? detectedSupply : null;
    const fromBase = typeof detectedFromBase === "number" && detectedFromBase > 0 ? detectedFromBase : null;

    const chosen = fromUploads ?? fromBase ?? null;

    if (fromUploads && fromBase && fromUploads !== fromBase) {
      setSupplyWarning(`Detected ${fromUploads} from uploads, ${fromBase} from Base URI. Using ${fromUploads}.`);
    } else {
      setSupplyWarning(null);
    }

    if (chosen && Number(totalSupplyStr) !== chosen) {
      setTotalSupplyStr(String(chosen));
      if (walletUnlimited) setMaxPerWalletStr(String(chosen));
    }
  }, [detectedSupply, detectedFromBase, walletUnlimited, totalSupplyStr]);

  // Helpers
  function mustInt(str: string, label: string) {
    const n = Number(str);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) throw new Error(`${label} must be a positive integer.`);
    return n;
  }

  function minLeadInstant(): Date {
    const ms = Date.now() + MIN_LEAD_MINUTES * 60 * 1000;
    const d = new Date(ms);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  }

  const validateCore = useCallback(() => {
    if (!name.trim()) throw new Error("Name is required.");
    if (!symbol.trim()) throw new Error("Symbol is required.");
    if (!description.trim()) throw new Error("Description is required.");
    if (!logoUrl) throw new Error("Logo is required.");
    if (!coverUrl) throw new Error("Cover photo is required.");
    if (!baseUri.trim()) throw new Error("Base URI is required.");
    if (!baseUri.startsWith("ipfs://")) throw new Error("Base URI must start with ipfs://<CID>");

    const totalSupply = mustInt(totalSupplyStr, "Total supply");

    const maxPerWallet = walletUnlimited ? totalSupply : mustInt(maxPerWalletStr, "Max per wallet");
    const maxPerTx = mustInt(maxPerTxStr, "Max per transaction");

    if (maxPerWallet > totalSupply) throw new Error("Max per wallet cannot exceed total supply.");
    if (maxPerTx > totalSupply) throw new Error("Max per transaction cannot exceed total supply.");
    if (maxPerTx > 20) throw new Error("Max per transaction cannot exceed 20.");

    if (!royaltyRecipient || !ethers.isAddress(royaltyRecipient)) throw new Error("Invalid royalty recipient.");

    const rp = Number(royaltyPercentStr);
    if (!Number.isFinite(rp) || rp < 0 || rp > 10) throw new Error("Royalty must be between 0 and 10 percent.");

    if (!publicStart) throw new Error("Public sale start is required.");
    const pubStart = fromLagosLocalYMDHM(publicStart);
    if (!pubStart) throw new Error("Public sale start is invalid.");

    const threshold = minLeadInstant();
    if (!(pubStart > threshold)) throw new Error("Public sale start must be at least 5 minutes from now.");

    if (!publicPriceEtn.trim()) throw new Error("Public price is required.");
    if (!(Number(publicPriceEtn) > 0)) throw new Error("Public price must be greater than 0.");

    return { totalSupply, maxPerWallet, maxPerTx, royaltyPercent: rp };
  }, [
    name,
    symbol,
    description,
    logoUrl,
    coverUrl,
    baseUri,
    totalSupplyStr,
    walletUnlimited,
    maxPerWalletStr,
    maxPerTxStr,
    royaltyRecipient,
    royaltyPercentStr,
    publicStart,
    publicPriceEtn,
  ]);

  const validatePresale = useCallback(
    (totalSupply: number) => {
      if (!enablePresale) return null;

      if (!presaleStart) throw new Error("Presale start is required.");
      if (!presaleEnd) throw new Error("Presale end is required.");

      const preStart = fromLagosLocalYMDHM(presaleStart);
      const preEnd = fromLagosLocalYMDHM(presaleEnd);
      const pubStart = fromLagosLocalYMDHM(publicStart);

      if (!preStart || !preEnd) throw new Error("Presale start/end is invalid.");

      const threshold = minLeadInstant();
      if (!(preStart > threshold)) throw new Error("Presale start must be at least 5 minutes from now.");
      if (preEnd <= preStart) throw new Error("Presale end must be after start.");

      if (pubStart && isFinite(pubStart.getTime())) {
        if (!(preStart < pubStart && preEnd < pubStart)) {
          throw new Error("Presale start/end must both be before the public sale start.");
        }
      }

      if (!presalePriceEtn.trim()) throw new Error("Presale price is required.");
      if (!(Number(presalePriceEtn) > 0)) throw new Error("Presale price must be greater than 0.");

      const pre = Number(presalePriceEtn);
      const pub = Number(publicPriceEtn);
      if (Number.isFinite(pub) && Number.isFinite(pre) && !(pre < pub)) {
        throw new Error("Presale price must be less than public price.");
      }

      const presaleSupply = mustInt(presaleSupplyStr, "Presale supply");
      if (presaleSupply > totalSupply) throw new Error("Presale supply cannot exceed total supply.");

      if (
        !allowState ||
        allowState.invalid.length ||
        allowState.duplicates.length ||
        allowState.validChecksummed.length === 0
      ) {
        throw new Error("Allowlist must contain only valid, non-duplicate addresses.");
      }
      if (!prepared?.ok || !prepared?.merkleRoot) throw new Error("Generate Merkle root before proceeding.");

      return {
        presaleSupply,
        merkleRoot: prepared.merkleRoot!,
        allowlistCount: allowState.validChecksummed.length,
      };
    },
    [enablePresale, presaleStart, presaleEnd, publicStart, presalePriceEtn, publicPriceEtn, presaleSupplyStr, allowState, prepared]
  );

  // Live validation
  useEffect(() => {
    const next: FieldErrors = {};

    if (!baseUri.trim()) next.baseUri = "Base URI is required.";
    else if (!baseUri.startsWith("ipfs://")) next.baseUri = "Base URI must start with ipfs://<CID>";
    else next.baseUri = null;

    next.name = name.trim() ? null : "Name is required.";
    next.symbol = symbol.trim() ? null : "Symbol is required.";
    next.description = description.trim() ? null : "Description is required.";

    if (!totalSupplyStr) next.totalSupply = "Total supply is required.";
    else if (!/^\d+$/.test(totalSupplyStr) || Number(totalSupplyStr) <= 0) next.totalSupply = "Total supply must be a positive integer.";
    else next.totalSupply = null;

    if (!royaltyRecipient.trim()) next.royaltyRecipient = "Royalty recipient is required.";
    else if (!ethers.isAddress(royaltyRecipient)) next.royaltyRecipient = "Enter a valid wallet address (0x...)";
    else next.royaltyRecipient = null;

    if (royaltyPercentStr === "") next.royaltyPercent = "Royalty percent is required.";
    else if (!/^\d+(\.\d+)?$/.test(royaltyPercentStr)) next.royaltyPercent = "Enter a valid number.";
    else if (Number(royaltyPercentStr) < 0 || Number(royaltyPercentStr) > 10) next.royaltyPercent = "Must be between 0 and 10.";
    else next.royaltyPercent = null;

    if (!publicStart) next.publicStart = "Public sale start is required.";
    else {
      const threshold = minLeadInstant();
      const d = fromLagosLocalYMDHM(publicStart);
      next.publicStart = d && d > threshold ? null : "Must be at least 5 minutes from now.";
    }

    if (!publicPriceEtn.trim()) next.publicPrice = "Public price is required.";
    else if (!/^\d+(\.\d{0,18})?$/.test(publicPriceEtn.trim())) next.publicPrice = "Enter a valid ETN amount (max 18 decimals).";
    else if (!(Number(publicPriceEtn) > 0)) next.publicPrice = "Must be greater than 0.";
    else next.publicPrice = null;

    const total = Number(totalSupplyStr);

    if (!walletUnlimited) {
      if (!maxPerWalletStr) next.maxPerWallet = "Max per wallet is required.";
      else if (!/^\d+$/.test(maxPerWalletStr) || Number(maxPerWalletStr) <= 0) next.maxPerWallet = "Must be a positive integer.";
      else if (Number.isFinite(total) && total > 0 && Number(maxPerWalletStr) > total) next.maxPerWallet = "Cannot exceed Total supply.";
      else next.maxPerWallet = null;
    } else {
      next.maxPerWallet = null;
    }

    if (!maxPerTxStr) next.maxPerTx = "Max per transaction is required.";
    else if (!/^\d+$/.test(maxPerTxStr) || Number(maxPerTxStr) <= 0) next.maxPerTx = "Must be a positive integer.";
    else if (Number(maxPerTxStr) > 20) next.maxPerTx = "Cannot exceed 20.";
    else {
      const mptx = Number(maxPerTxStr);
      const mpw = walletUnlimited ? total : Number(maxPerWalletStr);

      if (Number.isFinite(total) && total > 0 && mptx > total) next.maxPerTx = "Cannot exceed Total supply.";
      else if (Number.isFinite(mpw) && mpw > 0 && mptx > mpw) next.maxPerTx = "Cannot exceed Max per wallet.";
      else next.maxPerTx = null;
    }

    if (enablePresale) {
      if (!presaleStart) next.presaleStart = "Presale start is required.";
      else {
        const d = fromLagosLocalYMDHM(presaleStart);
        const threshold = minLeadInstant();
        next.presaleStart = d && d > threshold ? null : "Must be at least 5 minutes from now.";
      }

      if (!presaleEnd) next.presaleEnd = "Presale end is required.";
      else next.presaleEnd = null;

      if (presaleStart && presaleEnd) {
        const preS = fromLagosLocalYMDHM(presaleStart);
        const preE = fromLagosLocalYMDHM(presaleEnd);
        if (preS && preE && preE <= preS) next.presaleEnd = "Presale end must be after start.";

        const pubS = fromLagosLocalYMDHM(publicStart);
        if (pubS && preS && preE) {
          if (!(preS < pubS)) next.presaleStart = "Presale start must be before public sale start.";
          if (!(preE < pubS)) next.presaleEnd = "Presale end must be before public sale start.";
        }
      }

      if (!presalePriceEtn.trim()) next.presalePrice = "Presale price is required.";
      else if (!/^\d+(\.\d{0,18})?$/.test(presalePriceEtn.trim())) next.presalePrice = "Enter a valid ETN amount (max 18 decimals).";
      else if (!(Number(presalePriceEtn) > 0)) next.presalePrice = "Must be greater than 0.";
      else if (publicPriceEtn && /^\d+(\.\d{0,18})?$/.test(publicPriceEtn.trim())) {
        const pre = Number(presalePriceEtn);
        const pub = Number(publicPriceEtn);
        next.presalePrice = pre < pub ? null : "Must be less than public price.";
      } else {
        next.presalePrice = null;
      }

      if (!presaleSupplyStr) next.presaleSupply = "Presale supply is required.";
      else if (!/^\d+$/.test(presaleSupplyStr) || Number(presaleSupplyStr) <= 0) next.presaleSupply = "Must be a positive integer.";
      else if (Number.isFinite(total) && total > 0 && Number(presaleSupplyStr) > total) next.presaleSupply = "Cannot exceed Total supply.";
      else next.presaleSupply = null;
    } else {
      next.presaleStart = null;
      next.presaleEnd = null;
      next.presalePrice = null;
      next.presaleSupply = null;
    }

    setErrors(next);
  }, [
    baseUri,
    name,
    symbol,
    description,
    totalSupplyStr,
    royaltyRecipient,
    royaltyPercentStr,
    publicStart,
    publicPriceEtn,
    maxPerWalletStr,
    maxPerTxStr,
    walletUnlimited,
    enablePresale,
    presaleStart,
    presaleEnd,
    presalePriceEtn,
    presaleSupplyStr,
  ]);

  const canOpenModal = useMemo(() => {
    try {
      const { totalSupply } = validateCore();
      if (enablePresale) validatePresale(totalSupply);
      return true;
    } catch {
      return false;
    }
  }, [validateCore, enablePresale, validatePresale]);

  const uiLocked = openingPreview || confirmingDeploy;

  const onConfirmDeploy = useCallback(async () => {
    if (confirmingDeploy) return;

    setConfirmingDeploy(true);

    try {
      const { totalSupply, maxPerWallet, maxPerTx, royaltyPercent } = validateCore();
      const presale = validatePresale(totalSupply);

      const pubInstant = fromLagosLocalYMDHM(publicStart);
      if (!pubInstant) throw new Error("Public sale start is invalid.");

      const payload: DeployPayload = {
        metadataOption: mode === "upload" ? "UPLOAD" : "EXTERNAL",
        baseURI: normalizeBaseUri(baseUri),
        name: name.trim(),
        symbol: symbol.trim(),
        description: description.trim(),
        totalSupply,
        publicPriceWei: etnToWeiStr(publicPriceEtn),
        maxPerWallet,
        maxPerTx,
        publicStartISO: pubInstant.toISOString(),
        royaltyPercent,
        royaltyRecipient: royaltyRecipient.trim(),
        logoUrl,
        coverUrl,
      };

      if (enablePresale && presale && prepared?.ok && prepared?.merkleRoot) {
        const preS = fromLagosLocalYMDHM(presaleStart);
        const preE = fromLagosLocalYMDHM(presaleEnd);
        if (!preS || !preE) throw new Error("Presale start/end is invalid.");

        payload.presale = {
          startISO: preS.toISOString(),
          endISO: preE.toISOString(),
          priceWei: etnToWeiStr(presalePriceEtn),
          maxSupply: presale.presaleSupply,
          merkleRoot: prepared.merkleRoot!,
          allowlistCount: prepared?.count ?? allowState?.validChecksummed.length ?? undefined,
          allowlistCommit: prepared?.commit,
          draftId: prepared?.draftId,
        };
      }

      show("Preparing deployment…");
      await onDeploy(payload);
    } catch (e: any) {
      hide();
      toast.error(e?.message || "Invalid input.");
    } finally {
      setConfirmingDeploy(false);
    }
  }, [
    confirmingDeploy,
    validateCore,
    validatePresale,
    publicStart,
    mode,
    baseUri,
    name,
    symbol,
    description,
    publicPriceEtn,
    royaltyRecipient,
    logoUrl,
    coverUrl,
    enablePresale,
    prepared,
    show,
    onDeploy,
    presaleStart,
    presaleEnd,
    presalePriceEtn,
    allowState?.validChecksummed.length,
    hide,
  ]);

  const baseUriWarning =
    pvErrorCount >= 2 ? "We couldn’t fetch metadata from this Base URI. Please verify your URI before deploying." : null;

  useEffect(() => {
    if (walletUnlimited) setMaxPerWalletStr(totalSupplyStr || "");
  }, [walletUnlimited, totalSupplyStr]);

  const fromUploads = typeof detectedSupply === "number" && detectedSupply > 0;
  const totalSupplyHint = detectingSupply
    ? "Counting items from Base URI…"
    : fromUploads
      ? `Detected ${detectedSupply} items from your uploads.`
      : typeof detectedFromBase === "number"
        ? `Detected ${detectedFromBase} items from Base URI.`
        : "We’ll detect supply automatically from uploads or Base URI.";

  const totalSupplyNum = Number(totalSupplyStr);
  const maxPerWalletNum = walletUnlimited ? totalSupplyNum : Number(maxPerWalletStr);

  const safeMaxPerTx = useMemo(() => {
    const caps: number[] = [20];
    if (Number.isFinite(totalSupplyNum) && totalSupplyNum > 0) caps.push(totalSupplyNum);
    if (!walletUnlimited && Number.isFinite(maxPerWalletNum) && maxPerWalletNum > 0) caps.push(maxPerWalletNum);
    return Math.max(1, Math.min(...caps));
  }, [totalSupplyNum, walletUnlimited, maxPerWalletNum]);

  return (
    <div className="w-full max-w-full space-y-12">
      {showBackButton ? (
        <div>
          <Button variant="ghost" className="px-0" onClick={onBack} disabled={uiLocked}>
            ← Back
          </Button>
        </div>
      ) : null}

      <div className="grid gap-10">
        {/* Base URI + Preview */}
        <Section
          title="Base URI"
          subtitle={
            <span>
              Use <code>ipfs://&lt;CID&gt;</code> with no trailing slash. Contract resolves{" "}
              <code>.../{`{tokenId}`}.json</code>.
            </span>
          }
        >
          <div className="space-y-8">
            <Field
              label="Base URI"
              tip={
                <div>
                  Use <code>ipfs://&lt;CID&gt;</code> with no trailing slash. Contract resolves <code>.../{`{tokenId}`}.json</code>.
                </div>
              }
              hint={
                <>
                  Expected: <code>ipfs://&lt;metadata_cid&gt;</code> (no trailing slash). Contract resolves{" "}
                  <code>ipfs://&lt;metadata_cid&gt;/{`{tokenId}`}.json</code>.
                </>
              }
              error={showIfTouched("baseUri")}
            >
              <Input
                className="h-11 rounded-2xl"
                placeholder="ipfs://<METADATA_CID>"
                value={baseUri}
                onChange={(e) => setBaseUri(e.target.value)}
                onBlur={() => markTouched("baseUri")}
                disabled={mode === "upload" || uiLocked}
              />
            </Field>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-medium">Preview</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 px-3 gap-2"
                  onClick={fetchPreview}
                  disabled={uiLocked || pvLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${pvLoading ? "animate-spin" : ""}`} />
                  {pvLoading ? "Loading…" : "Retry"}
                </Button>
              </div>

              {baseUriWarning ? (
                <div className="rounded-2xl border border-yellow-600/40 bg-yellow-600/10 text-yellow-300 p-3 text-xs mb-3">
                  {baseUriWarning}
                </div>
              ) : null}

              <div className="rounded-3xl border border-border p-4 bg-background/40">
                {pvLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="w-full aspect-square rounded-2xl" />
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-1/2" />
                      <Skeleton className="h-4 w-3/4" />
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Skeleton className="h-12 rounded-2xl" />
                        <Skeleton className="h-12 rounded-2xl" />
                        <Skeleton className="h-12 rounded-2xl" />
                        <Skeleton className="h-12 rounded-2xl" />
                      </div>
                    </div>
                  </div>
                ) : pvError ? (
                  <div className="text-sm text-red-500">{pvError}</div>
                ) : pv ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <AssetRenderer url={pv.animation_url || pv.image || ""} />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="text-lg font-semibold wrap-break-word">{pv.name || "Unnamed"}</div>
                        {pv.description ? (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line wrap-break-word">
                            {pv.description}
                          </p>
                        ) : null}
                      </div>

                      {!!pv.attributes?.length ? (
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Attributes</div>
                          <div className="grid grid-cols-2 gap-2">
                            {pv.attributes!.slice(0, 12).map(
                              (a: { trait_type?: string | undefined; value?: string | number | undefined }, i: number) => (
                                <div key={i} className="rounded-2xl border border-border bg-background p-3">
                                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground wrap-break-word">
                                    {a.trait_type ?? "Trait"}
                                  </div>
                                  <div className="text-sm font-semibold wrap-break-word">{String(a.value ?? "")}</div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Enter a valid Base URI to preview a sample item.</div>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* Collection Basics */}
        <Section title="Collection basics" subtitle="The essentials collectors see first. Keep it clean and memorable.">
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
              <Field label="Name" tip="A human-friendly collection name." error={showIfTouched("name")}>
                <Input
                  className="h-11 rounded-2xl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => markTouched("name")}
                  disabled={uiLocked}
                />
              </Field>

              <Field label="Symbol" tip="Short uppercase ticker, e.g., DECENT." error={showIfTouched("symbol")}>
                <Input
                  className="h-11 rounded-2xl"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  onBlur={() => markTouched("symbol")}
                  disabled={uiLocked}
                />
              </Field>

              <Field
                label="Total Supply"
                tip="Total number of NFTs that can ever be minted for this collection. Auto-detected and locked."
                hint={totalSupplyHint}
                error={showIfTouched("totalSupply")}
              >
                <Input
                  className="h-11 rounded-2xl bg-foreground/5 cursor-not-allowed"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={totalSupplyStr}
                  onChange={() => {}}
                  onBlur={() => markTouched("totalSupply")}
                  readOnly
                />
                {supplyWarning ? (
                  <div className="mt-3 rounded-2xl border border-yellow-600/40 bg-yellow-600/10 text-yellow-300 p-3 text-[11px]">
                    {supplyWarning}
                  </div>
                ) : null}
              </Field>
            </div>

            <Field
              label="Description"
              tip="Tell collectors about this drop. Supports plain text."
              error={showIfTouched("description")}
            >
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => markTouched("description")}
                placeholder="Tell collectors about this drop…"
                className="rounded-2xl wrap-break-word"
                disabled={uiLocked}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Cover */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium leading-5">Cover Photo</div>
                  <TipIcon tip="Wide hero image shown on your collection page. Recommended ~1600×400." />
                </div>

                <label
                  htmlFor={coverInputId}
                  className={[
                    "relative w-full h-44 md:h-48 rounded-3xl border border-dashed border-border",
                    "flex items-center justify-center overflow-hidden cursor-pointer bg-background/40",
                    "transition hover:bg-background/60",
                    uiLocked ? "pointer-events-none opacity-70" : "",
                  ].join(" ")}
                >
                  {coverUrl ? (
                    <Image src={coverUrl} alt="Cover" fill className="object-cover" />
                  ) : (
                    <span className="text-sm text-muted-foreground">Click to upload</span>
                  )}
                </label>

                <input
                  id={coverInputId}
                  ref={coverRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingImg || uiLocked}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await uploadToCloudinary(f, (u) => setCoverUrl(u), coverRef);
                  }}
                />

                <p className="text-xs text-muted-foreground">Recommended ~1600×400. Images only (jpg/png/gif).</p>
              </div>

              {/* Logo */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium leading-5">Logo</div>
                  <TipIcon tip="Square logo for your collection. Recommended ≥ 400×400." />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
                  <div className="shrink-0">
                    <label
                      htmlFor={logoInputId}
                      className={[
                        "relative overflow-hidden cursor-pointer bg-background/40 transition hover:bg-background/60",
                        "border border-dashed border-border rounded-2xl",
                        "w-20 h-20 sm:w-24 sm:h-24",
                        "flex items-center justify-center",
                        uiLocked ? "pointer-events-none opacity-70" : "",
                      ].join(" ")}
                    >
                      {logoUrl ? (
                        <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Upload</span>
                      )}
                    </label>

                    <input
                      id={logoInputId}
                      ref={logoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImg || uiLocked}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) await uploadToCloudinary(f, (u) => setLogoUrl(u), logoRef);
                      }}
                    />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Recommended ≥ 400×400. Images only (jpg/png/gif).
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Tip: use a simple mark that reads well at small sizes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Royalties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
              <Field
                label="Royalty Recipient"
                tip="EVM address to receive secondary-sale royalties. Must be a valid 0x address."
                error={showIfTouched("royaltyRecipient")}
              >
                <Input
                  className="h-11 rounded-2xl"
                  placeholder="0x…"
                  value={royaltyRecipient}
                  onChange={(e) => setRoyaltyRecipient(e.target.value)}
                  onBlur={() => {
                    markTouched("royaltyRecipient");
                    const v = royaltyRecipient.trim();
                    if (ethers.isAddress(v)) setRoyaltyRecipient(ethers.getAddress(v));
                  }}
                  disabled={uiLocked}
                />
              </Field>

              <Field
                label="Royalty (percent, max 10)"
                tip="Percent of sale price (0–10%)."
                error={showIfTouched("royaltyPercent")}
              >
                <Input
                  className="h-11 rounded-2xl"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={10}
                  step={1}
                  value={royaltyPercentStr}
                  onChange={(e) => setRoyaltyPercentStr(e.target.value)}
                  onBlur={() => markTouched("royaltyPercent")}
                  disabled={uiLocked}
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* Presale */}
        <WhitelistInput
          enabled={enablePresale}
          onEnabledChange={setEnablePresale}
          onAllowlistChange={(s: any) => setAllowState(s)}
          onPrepared={(r: any) => setPrepared(r)}
          invalidatePrepared={() => setPrepared(null)}
          presaleStart={presaleStart}
          onChangePresaleStart={setPresaleStart}
          presaleEnd={presaleEnd}
          onChangePresaleEnd={setPresaleEnd}
          presalePriceEtn={presalePriceEtn}
          onChangePresalePriceEtn={setPresalePriceEtn}
          presaleSupplyStr={presaleSupplyStr}
          onChangePresaleSupplyStr={setPresaleSupplyStr}
          presaleFieldErrors={{
            start: errors.presaleStart ?? null,
            end: errors.presaleEnd ?? null,
            price: errors.presalePrice ?? null,
            supply: errors.presaleSupply ?? null,
          }}
          totalSupplyMax={totalSupplyStr ? Number(totalSupplyStr) : undefined}
        />

        {/* Public sale */}
        <Section
          title="Public sale"
          subtitle="Set the public mint time, price, and per-wallet limits."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14">
            <div className="space-y-6">
              <Field
                label="Public sale start (Africa/Lagos)"
                tip="When the public sale opens. Presale must end before this date/time."
                error={showIfTouched("publicStart")}
              >
                <DateTimePicker
                  label=""
                  value={publicStart}
                  onChange={(v: React.SetStateAction<string>) => {
                    setPublicStart(v);
                    markTouched("publicStart");
                  }}
                  minNow
                />
              </Field>
            </div>

            <div className="space-y-6">
              <Field
                label="Public price (ETN)"
                tip="Price per token in ETN. Up to 18 decimal places."
                error={showIfTouched("publicPrice")}
              >
                <Input
                  className="h-11 rounded-2xl"
                  placeholder="e.g. 25"
                  value={publicPriceEtn}
                  onChange={(e) => setPublicPriceEtn(e.target.value)}
                  onBlur={() => markTouched("publicPrice")}
                  disabled={uiLocked}
                />
              </Field>
            </div>

            <div className="space-y-6">
              <Field
                label="Max per wallet"
                tip="Max tokens a single wallet can mint across the entire sale. Toggle Unlimited to allow up to total supply."
                rightSlot={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Unlimited</span>
                    <Switch
                      checked={walletUnlimited}
                      onCheckedChange={(v) => {
                        setWalletUnlimited(v);
                        if (v) setMaxPerWalletStr(totalSupplyStr || "");
                        markTouched("maxPerWallet");
                      }}
                    />
                  </div>
                }
                hint="Cannot exceed Total supply."
                error={showIfTouched("maxPerWallet")}
              >
                <Input
                  className="h-11 rounded-2xl"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  max={walletUnlimited ? undefined : totalSupplyStr ? Number(totalSupplyStr) : undefined}
                  value={walletUnlimited ? totalSupplyStr || "" : maxPerWalletStr}
                  onChange={(e) => setMaxPerWalletStr(e.target.value)}
                  onBlur={() => markTouched("maxPerWallet")}
                  disabled={walletUnlimited || uiLocked}
                  placeholder={walletUnlimited ? "Unlimited (<= Total supply)" : "e.g. 2"}
                />
              </Field>
            </div>

            <div className="space-y-6">
              <Field
                label="Max per transaction"
                tip="Upper bound per mint transaction to keep gas sane. Must be ≤ 20, ≤ Max per wallet, and ≤ Total supply."
                hint="Cannot exceed 20, Max per wallet, and Total supply. This prevents gas blowups."
                error={showIfTouched("maxPerTx")}
              >
                <Input
                  className="h-11 rounded-2xl"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  max={safeMaxPerTx}
                  value={maxPerTxStr}
                  onChange={(e) => setMaxPerTxStr(e.target.value)}
                  onBlur={() => markTouched("maxPerTx")}
                  placeholder="e.g. 5"
                  disabled={uiLocked}
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* Platform fee */}
        <Section title="Platform fee (one-time)" subtitle="This fee covers deployment + platform services.">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
            <div className="space-y-1 min-w-0">
              {feeLoading ? (
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-52" />
                </div>
              ) : fee ? (
                <div className="text-sm text-muted-foreground">
                  Payable to <span className="font-mono break-all">{fee.feeRecipient}</span>
                </div>
              ) : (
                <div className="text-sm text-red-500">{feeErr || "Fee unavailable."}</div>
              )}

              <div className="text-xs text-muted-foreground mt-2">
                {feeLoading ? (
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-32" />
                  </div>
                ) : (
                  <>
                    <div>≈ {formatUsd(feeUsdApprox)}</div>
                    <div className="mt-1">Last updated {lastUpdatedStr}</div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-base font-semibold">
              {feeLoading ? (
                <Skeleton className="h-6 w-28" />
              ) : (
                <>
                  {formatNumber(Number(feeEtnDisplay))}
                  <Image src="/ETN_LOGO.png" alt="ETN" width={16} height={16} />
                </>
              )}
            </div>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (uiLocked) return;

              setOpeningPreview(true);
              try {
                const { totalSupply } = validateCore();
                if (enablePresale) validatePresale(totalSupply);
                setConfirmOpen(true);
              } catch (e: any) {
                toast.error(e?.message || "Please complete required fields.");
              } finally {
                setOpeningPreview(false);
              }
            }}
            disabled={!canOpenModal || !totalSupplyStr || detectingSupply || uiLocked}
            title={!canOpenModal ? "Complete required fields before continuing" : undefined}
          >
            {openingPreview ? "Opening preview…" : confirmingDeploy ? "Preparing…" : "Preview & Deploy"}
          </Button>
        </div>
      </div>

      {/* Modal */}
      <PreviewDeployModal
        open={confirmOpen}
        onClose={() => {
          if (confirmingDeploy) return;
          setConfirmOpen(false);
        }}
        onConfirm={onConfirmDeploy}
        confirming={confirmingDeploy}
        baseUri={normalizeBaseUri(baseUri)}
        baseUriWarning={baseUriWarning}
        name={name}
        symbol={symbol}
        description={description}
        totalSupply={Number(totalSupplyStr || 0)}
        royaltyRecipient={royaltyRecipient}
        royaltyPercent={Number(royaltyPercentStr || 0)}
        publicStartISO={fromLagosLocalYMDHM(publicStart)?.toISOString() ?? new Date().toISOString()}
        publicPriceEtn={publicPriceEtn}
        maxPerWallet={walletUnlimited ? Number(totalSupplyStr || 0) : Number(maxPerWalletStr || 0)}
        maxPerTx={Number(maxPerTxStr || 0)}
        enablePresale={enablePresale}
        presaleStartISO={enablePresale ? fromLagosLocalYMDHM(presaleStart)?.toISOString() ?? null : null}
        presaleEndISO={enablePresale ? fromLagosLocalYMDHM(presaleEnd)?.toISOString() ?? null : null}
        presalePriceEtn={enablePresale ? presalePriceEtn : ""}
        presaleSupply={enablePresale ? Number(presaleSupplyStr || 0) : 0}
        merkleRoot={enablePresale ? prepared?.merkleRoot ?? "" : ""}
        allowlistCount={enablePresale ? prepared?.count ?? allowState?.validChecksummed.length ?? 0 : 0}
        feeRecipient={fee?.feeRecipient ?? ""}
        feeAmountEtn={feeEtnDisplay}
        feeAmountUsdApprox={feeUsdApprox}
        feeLastUpdatedLabel={lastUpdatedStr}
        logoUrl={logoUrl}
        coverUrl={coverUrl}
      />
    </div>
  );
}