// components/create/single-erc1155/CreateSingleERC1155Form.tsx
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Revamped Single ERC-1155 (Fixed Supply Editions)
 * - Uses Panthart branded UI kit: src/ui/*
 * - Keeps upload session TTL + auto-expire logic
 * - Keeps pinning flow to /single1155/build-json
 * - Keeps deploy flow + indexing
 */

import * as React from "react";
import { ethers } from "ethers";
import { toast } from "sonner";
import { Plus, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";
import { Label } from "@/src/ui/Label";
import { Textarea } from "@/src/ui/Textarea";
import { IconButton } from "@/src/ui/IconButton";
import { cn, formatNumber, shortenAddress } from "@/src/lib/utils";
import { useLoaderStore } from "@/src/lib/store/loader-store";

import { ensureChain, getBrowserSigner, getRequiredChainId } from "@/src/lib/chain/client";
import { prettyEthersError } from "@/src/lib/chain/errors";
import { NFT_FACTORY_ABI } from "@/src/lib/abis/NFTFactoryABI";

import { SuccessDialog } from "@/src/components/drop/SuccessDialog";
import Single1155DeploySuccessModal from "./Single1155DeploySuccessModal";

// ===== ENV / constants =====
const UPLOAD_BASE = process.env.NEXT_PUBLIC_UPLOAD_BASE ?? "";
const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "";
const ACCEPT_MEDIA = ".png,.jpg,.jpeg,.gif,.webp,.avif,.svg,.mp4";

// Correct API route (plural)
const SESSION_INIT_PATH = "/api/uploads/init";
const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

// ===== types =====
type Step = 1 | 2 | 3;
type InitResponse = {
  jobId: string;
  token?: string | null;
  expiresIn?: number | null;
  expiresAt?: string | number | null;
  exp?: string | number | null;
  ttlSec?: number | null;
};

type AssetPinRes = { cid: string; ipfsUri: string; gatewayUrl: string; mime?: string };

type S1155BuildRes = {
  cid: string;
  baseUri: string;
  tokenUri: string;
  gatewayTokenUrl: string;
};

type SessionStatus = "initializing" | "active" | "expired" | "error";

// ===== helpers =====
function ensureHttps(u: string) {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u.replace(/^\/+/, "")}`;
}
function toHttp(ipfsUri: string) {
  return ipfsUri?.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${ipfsUri.slice(7)}` : ipfsUri;
}
function isVideoMime(m: string) {
  return (m || "").toLowerCase().startsWith("video/");
}
function clampInt(n: number, lo: number, hi: number) {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}
function ipfsCidFromUri(u: string) {
  if (!u?.startsWith("ipfs://")) return "";
  const rest = u.slice(7);
  return rest.split("/")[0] || "";
}
function isValidPriceStr(s: string) {
  if (s === "") return false;
  if (!/^\d*\.?\d*$/.test(s)) return false;
  if (Number.isNaN(Number(s))) return false;
  if (Number(s) < 0) return false;
  const [, frac] = s.split(".");
  if (frac && frac.length > 18) return false;
  return true;
}
function isPositiveIntStr(s: string) {
  if (!/^\d+$/.test(s)) return false;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1;
}
function parseExpiryFromInit(j: InitResponse): number {
  const now = Date.now();
  if (typeof j.expiresIn === "number" && j.expiresIn > 0) return now + j.expiresIn * 1000;
  if (j.expiresAt != null) {
    const v = j.expiresAt;
    if (typeof v === "string") {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    } else if (typeof v === "number") {
      return v < 1e12 ? v * 1000 : v;
    }
  }
  if (j.exp != null) {
    const v = j.exp;
    if (typeof v === "string") {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    } else if (typeof v === "number") {
      return v < 1e12 ? v * 1000 : v;
    }
  }
  if (j.ttlSec && j.ttlSec > 0) return now + j.ttlSec * 1000;
  return now + DEFAULT_SESSION_TTL_MS;
}
function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function shortError(e: any, fallback = "Something went wrong") {
  const raw = typeof e === "string" ? e : e?.message || e?.error || e?.toString?.() || fallback;
  if (!raw) return fallback;
  if (/<html/i.test(raw) || /<!DOCTYPE/i.test(raw)) return fallback;
  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
}

