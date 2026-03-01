// components/create/single-erc721/SingleERC721Wizard.tsx
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react";
import { ethers } from "ethers";
import { toast } from "sonner";
import { Plus, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";
import { Textarea } from "@/src/ui/Textarea";
import { Label } from "@/src/ui/Label";
import { Container } from "@/src/ui/Container";
import { IconButton } from "@/src/ui/IconButton";
import { Badge } from "@/src/ui/Badge";

import { useLoaderStore } from "@/src/lib/store/loader-store";
import { cn, formatNumber, shortenAddress } from "@/src/lib/utils";

import { ensureChain, getBrowserSigner, getRequiredChainId } from "@/src/lib/chain/client";
import { prettyEthersError } from "@/src/lib/chain/errors";
import { NFT_FACTORY_ABI } from "@/src/lib/abis/NFTFactoryABI";

import { SuccessDialog } from "@/src/components/drop/SuccessDialog";
import SingleDeploySuccessModal from "./SingleDeploySuccessModal";

// ===== ENV & constants =====
const UPLOAD_BASE = process.env.NEXT_PUBLIC_UPLOAD_BASE ?? "";
const ACCEPT_MEDIA = ".png,.jpg,.jpeg,.gif,.webp,.avif,.svg,.mp4";
const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "";

// ===== helpers =====
function percentToBps(pct: number) {
  return Math.round(pct * 100);
}
function isVideoMime(m: string) {
  return (m || "").toLowerCase().startsWith("video/");
}
function toHttp(ipfsUri: string) {
  return ipfsUri?.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${ipfsUri.slice(7)}` : ipfsUri;
}
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
function friendlyRpcError(e: any): string {
  return (
    prettyEthersError(e) ||
    e?.data?.message ||
    e?.error?.data?.message ||
    e?.error?.message ||
    e?.shortMessage ||
    e?.reason ||
    e?.message ||
    "Transaction failed"
  );
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

/** Try hard to discover the implementation address from event or factory reads */
async function resolveImplementationAddress(
  factory: ethers.Contract,
  receipt: ethers.TransactionReceipt
): Promise<string> {
  // 1) Event path
  try {
    for (const log of receipt.logs ?? []) {
      try {
        const parsed = factory.interface.parseLog(log);
        if (parsed?.name === "ERC721SingleCloneCreated") {
          const candidates = [
            parsed.args?.implementation,
            parsed.args?.impl,
            parsed.args?.implementationAddr,
            parsed.args?.implementationAddress,
          ];
          for (const c of candidates) {
            const s = String(c ?? "");
            if (s && ethers.isAddress(s)) return ethers.getAddress(s);
          }
        }
      } catch {}
    }
  } catch {}

  // 2) Read fallbacks
  const methodCandidates = [
    "erc721SingleImplementation",
    "implementation721Single",
    "erc721Implementation",
    "erc721SingleImpl",
    "implementation",
    "getImplementation",
  ];
  for (const m of methodCandidates) {
    try {
      const fn = factory[m];
      if (typeof fn === "function") {
        const addr = await fn();
        if (addr && ethers.isAddress(addr)) return ethers.getAddress(String(addr));
      }
    } catch {}
  }
  return "";
}

// ===== types =====
type Step = 1 | 2 | 3;
type InitResponse = { jobId: string; token?: string | null };
type AssetPinRes = { cid: string; ipfsUri: string; gatewayUrl: string; mime?: string };
type MetaPinRes = { cid: string; ipfsUri: string; gatewayUrl: string };

export default function SingleERC721Wizard() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);

  // uploader session
  const sessionRef = React.useRef<{ jobId: string; token?: string } | null>(null);

  async function ensureSession(): Promise<{ jobId: string; token?: string }> {
    if (sessionRef.current?.jobId) return sessionRef.current;
    const res = await fetch("/api/uploads/init", { method: "POST", cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as InitResponse;
    if (!json?.jobId) throw new Error("Could not initialize upload session");
    sessionRef.current = { jobId: json.jobId, token: json.token ?? undefined };
    return sessionRef.current;
  }

  React.useEffect(() => {
    ensureSession().catch(() => {});
  }, []);

  // ===== Step 1: media =====
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const objectUrlRef = React.useRef<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);

  const [progress, setProgress] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const [assetCid, setAssetCid] = React.useState("");
  const [assetUri, setAssetUri] = React.useState("");
  const [assetPreview, setAssetPreview] = React.useState(""); // blob: then https://
  const [assetMime, setAssetMime] = React.useState("");

  const [showAssetModal, setShowAssetModal] = React.useState(false);

  // ===== Step 2: metadata =====
  const [name, setName] = React.useState("");
  const [symbol, setSymbol] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [royaltyPercent, setRoyaltyPercent] = React.useState(5);

  const [customFields, setCustomFields] = React.useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" },
  ]);
  const [attributes, setAttributes] = React.useState<Array<{ trait_type: string; value: string }>>([]);

  const [metaCid, setMetaCid] = React.useState("");
  const [tokenUri, setTokenUri] = React.useState("");
  const [metaPreview, setMetaPreview] = React.useState("");

  const [showMetaModal, setShowMetaModal] = React.useState(false);

  // ===== Step 3: deploy =====
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

  // ===== preview behavior =====
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

  // ===== upload helper =====
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
          const json = JSON.parse(xhr.responseText || "{}");
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

  // ===== step 1 handlers =====
  function handleChooseClick() {
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

  async function startAssetUpload() {
    try {
      if (!UPLOAD_BASE) throw new Error("NEXT_PUBLIC_UPLOAD_BASE not configured");
      if (!file) throw new Error("Select a file first");

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
      setAssetPreview(json.gatewayUrl);
      setAssetMime(json.mime || file.type || "");
      setShowAssetModal(true);
    } catch (e: any) {
      toast.error(e?.message || "Asset upload failed");
    } finally {
      setBusy(false);
    }
  }

  // ===== step 2 actions =====
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

  async function pinMetadata() {
    try {
      if (!UPLOAD_BASE) throw new Error("NEXT_PUBLIC_UPLOAD_BASE not configured");
      if (!assetUri) throw new Error("Upload media first");
      if (!name || !symbol) throw new Error("Name and symbol are required");
      if (royaltyPercent < 0 || royaltyPercent > 10) throw new Error("Royalties must be 0–10%");

      setBusy(true);
      setProgress(0);

      const { jobId } = await ensureSession();
      const headers: Record<string, string> = {
        "x-job-id": jobId,
        "Content-Type": "application/json",
      };
      if (sessionRef.current?.token) headers["Authorization"] = `Bearer ${sessionRef.current.token}`;

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

      const body = {
        name,
        description: description || undefined,
        imageUri: isVideoMime(assetMime) ? undefined : assetUri,
        animationUri: isVideoMime(assetMime) ? assetUri : undefined,
        attributes: attrs.length ? attrs : undefined,
        extra: Object.keys(extra).length ? extra : undefined,
      };

      const res = await fetch(`${UPLOAD_BASE}/single/build-json`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const j: MetaPinRes = await res.json();
      if (!res.ok) throw new Error((j as any)?.error || "Metadata pin failed");

      setMetaCid(j.cid);
      setTokenUri(j.ipfsUri);
      setMetaPreview(j.gatewayUrl);
      setShowMetaModal(true);
    } catch (e: any) {
      toast.error(e?.message || "Metadata pin failed");
    } finally {
      setBusy(false);
    }
  }

  // ===== fees =====
  async function fetchFees() {
    const res = await fetch("/api/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractType: "ERC721_SINGLE", metadataOption: "UPLOAD" }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Failed to fetch fee config");
    return {
      feeRecipient: j.feeRecipient as string,
      feeAmountWei: toPlainIntegerWeiString(String(j.feeAmountEtnWei ?? j.feeAmountWei)),
      targetUsdCents: typeof j.targetUsdCents === "number" ? j.targetUsdCents : undefined,
      lastPriceUsd: typeof j.lastPriceUsd === "string" ? j.lastPriceUsd : undefined,
    };
  }

  async function loadFees() {
    try {
      setFeeLoading(true);
      const f = await fetchFees();
      setFeeRecipient(f.feeRecipient);
      setFeeAmountWei(f.feeAmountWei);
      setTargetUsdCents(f.targetUsdCents);
      setLastPriceUsd(f.lastPriceUsd);
    } catch (e: any) {
      toast.error(e?.message || "Could not load fees");
    } finally {
      setFeeLoading(false);
    }
  }

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

  // ===== deploy =====
  async function deploy() {
    try {
      if (!FACTORY_ADDRESS) throw new Error("Factory address not set");
      if (!ethers.isAddress(FACTORY_ADDRESS)) throw new Error("Factory address is invalid");
      if (!tokenUri) throw new Error("tokenURI missing");
      if (!name || !symbol) throw new Error("Name & symbol required");

      const fresh = await fetchFees();
      const feeRecipientForTx = fresh.feeRecipient;
      const feeWeiPlain = toPlainIntegerWeiString(fresh.feeAmountWei);
      const feeBig = BigInt(feeWeiPlain || "0");

      if (!ethers.isAddress(feeRecipientForTx)) throw new Error("Fee recipient is invalid");
      if (feeBig <= BigInt(0)) throw new Error("Deployment fee is zero — refresh and try again");

      setDeploying(true);
      const required = getRequiredChainId();

      show("Connecting wallet…");
      await ensureChain(required);
      const signer = await getBrowserSigner();
      const from = await signer.getAddress();

      const balance = await signer.provider!.getBalance(from);
      if (balance < feeBig) {
        const need = Number(ethers.formatEther(feeBig)).toFixed(4);
        const have = Number(ethers.formatEther(balance)).toFixed(4);
        throw new Error(
          `Insufficient ETN for deployment fee. Need ${need} ETN (plus gas), you have ${have} ETN.`
        );
      }

      const royaltyRecipient = (royaltyRecipientAddr || from).trim();
      const royaltyBps = percentToBps(royaltyPercent);

      const factory = new ethers.Contract(FACTORY_ADDRESS, NFT_FACTORY_ABI, signer);
      const cfg = [name, symbol, tokenUri, feeRecipientForTx, feeWeiPlain, royaltyRecipient, royaltyBps, from];

      show("Simulating…");
      try {
        await factory.createERC721Single.staticCall(cfg, { value: feeBig });
      } catch (e: any) {
        hide();
        throw new Error(friendlyRpcError(e) || "Simulation failed");
      }

      show("Awaiting your wallet approval…");
      const tx = await factory.createERC721Single(cfg, { value: feeBig });

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
            if (parsed?.name === "ERC721SingleCloneCreated") {
              const addr = String(parsed.args?.cloneAddress ?? "");
              if (ethers.isAddress(addr)) {
                clone = ethers.getAddress(addr);
                break;
              }
            }
          } catch {}
        }
      } catch {}
      if (!clone) throw new Error("Could not detect collection address from events");

      const implAddr = await resolveImplementationAddress(factory, receipt);

      show("Finalizing on server…");
      const post = await fetch("/api/index/single-erc721", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract: clone,
          txHash: receipt.hash,
          implementationAddr: implAddr || "",
          factoryAddress: FACTORY_ADDRESS,
          deployerAddress: from,
          feeRecipient: feeRecipientForTx,
          feeAmountEtnWei: feeWeiPlain,
          royaltyRecipient,
          royaltyBps,
          tokenUri,
          name,
          symbol,
          description,
          imageUrl: toHttp(assetUri),
          creatorWalletAddress: from,
          ownerAddress: from,
          assetCid,
          jsonCid: metaCid,
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
      toast.error(friendlyRpcError(e) || "Deploy failed");
    } finally {
      setDeploying(false);
    }
  }

  // ===== step gating =====
  const canGoMeta = !!assetUri && !busy;
  const canGoDeploy = !!tokenUri && !busy;

  const steps = React.useMemo(
    () => [
      { id: 1 as const, label: "Upload" },
      { id: 2 as const, label: "Metadata" },
      { id: 3 as const, label: "Deploy" },
    ],
    []
  );

  return (
    <div className="w-full space-y-6">
      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-2",
                "bg-card shadow-sm",
                done ? "border-foreground/15" : "border-border",
                active ? "ring-2 ring-foreground/10" : ""
              )}
            >
              <Badge className={cn("px-2 py-1 text-xs", done ? "bg-foreground/10" : "bg-background")}>
                {s.id}
              </Badge>
              <span className={cn("text-sm font-medium", done || active ? "text-foreground" : "text-muted")}>
                {s.label}
              </span>
            </div>
          );
        })}

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
        <Container className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="p-5 sm:p-6 space-y-6">
            <div className="space-y-1">
              <div className="text-lg font-semibold tracking-tight">Upload media</div>
              <div className="text-sm text-muted">
                Accepted: {ACCEPT_MEDIA.split(",").join(", ")} • This becomes your NFT preview.
              </div>
            </div>

            <div className="h-px w-full bg-border" />

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
                  onClick={handleChooseClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleChooseClick();
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

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_MEDIA}
                  className="hidden"
                  onChange={onFileChange}
                />

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={handleChooseClick} disabled={busy}>
                    Change media
                  </Button>
                  <Button
                    className={cn("w-full sm:w-auto", busy ? "btn-shimmer" : "")}
                    onClick={startAssetUpload}
                    disabled={!file || busy}
                  >
                    {busy ? "Uploading…" : "Pin media to IPFS"}
                  </Button>
                </div>

                {/* Progress (theme-proof) */}
                <div className="space-y-2">
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-border bg-foreground/10">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-accent transition-[width] duration-200"
                      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted tabular-nums">
                    <span>{busy ? `${progress.toFixed(0)}%` : assetUri ? "Pinned" : "Ready"}</span>
                    <span>{file ? formatBytes(file.size) : ""}</span>
                  </div>
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
                    <div className="h-105 grid place-items-center text-sm text-muted">
                      Your preview appears here
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-muted">
                  Tip: Upload a sharp image (or a light MP4). Collectors zoom in.
                </div>
              </div>
            </div>

            <SuccessDialog
              open={showAssetModal}
              title="Media pinned"
              description="Copy the references for your records."
              items={[
                {
                  label: "Asset CID",
                  value: assetCid,
                  display: assetCid,
                  href: assetCid ? `https://ipfs.io/ipfs/${assetCid}` : undefined,
                },
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
        </Container>
      ) : null}

      {/* STEP 2 — Metadata */}
      {step === 2 ? (
        <Container className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="p-5 sm:p-6 space-y-6">
            <div className="space-y-1">
              <div className="text-lg font-semibold tracking-tight">Metadata</div>
              <div className="text-sm text-muted">
                Name, symbol, description, optional traits. We’ll pin a JSON that references your pinned media.
              </div>
            </div>

            <div className="h-px w-full bg-border" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Midnight Orchid" />
              </div>

              <div className="space-y-2">
                <Label>Symbol</Label>
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g. ORCHID" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell collectors what this piece is about…"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Royalties (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={royaltyPercent}
                  onChange={(e) => {
                    const n = Math.floor(+e.target.value || 0);
                    setRoyaltyPercent(Math.max(0, Math.min(10, n)));
                  }}
                />
                <p className="text-xs text-muted">0–10%</p>
              </div>
            </div>

            <div className="h-px w-full bg-border" />

            {/* Custom fields */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Custom Metadata Fields (Optional)</div>
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
                      <Input
                        placeholder="key (e.g. external_url)"
                        value={row.key}
                        onChange={(e) => setCustom(i, "key", e.target.value)}
                      />
                      <Input
                        placeholder="value"
                        value={row.value}
                        onChange={(e) => setCustom(i, "value", e.target.value)}
                      />
                      <IconButton
                        aria-label="Remove"
                        onClick={() => delCustom(i)}
                        className="h-11 w-11 rounded-2xl"
                      >
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
                <div className="text-sm font-medium">Attributes / Traits (Optional)</div>
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
                      <Input
                        placeholder="Trait"
                        value={row.trait_type}
                        onChange={(e) => setAttr(i, "trait_type", e.target.value)}
                      />
                      <Input
                        placeholder="Value"
                        value={row.value}
                        onChange={(e) => setAttr(i, "value", e.target.value)}
                      />
                      <IconButton
                        aria-label="Remove"
                        onClick={() => delAttr(i)}
                        className="h-11 w-11 rounded-2xl"
                      >
                        <Trash2 className="h-4 w-4 opacity-80" />
                      </IconButton>
                    </div>

                    <div className="mt-2 text-[11px] text-muted">
                      Example: Trait “Background” → Value “Neon City”
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px w-full bg-border" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">Pin metadata to IPFS</div>
                <div className="text-xs text-muted">
                  Generates your tokenURI JSON and links it to your pinned media.
                </div>
              </div>

              <Button
                className={cn("h-11 rounded-2xl px-5", busy ? "btn-shimmer" : "")}
                onClick={pinMetadata}
                disabled={!assetUri || busy || !name || !symbol}
              >
                {busy ? "Pinning…" : "Pin metadata"}
              </Button>
            </div>

            {tokenUri ? (
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="text-xs text-muted">tokenURI</div>
                <div className="mt-1 text-sm font-medium break-all">{tokenUri}</div>
              </div>
            ) : null}

            <SuccessDialog
              open={showMetaModal}
              title="Metadata pinned & validated"
              description="Copy your references. Continue to deployment."
              items={[
                { label: "Metadata CID", value: metaCid, display: metaCid, href: metaCid ? `https://ipfs.io/ipfs/${metaCid}` : undefined },
                { label: "tokenURI (ipfs)", value: tokenUri, display: tokenUri, href: tokenUri ? toHttp(tokenUri) : undefined },
                { label: "Preview", value: metaPreview, display: metaPreview, href: toHttp(metaPreview) },
              ]}
              proceedLabel="Proceed to Deploy"
              onProceed={() => {
                setShowMetaModal(false);
                setStep(3);
                loadFees();
              }}
            />
          </div>
        </Container>
      ) : null}

      {/* STEP 3 — Deploy */}
      {step === 3 ? (
        <Container className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="p-5 sm:p-6 space-y-6">
            <div className="space-y-1">
              <div className="text-lg font-semibold tracking-tight">Deploy</div>
              <div className="text-sm text-muted">
                You’ll sign a transaction that pays the one-time deployment fee and creates your ERC-721 Single contract.
              </div>
            </div>

            <div className="h-px w-full bg-border" />

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
                <span className="opacity-70">Raw:</span>{" "}
                <code className="break-all">{toPlainIntegerWeiString(feeAmountWei)} wei</code>
              </div>

              <div className="mt-4">
                <Button variant="outline" size="sm" className="h-9 rounded-full px-4" onClick={loadFees} disabled={feeLoading}>
                  Refresh fee
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Royalty recipient</Label>
              <Input
                placeholder="Leave blank to use the connected wallet"
                value={royaltyRecipientAddr}
                onChange={(e) => setRoyaltyRecipientAddr(e.target.value)}
              />
              <p className="text-xs text-muted">If set, this address receives royalties.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div className="text-xs text-muted">
                Deploying creates your contract. After confirmation, we index it and take you to the NFT page.
              </div>

              <Button
                className={cn("h-11 rounded-2xl px-6", deploying ? "btn-shimmer" : "")}
                onClick={deploy}
                disabled={deploying}
              >
                {deploying ? "Deploying…" : "Deploy Single"}
              </Button>
            </div>

            <SingleDeploySuccessModal
              open={deployOpen}
              name={name}
              mediaUrl={isVideoMime(assetMime) ? undefined : toHttp(assetUri)}
              contract={deployed.contract}
              txHash={deployed.tx}
              tokenId={1}
              onViewNft={() => {
                setDeployOpen(false);
                if (deployed.contract) window.location.href = `/collections/${deployed.contract}/1`;
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
        </Container>
      ) : null}
    </div>
  );
}