/** Expand scientific-notation into a plain integer decimal string for wei */
function toPlainIntegerWeiString(x?: string) {
  if (!x) return "";
  const s = String(x).trim();
  if (!s) return "";
  if (/^[+-]?\d+$/.test(s)) return s.replace(/^\+/, "");
  if (/^[+-]?\d+\.\d+$/.test(s)) return s.split(".")[0].replace(/^\+/, "");
  const m = s.match(/^([+-]?\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (m) {
    const sign = m[1].startsWith("-") ? "-" : "";
    const intPart = m[1].replace(/^[+-]/, "");
    const frac = m[2] || "";
    const exp = parseInt(m[3], 10);
    if (exp >= 0) {
      const digits = intPart + frac;
      const zeros = exp - frac.length;
      const body = zeros >= 0 ? digits + "0".repeat(zeros) : digits.slice(0, digits.length + zeros);
      return (sign ? "-" : "") + (body.replace(/^0+(?=\d)/, "") || "0");
    }
    return "0";
  }
  return s.replace(/[^\d-]/g, "");
}

function toEtnStringFromWei(wei?: string) {
  try {
    if (!wei) return "";
    const plain = toPlainIntegerWeiString(wei);
    if (!plain) return "";
    const asStr = ethers.formatEther(plain);
    const n = Number.parseFloat(asStr);
    if (!Number.isFinite(n)) return "";
    return formatNumber(Number(n.toFixed(2)));
  } catch {
    return "";
  }
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== UI helpers (brand-consistent) =====
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-border bg-card shadow-sm", className)}>
      {children}
    </div>
  );
}

function Divider({ className = "" }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

function StepPill({
  index,
  label,
  active,
  done,
}: {
  index: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-full border px-4 py-2",
        "min-h-11", // keeps pills same height across pages
        done ? "border-foreground/15 bg-foreground/5" : "border-border bg-background",
        active ? "ring-2 ring-foreground/10" : ""
      )}
    >
      <span
        className={cn(
          "flex-none grid place-items-center",          // ✅ never shrink
          "h-8 w-8 rounded-full border",              // ✅ hard size
          "text-xs font-semibold tabular-nums",       // ✅ stable numbers
          "leading-none select-none",                 // ✅ prevents vertical drift
          done ? "border-foreground/15 bg-foreground/10" : "border-border bg-card"
        )}
        aria-hidden="true"
      >
        {index}
      </span>

      <span
        className={cn(
          "text-sm font-medium leading-none", // ✅ match badge vertical rhythm
          done || active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function SessionChip({
  status,
  remainingSec,
  onRefresh,
}: {
  status: SessionStatus;
  remainingSec: number | null;
  onRefresh: () => void;
}) {
  if (status === "initializing") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs text-muted">
        Preparing upload session…
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs">
        <span className="text-muted">Upload session:</span>
        <span className="font-mono tabular-nums">{mmss(remainingSec ?? 0)}</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
      Session expired
      <Button variant="link" size="sm" className="h-auto py-0" onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  );
}

function ProgressBar({ value, active }: { value: number; active?: boolean }) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="space-y-2">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-border bg-foreground/10">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${v}%` }}
        />
        {active ? (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 45%, transparent 90%)",
              transform: "translateX(-60%)",
              animation: "panth_progress_sheen 1.2s ease-in-out infinite",
            }}
          />
        ) : null}
      </div>

      <style jsx>{`
        @keyframes panth_progress_sheen {
          0% {
            transform: translateX(-60%);
          }
          100% {
            transform: translateX(120%);
          }
        }
      `}</style>
    </div>
  );
}

// ===== component =====
export default function CreateSingleERC1155Form() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);

  // ── Upload session state ────────────────────────────────────────────────
  const sessionRef = React.useRef<{ jobId: string; token?: string; expiresAtMs: number } | null>(null);
  const [sessionStatus, setSessionStatus] = React.useState<SessionStatus>("initializing");
  const [sessionExpiresAtMs, setSessionExpiresAtMs] = React.useState<number | null>(null);
  const [nowMs, setNowMs] = React.useState<number>(Date.now());
  const expiredToastShownRef = React.useRef(false);

  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingSec =
    sessionExpiresAtMs != null ? Math.max(0, Math.floor((sessionExpiresAtMs - nowMs) / 1000)) : null;

  const isSessionActive =
    sessionStatus === "active" && !!sessionRef.current?.jobId && (remainingSec ?? 0) > 0;

  React.useEffect(() => {
    if (sessionStatus === "active" && (remainingSec ?? 0) <= 0 && sessionRef.current) {
      setSessionStatus("expired");
      if (!expiredToastShownRef.current) {
        expiredToastShownRef.current = true;
        toast.error("Upload session expired. Refresh to get a new token.");
      }
    }
  }, [sessionStatus, remainingSec]);

  async function ensureSession(): Promise<{ jobId: string; token?: string }> {
    if (sessionRef.current?.jobId && isSessionActive) {
      return { jobId: sessionRef.current.jobId, token: sessionRef.current.token };
    }
    try {
      setSessionStatus("initializing");
      const res = await fetch(SESSION_INIT_PATH, { method: "POST", cache: "no-store" });
      if (!res.ok) {
        let msg = "Could not start upload session.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      const j = (await res.json()) as InitResponse;
      if (!j?.jobId) throw new Error("Init did not return a job id.");
      const exp = parseExpiryFromInit(j);
      sessionRef.current = { jobId: j.jobId, token: j.token ?? undefined, expiresAtMs: exp };
      setSessionExpiresAtMs(exp);
      setSessionStatus("active");
      expiredToastShownRef.current = false;
      return { jobId: j.jobId, token: j.token ?? undefined };
    } catch (e: any) {
      setSessionStatus("error");
      throw new Error(shortError(e, "Could not start upload session."));
    }
  }

  async function refreshSession() {
    try {
      sessionRef.current = null;
      await ensureSession();
      toast.success("Upload session refreshed");
    } catch (e: any) {
      toast.error(shortError(e, "Refresh failed. Try hard refresh."));
    }
  }

  React.useEffect(() => {
    ensureSession().catch((e) => toast.error(shortError(e, "Uploader is unreachable right now.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 1: media upload ────────────────────────────────────────────────
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const objectUrlRef = React.useRef<string | null>(null);

  const [assetCid, setAssetCid] = React.useState("");
  const [assetUri, setAssetUri] = React.useState("");
  const [assetPreview, setAssetPreview] = React.useState("");
  const [assetMime, setAssetMime] = React.useState("");

  const [dragActive, setDragActive] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const [showAssetModal, setShowAssetModal] = React.useState(false);

  function setLocalPreview(f: File | null) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (!f) {
      setAssetPreview("");
      setAssetMime("");
      return;
    }
    const url = URL.createObjectURL(f);
    objectUrlRef.current = url;
    setAssetPreview(url);
    setAssetMime(f.type || "");
  }

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function pickFile() {
    if (!busy) fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setLocalPreview(f);
    setProgress(0);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (busy) return;
    const f = e.dataTransfer.files?.[0] || null;
    setFile(f);
    setLocalPreview(f);
    setProgress(0);
  }

  function xhrUpload(url: string, form: FormData, headers: Record<string, string>) {
    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);

      Object.entries(headers).forEach(([k, v]) => {
        if (v) xhr.setRequestHeader(k, v);
      });

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) setProgress((evt.loaded / evt.total) * 100);
      };

      xhr.onload = () => {
        try {
          const txt = xhr.responseText || "{}";
          const json = JSON.parse(txt);
          if (xhr.status >= 200 && xhr.status < 300) resolve(json);
          else reject(new Error(json?.error || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error("Bad response from upload server"));
        }
      };

      xhr.onerror = () => reject(new Error("Network error"));
      xhr.ontimeout = () => reject(new Error("Upload timed out"));
      xhr.timeout = 1000 * 60 * 30;
      xhr.send(form);
    });
  }

  async function uploadAsset() {
    try {
      if (!UPLOAD_BASE) throw new Error("Uploads service not configured.");
      if (!file) throw new Error("Select a file first.");
      if (!isSessionActive) throw new Error("Upload session expired. Refresh the session and try again.");

      setBusy(true);
      setProgress(0);

      const { jobId, token } = await ensureSession();

      const form = new FormData();
      form.append("kind", "single-asset");
      form.append("file", file);

      const headers: Record<string, string> = { "x-job-id": jobId };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const json: AssetPinRes = await xhrUpload(`${UPLOAD_BASE}/single/upload/asset`, form, headers);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      setAssetCid(json.cid);
      setAssetUri(json.ipfsUri);
      setAssetPreview(ensureHttps(json.gatewayUrl));
      setAssetMime(json.mime || file.type || "");

      setShowAssetModal(true);
    } catch (e: any) {
      toast.error(shortError(e, "Asset upload failed."));
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: metadata/config ─────────────────────────────────────────────
  const [name, setName] = React.useState("");
  const [symbol, setSymbol] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [maxSupply, setMaxSupply] = React.useState<string>("100");
  const [mintPriceEtn, setMintPriceEtn] = React.useState<string>("0.01");
  const [maxPerWallet, setMaxPerWallet] = React.useState<string>("1");
  const [royaltyPct, setRoyaltyPct] = React.useState<number>(5);

  const [customFields, setCustomFields] = React.useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" },
  ]);
  const [attributes, setAttributes] = React.useState<Array<{ trait_type: string; value: string }>>([]);

  const [touchedName, setTouchedName] = React.useState(false);
  const [touchedSymbol, setTouchedSymbol] = React.useState(false);

  const [showMetaModal, setShowMetaModal] = React.useState(false);

  const [baseUri, setBaseUri] = React.useState("");
  const [tokenUri, setTokenUri] = React.useState("");
  const [tokenPreview, setTokenPreview] = React.useState("");

  const step2Errors = React.useMemo(() => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Contract name is required.";
    if (!symbol.trim()) errs.symbol = "Symbol is required.";
    if (!isPositiveIntStr(maxSupply)) errs.maxSupply = "Enter a whole number ≥ 1.";
    if (!isValidPriceStr(mintPriceEtn)) errs.mintPriceEtn = "Enter a valid non-negative price (up to 18 decimals).";
    if (!isPositiveIntStr(maxPerWallet)) {
      errs.maxPerWallet = "Enter a whole number ≥ 1.";
    } else if (isPositiveIntStr(maxSupply)) {
      const mpw = Number(maxPerWallet);
      const ms = Number(maxSupply);
      if (mpw > ms) errs.maxPerWallet = "Max per wallet cannot be greater than max supply.";
    }
    if (!(royaltyPct >= 0 && royaltyPct <= 10)) errs.royaltyPct = "Royalties must be between 0% and 10%.";
    if (!assetUri) errs.asset = "Upload media before generating metadata.";
    return errs;
  }, [name, symbol, maxSupply, mintPriceEtn, maxPerWallet, royaltyPct, assetUri]);

  const isStep2Valid = Object.keys(step2Errors).length === 0;

  function addCustom() {
    setCustomFields((a) => [...a, { key: "", value: "" }]);
  }
  function setCustom(i: number, key: "key" | "value", v: string) {
    setCustomFields((a) => a.map((row, idx) => (idx === i ? { ...row, [key]: v } : row)));
  }
  function delCustom(i: number) {
    setCustomFields((a) => a.filter((_, idx) => idx !== i));
  }

  function addAttr() {
    setAttributes((a) => [...a, { trait_type: "", value: "" }]);
  }
  function setAttr(i: number, key: "trait_type" | "value", v: string) {
    setAttributes((a) => a.map((row, idx) => (idx === i ? { ...row, [key]: v } : row)));
  }
  function delAttr(i: number) {
    setAttributes((a) => a.filter((_, idx) => idx !== i));
  }

  async function pinS1155Json() {
    try {
      if (!isStep2Valid) {
        toast.error("Please fix the highlighted fields.");
        return;
      }
      if (!UPLOAD_BASE) throw new Error("Uploads service not configured.");

      const ms = clampInt(parseInt(maxSupply || "0", 10), 1, 10_000_000);
      const mpWei = ethers.parseEther((mintPriceEtn || "0") as `${number}`);
      const mpw = clampInt(parseInt(maxPerWallet || "1", 10), 1, ms);

      setMaxSupply(String(ms));
      setMintPriceEtn(ethers.formatEther(mpWei));
      setMaxPerWallet(String(mpw));

      const extra: Record<string, any> = {};
      for (const row of customFields) {
        const k = (row.key || "").trim();
        if (!k) continue;
        if (["name", "description", "image", "animation_url", "attributes"].includes(k)) continue;
        extra[k] = row.value;
      }

      const attrs =
        attributes
          .filter((r) => r.trait_type || r.value)
          .map((r) => ({ trait_type: r.trait_type, value: r.value })) || [];

      const { jobId } = await ensureSession();
      const headers: Record<string, string> = {
        "x-job-id": jobId,
        "Content-Type": "application/json",
      };
      if (sessionRef.current?.token) headers["Authorization"] = `Bearer ${sessionRef.current.token}`;

      const res = await fetch(`${UPLOAD_BASE}/single1155/build-json`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          description: description || undefined,
          imageUri: isVideoMime(assetMime) ? undefined : assetUri,
          animationUri: isVideoMime(assetMime) ? assetUri : undefined,
          attributes: attrs.length ? attrs : undefined,
          extra: Object.keys(extra).length ? extra : undefined,
        }),
      });

      const j: S1155BuildRes = await res.json();
      if (!res.ok) throw new Error((j as any)?.error || "Pin failed.");

      setBaseUri(j.baseUri);
      setTokenUri(j.tokenUri);
      setTokenPreview(ensureHttps(j.gatewayTokenUrl));
      setShowMetaModal(true);
    } catch (e: any) {
      toast.error(shortError(e, "Pinning failed."));
    }
  }

  // ── Step 3: fees & deploy ───────────────────────────────────────────────
  const [feeRecipient, setFeeRecipient] = React.useState("");
  const [feeAmountWei, setFeeAmountWei] = React.useState("0");
  const [targetUsdCents, setTargetUsdCents] = React.useState<number | undefined>(undefined);
  const [lastPriceUsd, setLastPriceUsd] = React.useState<string | undefined>(undefined);
  const [feeLoading, setFeeLoading] = React.useState(false);

  const [royaltyRecipientAddr, setRoyaltyRecipientAddr] = React.useState("");
  const [deploying, setDeploying] = React.useState(false);
  const [deployOpen, setDeployOpen] = React.useState(false);
  const [deployed, setDeployed] = React.useState<{ contract: string; tx: string }>({ contract: "", tx: "" });

  const { show, hide } = useLoaderStore();

  async function loadFees() {
    try {
      setFeeLoading(true);
      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractType: "ERC1155_SINGLE", metadataOption: "UPLOAD" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to fetch fee config");
      setFeeRecipient(j.feeRecipient);
      setFeeAmountWei(toPlainIntegerWeiString(String(j.feeAmountEtnWei ?? j.feeAmountWei)));
      setTargetUsdCents(typeof j.targetUsdCents === "number" ? j.targetUsdCents : undefined);
      setLastPriceUsd(typeof j.lastPriceUsd === "string" ? j.lastPriceUsd : undefined);
    } catch (e: any) {
      toast.error(shortError(e, "Could not load fees."));
    } finally {
      setFeeLoading(false);
    }
  }

  const step3Errors = React.useMemo(() => {
    const errs: Record<string, string> = {};
    if (!royaltyRecipientAddr.trim()) {
      errs.royaltyRecipientAddr = "Royalty recipient is required.";
    } else if (!ethers.isAddress(royaltyRecipientAddr.trim())) {
      errs.royaltyRecipientAddr = "Enter a valid wallet address.";
    }
    if (!feeRecipient || !feeAmountWei || toPlainIntegerWeiString(feeAmountWei) === "0") {
      errs.fee = "Deployment fee not loaded yet.";
    }
    if (!baseUri) errs.baseUri = "Pin metadata first.";
    if (!name || !symbol) errs.identity = "Name & symbol are required.";
    return errs;
  }, [royaltyRecipientAddr, feeRecipient, feeAmountWei, baseUri, name, symbol]);

  const canDeploy = Object.keys(step3Errors).length === 0 && !deploying && !!FACTORY_ADDRESS;

  const feeHuman = React.useMemo(() => toEtnStringFromWei(feeAmountWei), [feeAmountWei]);

  const usdLine = React.useMemo(() => {
    if (typeof targetUsdCents === "number" && targetUsdCents > 0) {
      const dollars = (targetUsdCents / 100).toFixed(2);
      return `You’re paying $${dollars} worth of ETN.`;
    }
    if (lastPriceUsd && feeAmountWei) {
      const etn = parseFloat(ethers.formatEther(toPlainIntegerWeiString(feeAmountWei)));
      const px = parseFloat(lastPriceUsd);
      if (Number.isFinite(etn) && Number.isFinite(px) && px > 0) {
        const dollars = (etn * px).toFixed(2);
        return `You’re paying ~$${dollars} worth of ETN.`;
      }
    }
    return "";
  }, [targetUsdCents, lastPriceUsd, feeAmountWei]);

  async function deploy() {
    try {
      if (!FACTORY_ADDRESS) throw new Error("Factory address not set");
      if (!baseUri) throw new Error("baseURI missing — pin 1.json first");
      if (!name || !symbol) throw new Error("Name & symbol required");
      if (!ethers.isAddress(royaltyRecipientAddr)) throw new Error("Enter a valid royalty recipient");

      const ms = clampInt(parseInt(maxSupply || "0", 10), 1, 10_000_000);
      const mpw = clampInt(parseInt(maxPerWallet || "1", 10), 1, ms);
      const mpWei = ethers.parseEther((mintPriceEtn || "0") as `${number}`);
      const royaltyBps = Math.round(clampInt(royaltyPct, 0, 10) * 100);

      setDeploying(true);
      const required = getRequiredChainId();

      show("Connecting wallet…");
      await ensureChain(required);
      const signer = await getBrowserSigner();
      const from = await signer.getAddress();

      const royaltyRecipient = royaltyRecipientAddr.trim();
      const feeWei = BigInt(toPlainIntegerWeiString(feeAmountWei));

      const factory = new ethers.Contract(FACTORY_ADDRESS, NFT_FACTORY_ABI, signer);
      const cfg = {
        name,
        symbol,
        baseURI: baseUri,
        maxSupply: BigInt(ms),
        mintPrice: BigInt(mpWei.toString()),
        maxPerWallet: BigInt(mpw),
        feeRecipient,
        feeAmount: feeWei,
        royaltyRecipient,
        royaltyBps,
        initialOwner: from,
      };

      show("Simulating…");
      try {
        await factory.createERC1155Drop.staticCall(cfg, { value: feeWei });
      } catch (e: any) {
        hide();
        throw new Error(prettyEthersError(e) || "Simulation failed");
      }

      show("Awaiting your wallet approval…");
      const tx = await factory.createERC1155Drop(cfg, { value: feeWei });

      show("Transaction submitted. Waiting for confirmation…");
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        hide();
        throw new Error("Deployment failed on-chain");
      }

      let clone = "";
      try {
        const iface = factory.interface;
        for (const log of receipt.logs ?? []) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === "ERC1155DropCloneCreated") {
              const addr = String(parsed.args?.cloneAddress ?? "");
              if (ethers.isAddress(addr)) {
                clone = ethers.getAddress(addr);
                break;
              }
            }
          } catch {}
        }
      } catch {}

      if (!clone) throw new Error("Could not detect contract address from events");

      show("Finalizing on server…");
      const jsonCid = ipfsCidFromUri(tokenUri);

      const post = await fetch("/api/index/single-erc1155", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: receipt.hash,
          blockNumber: Number(receipt.blockNumber || 0),
          contract: clone,
          implementationAddr: "",
          factoryAddress: FACTORY_ADDRESS,
          deployerAddress: from,

          feeRecipient,
          feeAmountEtnWei: toPlainIntegerWeiString(feeAmountWei),

          royaltyRecipient,
          royaltyBps,

          name,
          symbol,
          baseUri,
          maxSupply: ms,
          mintPriceEtnWei: mpWei.toString(),
          maxPerWallet: mpw,

          creatorWalletAddress: from,
          ownerAddress: from,

          description,
          imageUrl: !isVideoMime(assetMime) ? assetPreview : undefined,

          assetCid,
          jsonCid,
          uploaderUserId: null,
        }),
      });

      const pj = await post.json();
      if (!post.ok) {
        hide();
        throw new Error(pj?.error || "Indexing failed");
      }

      hide();
      setDeployed({ contract: clone, tx: receipt.hash });
      setDeployOpen(true);
    } catch (e: any) {
      hide();
      toast.error(shortError(e, "Deploy failed."));
    } finally {
      setDeploying(false);
    }
  }

  // ===== step gating =====
  const canGoMeta = !!assetUri && !busy;
  const canGoDeploy = !!baseUri && !busy;

  return (
    <div className="w-full space-y-6">
      {/* Stepper */}
    <div className="flex flex-wrap items-center gap-3">
  <StepPill index={1} label="Upload" active={step === 1} done={step > 1} />
  <StepPill index={2} label="Metadata" active={step === 2} done={step > 2} />
  <StepPill index={3} label="Deploy" active={step === 3} done={false} />

        <div className="ml-auto flex items-center gap-2">
          {step > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-full px-4"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            >
              Previous
            </Button>
          ) : null}

          {step < 3 ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-4"
              onClick={() => {
                if (step === 1) {
                  if (!canGoMeta) return toast.error("Upload and pin your media first.");
                  setStep(2);
                } else if (step === 2) {
                  if (!canGoDeploy) return toast.error("Pin metadata first.");
                  setStep(3);
                  loadFees();
                }
              }}
              disabled={(step === 1 && !canGoMeta) || (step === 2 && !canGoDeploy) || busy}
            >
              Next
            </Button>
          ) : null}
        </div>
      </div>

      {/* STEP 1 — Upload */}
      {step === 1 ? (
        <Panel>
          <div className="p-5 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="text-lg font-semibold tracking-tight">Upload media</div>
                <div className="text-sm text-muted">
                  Accepted: {ACCEPT_MEDIA.split(",").join(", ")} • Keep it crisp — this becomes your edition preview.
                </div>
              </div>

              <SessionChip status={sessionStatus} remainingSec={remainingSec} onRefresh={refreshSession} />
            </div>

            {(sessionStatus === "expired" || sessionStatus === "error") ? (
              <div className="text-xs text-red-500">
                Your temporary upload token expired. Refresh the session, then upload again.
              </div>
            ) : null}

            <Divider />

            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
              {/* Left controls */}
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!busy) setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={onDrop}
                  onClick={pickFile}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") pickFile();
                  }}
                  className={cn(
                    "rounded-3xl border border-dashed p-5 transition",
                    "bg-background/40 shadow-sm",
                    busy
                      ? "opacity-70 cursor-not-allowed"
                      : "cursor-pointer hover:bg-background/60 hover:shadow-md active:scale-[0.998]",
                    dragActive ? "border-foreground/25 ring-2 ring-foreground/10" : "border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl border border-border bg-card flex items-center justify-center">
                      <UploadCloud className="h-5 w-5 opacity-80" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">Drag & drop your media</div>
                      <div className="text-xs text-muted">
                        or <span className="underline underline-offset-2">click to select</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-muted">
                    {file ? (
                      <span className="truncate block">
                        Selected: <span className="font-mono text-foreground/90">{file.name}</span> •{" "}
                        {formatBytes(file.size)}
                      </span>
                    ) : (
                      <span>No file selected</span>
                    )}
                  </div>
                </div>

                <input ref={fileInputRef} type="file" accept={ACCEPT_MEDIA} className="hidden" onChange={onFileChange} />

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={pickFile} disabled={busy}>
                    Change media
                  </Button>
                  <Button
                    className={cn("w-full sm:w-auto", busy ? "btn-shimmer" : "")}
                    onClick={uploadAsset}
                    disabled={!file || busy || !isSessionActive}
                  >
                    {busy ? "Uploading…" : "Pin media to IPFS"}
                  </Button>
                </div>

                <ProgressBar value={progress} active={busy} />
                <div className="flex items-center justify-between text-xs text-muted tabular-nums">
                  <span>{busy ? `${progress.toFixed(0)}%` : assetUri ? "Pinned" : "Ready"}</span>
                  <span>{file ? formatBytes(file.size) : ""}</span>
                </div>

                {assetUri ? (
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <div className="text-xs text-muted">Pinned media</div>
                    <div className="mt-1 text-sm font-medium break-all">{assetUri}</div>
                  </div>
                ) : null}
              </div>

              {/* Right preview */}
              <div className="rounded-3xl border border-border bg-background/30 p-3">
                <div className="rounded-2xl bg-card overflow-hidden">
                  {assetPreview ? (
                    isVideoMime(assetMime) ? (
                      <video src={assetPreview} controls className="w-full h-105 object-contain" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetPreview} alt="preview" className="w-full h-105 object-contain" />
                    )
                  ) : (
                    <div className="h-105 grid place-items-center text-sm text-muted">Your preview appears here</div>
                  )}
                </div>

                <div className="mt-3 text-xs text-muted">
                  Tip: For editions, keep your image sharp. People compare variants.
                </div>
              </div>
            </div>

            <SuccessDialog
              open={showAssetModal}
              title="Media pinned"
              description="Copy the references for your records."
              items={[
                { label: "Asset CID", value: assetCid, display: assetCid, href: assetCid ? `https://ipfs.io/ipfs/${assetCid}` : undefined },
                { label: "ipfs://", value: assetUri, display: assetUri, href: assetUri ? toHttp(assetUri) : undefined },
                { label: "Preview", value: assetPreview, display: assetPreview, href: assetPreview || undefined },
              ]}
              proceedLabel="Proceed to Metadata"
              onProceed={() => {
                setShowAssetModal(false);
                setStep(2);
              }}
            />
          </div>
        </Panel>
      ) : null}

      {/* STEP 2 — Metadata */}
      {step === 2 ? (
        <Panel>
          <div className="p-5 sm:p-6 space-y-6">
            <div className="space-y-1">
              <div className="text-lg font-semibold tracking-tight">Metadata & Editions</div>
              <div className="text-sm text-muted">
                We’ll build <code className="px-1 py-0.5 rounded-md border border-border bg-background">1.json</code> and pin a folder so your{" "}
                <code className="px-1 py-0.5 rounded-md border border-border bg-background">baseURI</code> stays stable.
              </div>
            </div>

            <Divider />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setTouchedName(true)}
                  placeholder="e.g., My Editions"
                />
                {touchedName && !!step2Errors.name ? <p className="text-xs text-red-500">{step2Errors.name}</p> : null}
              </div>

              <div className="space-y-2">
                <Label>Symbol</Label>
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  onFocus={() => setTouchedSymbol(true)}
                  placeholder="e.g., MYED"
                />
                {touchedSymbol && !!step2Errors.symbol ? <p className="text-xs text-red-500">{step2Errors.symbol}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="(Optional) A short description for marketplaces."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Max Supply</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={maxSupply}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return setMaxSupply("");
                    setMaxSupply(raw.replace(/[^\d]/g, ""));
                  }}
                  onBlur={() => {
                    if (!isPositiveIntStr(maxSupply)) setMaxSupply("1");
                    if (isPositiveIntStr(maxPerWallet) && isPositiveIntStr(maxSupply)) {
                      const mpw = Number(maxPerWallet);
                      const ms = Number(maxSupply);
                      if (mpw > ms) setMaxPerWallet(String(ms));
                    }
                  }}
                  placeholder="100"
                />
                {step2Errors.maxSupply ? <p className="text-xs text-red-500">{step2Errors.maxSupply}</p> : null}
              </div>

              <div className="space-y-2">
                <Label>Mint Price (ETN)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={mintPriceEtn}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") return setMintPriceEtn("");
                    if (/^\d*\.?\d*$/.test(v)) setMintPriceEtn(v);
                  }}
                  onBlur={() => {
                    if (!isValidPriceStr(mintPriceEtn)) setMintPriceEtn("0");
                  }}
                  placeholder="0.01"
                />
                <p className="text-xs text-muted">Buyers pay this to mint each edition.</p>
                {step2Errors.mintPriceEtn ? <p className="text-xs text-red-500">{step2Errors.mintPriceEtn}</p> : null}
              </div>

              <div className="space-y-2">
                <Label>Max Per Wallet</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  max={isPositiveIntStr(maxSupply) ? Number(maxSupply) : undefined}
                  value={maxPerWallet}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return setMaxPerWallet("");
                    setMaxPerWallet(raw.replace(/[^\d]/g, ""));
                  }}
                  onBlur={() => {
                    if (!isPositiveIntStr(maxPerWallet)) setMaxPerWallet("1");
                    if (isPositiveIntStr(maxPerWallet) && isPositiveIntStr(maxSupply)) {
                      const mpw = Number(maxPerWallet);
                      const ms = Number(maxSupply);
                      if (mpw > ms) setMaxPerWallet(String(ms));
                    }
                  }}
                  placeholder="1"
                />
                {step2Errors.maxPerWallet ? <p className="text-xs text-red-500">{step2Errors.maxPerWallet}</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Royalties (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  value={royaltyPct}
                  onChange={(e) => setRoyaltyPct(clampInt(+e.target.value, 0, 10))}
                />
                <p className="text-xs text-muted">0–10%</p>
                {step2Errors.royaltyPct ? <p className="text-xs text-red-500">{step2Errors.royaltyPct}</p> : null}
              </div>
            </div>

            <Divider className="my-1" />

            {/* Custom fields */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Custom metadata fields (optional)</div>
                <Button size="sm" variant="outline" className="h-9 rounded-full px-4" onClick={addCustom}>
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add field
                  </span>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customFields.map((row, i) => (
                  <div key={`cf-${i}`} className="rounded-3xl border border-border bg-background/30 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                      <Input placeholder="key (e.g. external_url)" value={row.key} onChange={(e) => setCustom(i, "key", e.target.value)} />
                      <Input placeholder="value" value={row.value} onChange={(e) => setCustom(i, "value", e.target.value)} />
                      <IconButton aria-label="Remove" onClick={() => delCustom(i)} className="h-11 w-11 rounded-2xl">
                        <Trash2 className="h-4 w-4 opacity-80" />
                      </IconButton>
                    </div>
                    <div className="mt-2 text-[11px] text-muted">
                      Reserved keys are blocked: name, description, image, animation_url, attributes
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attributes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Attributes / Traits (optional)</div>
                <Button size="sm" variant="outline" className="h-9 rounded-full px-4" onClick={addAttr}>
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add trait
                  </span>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {attributes.map((row, i) => (
                  <div key={`attr-${i}`} className="rounded-3xl border border-border bg-background/30 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                      <Input placeholder="Trait" value={row.trait_type} onChange={(e) => setAttr(i, "trait_type", e.target.value)} />
                      <Input placeholder="Value" value={row.value} onChange={(e) => setAttr(i, "value", e.target.value)} />
                      <IconButton aria-label="Remove" onClick={() => delAttr(i)} className="h-11 w-11 rounded-2xl">
                        <Trash2 className="h-4 w-4 opacity-80" />
                      </IconButton>
                    </div>
                    <div className="mt-2 text-[11px] text-muted">Example: Trait “Background” → Value “Neon City”</div>
                  </div>
                ))}
              </div>
            </div>

            <Divider />

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">Build 1.json & pin folder</div>
                <div className="text-xs text-muted">
                  This creates your <span className="font-mono">tokenURI</span> + <span className="font-mono">baseURI</span> for the ERC-1155.
                </div>
              </div>

              <Button className={cn("h-11 rounded-2xl px-5")} onClick={pinS1155Json} disabled={!isStep2Valid}>
                {isStep2Valid ? "Pin metadata" : "Fix fields to continue"}
              </Button>
            </div>

            {tokenPreview ? (
              <div className="text-xs">
                <a className="underline text-muted hover:text-foreground transition" href={tokenPreview} target="_blank" rel="noreferrer">
                  Open pinned preview
                </a>
              </div>
            ) : null}

            <SuccessDialog
              open={showMetaModal}
              title="Metadata pinned & validated"
              description="Copy your references. Continue to deployment."
              items={[
                { label: "Folder CID", value: ipfsCidFromUri(baseUri), display: ipfsCidFromUri(baseUri), href: baseUri ? toHttp(baseUri) : undefined },
                { label: "tokenURI (ipfs)", value: tokenUri, display: tokenUri, href: tokenUri ? toHttp(tokenUri) : undefined },
                { label: "Preview", value: tokenPreview, display: tokenPreview, href: tokenPreview || undefined },
              ]}
              proceedLabel="Proceed to Deploy"
              onProceed={() => {
                setShowMetaModal(false);
                setStep(3);
                loadFees();
              }}
            />
          </div>
        </Panel>
      ) : null}

      {/* STEP 3 — Deploy */}
      {step === 3 ? (
        <Panel>
          <div className="p-5 sm:p-6 space-y-6">
            <div className="space-y-1">
              <div className="text-lg font-semibold tracking-tight">Deploy</div>
              <div className="text-sm text-muted">
                You’ll sign a transaction that pays the one-time deployment fee and deploys your ERC-1155 editions contract.
              </div>
            </div>

            <Divider />

            <div className="rounded-3xl border border-border bg-background/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-muted">Deployment fee</div>
                  <div
                    className="mt-1 text-2xl font-semibold tracking-tight"
                    title={`${ethers.formatEther(toPlainIntegerWeiString(feeAmountWei))} ETN`}
                  >
                    {feeLoading ? "Loading…" : feeHuman ? `${feeHuman} ETN` : "—"}
                  </div>
                  {usdLine ? <div className="mt-1 text-xs text-muted">{usdLine}</div> : null}
                </div>

                <div className="text-right">
                  <div className="text-xs text-muted">Recipient</div>
                  <div className="mt-1 text-sm font-medium">
                    <code className="rounded-md border border-border bg-card px-2 py-1">
                      {feeRecipient ? shortenAddress(feeRecipient, 6, 4) : "—"}
                    </code>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-muted">
                <span className="opacity-70">Raw:</span> <code className="break-all">{toPlainIntegerWeiString(feeAmountWei)} wei</code>
              </div>

              <div className="mt-4">
                <Button variant="outline" size="sm" className="h-9 rounded-full px-4" onClick={loadFees} disabled={feeLoading}>
                  Refresh fee
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Royalty recipient *</Label>
              <Input
                placeholder="0x… (must be a valid wallet)"
                value={royaltyRecipientAddr}
                onChange={(e) => setRoyaltyRecipientAddr(e.target.value)}
              />
              {step3Errors.royaltyRecipientAddr ? (
                <p className="text-xs text-red-500">{step3Errors.royaltyRecipientAddr}</p>
              ) : (
                <p className="text-xs text-muted">This address receives royalties for secondary sales.</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div className="text-xs text-muted">
                After confirmation, we index the contract and take you to the mint page.
              </div>

              <Button
                className={cn("h-11 rounded-2xl px-6", deploying ? "btn-shimmer" : "")}
                onClick={deploy}
                disabled={!canDeploy}
                loading={deploying}
              >
                {deploying ? "Deploying…" : "Deploy ERC-1155 Single"}
              </Button>
            </div>

            {step3Errors.fee || step3Errors.baseUri || step3Errors.identity ? (
              <div className="text-xs text-muted">
                {step3Errors.fee ? `• ${step3Errors.fee}` : null}
                {step3Errors.baseUri ? <div>• {step3Errors.baseUri}</div> : null}
                {step3Errors.identity ? <div>• {step3Errors.identity}</div> : null}
              </div>
            ) : null}

            <Single1155DeploySuccessModal
              open={deployOpen}
              name={name}
              mediaUrl={!isVideoMime(assetMime) ? assetPreview : undefined}
              contract={deployed.contract}
              txHash={deployed.tx}
              tokenId={1}
              onViewNft={() => {
                setDeployOpen(false);
                if (deployed.contract) window.location.href = `/minting-now/erc1155/${deployed.contract}`;
              }}
              onOpenContract={() => {
                const url = `https://blockexplorer.electroneum.com/address/${deployed.contract}`;
                window.open(url, "_blank", "noopener,noreferrer");
                setDeployOpen(false);
                router.replace("/");
              }}
              onClose={() => {
                setDeployOpen(false);
                router.replace("/");
              }}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}