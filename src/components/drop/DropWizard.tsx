/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoveRight, UploadCloud, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { ethers } from "ethers";

import { Button } from "@/src/ui/Button";
import { useLoaderStore } from "@/src/lib/store/loader-store";

import ConfigForm from "../form-config";
import { SuccessDialog } from "./SuccessDialog";
import DeploySuccessModal from "./DeploySuccessModal";

import {
  ensureChain,
  getFactoryAddress,
  getRequiredChainId,
  percentToBps,
} from "@/src/lib/chain/client";
import { NFT_FACTORY_ABI } from "@/src/lib/abis/NFTFactoryABI";
import { prettyEthersError } from "@/src/lib/chain/errors";
import { getBrowserSigner } from "@/src/lib/chain/client";

/**
 * ENV (frontend)
 * NEXT_PUBLIC_UPLOAD_BASE is the uploader VM origin, e.g. https://ops.panth.art (no trailing slash)
 */
const UPLOAD_BASE = process.env.NEXT_PUBLIC_UPLOAD_BASE ?? "";
const MAX_ASSETS_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_METADATA_BYTES = 385 * 1024 * 1024; // 385MB

type Mode = "upload" | "external";
type Step = 0 | 1 | 2 | 3;

type InitResponse = {
  jobId: string;
  token?: string;
  expiresIn?: number | null;
};

type DeploySuccessInfo = {
  name: string;
  logoUrl?: string;
  contract: string;
  txHash?: string;
};

type UploadResult = { cid: string; baseUri?: string; itemCount?: number } | null;

/** Guard to ensure strings passed as addresses are 0x… hex, and normalize checksum. */
function assertHexAddress(label: string, value: string) {
  if (!ethers.isAddress(value)) {
    throw new Error(`${label} must be a 0x address (ENS not supported on this network).`);
  }
  return ethers.getAddress(value);
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

/** Tiny progress bar (always visible in any theme). */
function ProgressBar({ value, active }: { value: number; active?: boolean }) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-border bg-foreground/10">
      {/* fill */}
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-emerald-500 transition-[width] duration-200"
        style={{ width: `${v}%` }}
      />

      {/* subtle sheen while uploading */}
      {active ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 45%, transparent 90%)",
            transform: "translateX(-60%)",
            animation: "panth_progress_sheen 1.2s ease-in-out infinite",
          }}
        />
      ) : null}

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
/** Premium panel wrapper (replaces shadcn Card). */
function Panel({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={[
        "rounded-3xl border border-border bg-card",
        "shadow-sm",
        clickable
          ? "cursor-pointer transition hover:bg-background/60 hover:shadow-md active:scale-[0.998]"
          : "",
        className,
      ].join(" ")}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

function StepLabel({ step }: { step: Step }) {
  if (step === 1) return "Upload Assets";
  if (step === 2) return "Upload Metadata";
  return "Configure & Deploy";
}

export default function DropWizard() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialMode = useMemo<Mode | null>(() => {
    const m = sp.get("mode");
    return m === "upload" || m === "external" ? m : null;
  }, [sp]);

  const [mode, setMode] = useState<Mode | null>(initialMode);
  const [step, setStep] = useState<Step>(0);

  // session from /api/uploads/init
  const [jobId, setJobId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Upload results
  const [assetsCid, setAssetsCid] = useState<string | null>(null);
  const [metadataCid, setMetadataCid] = useState<string | null>(null);
  const [finalBaseUri, setFinalBaseUri] = useState<string>("");

  // Detected count (prefer metadata count; fall back to assets)
  const [detectedSupply, setDetectedSupply] = useState<number | null>(null);

  // Guided modals
  const [showAssetsModal, setShowAssetsModal] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);

  // Post-deploy success modal
  const [deploySuccessOpen, setDeploySuccessOpen] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<DeploySuccessInfo | null>(null);

  const { show, hide } = useLoaderStore();

  function setModeInUrl(next: Mode | null) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!next) url.searchParams.delete("mode");
    else url.searchParams.set("mode", next);
    router.replace(url.toString());
  }

  function goSelect(next: Mode) {
    setMode(next);
    setStep(next === "upload" ? 1 : 3);
    setModeInUrl(next);

    // Prefetch silently (don’t toast on mount/select; toast only when user uploads)
    if (next === "upload") {
      ensureSession({ silent: true }).catch(() => {});
    }
  }

  /**
   * Ensure a live upload session exists.
   * - Returns {jobId, token} immediately to avoid races with setState.
   * - "silent" prevents the annoying red toast during background prefetch.
   */
  async function ensureSession(opts?: { silent?: boolean }): Promise<{ jobId: string; token?: string | null }> {
    const silent = !!opts?.silent;

    if (jobId && token !== undefined) return { jobId, token };

    try {
      const res = await fetch("/api/uploads/init", { method: "POST", cache: "no-store" });
      if (!res.ok) {
        // Try to read JSON error, otherwise fall back to text
        let msg = `Could not initialize upload session (HTTP ${res.status}).`;
        try {
          const j = await res.json();
          msg = j?.error || msg;
        } catch {
          try {
            const t = await res.text();
            if (t) msg = t;
          } catch {}
        }
        throw new Error(msg);
      }

      const json = (await res.json()) as InitResponse;
      if (!json?.jobId) throw new Error("Failed to start upload session");

      setJobId(json.jobId);
      setToken(json.token ?? null);
      return { jobId: json.jobId, token: json.token ?? null };
    } catch (err: any) {
      if (!silent) toast.error(err?.message || "Could not initialize upload session");
      throw err;
    }
  }

  /** XHR upload (so we get progress events) */
  function uploadWithProgress(
    url: string,
    form: FormData,
    headers: Record<string, string>,
    onProgress: (pct: number) => void
  ) {
    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);

      Object.entries(headers).forEach(([k, v]) => {
        if (v) xhr.setRequestHeader(k, v);
      });

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) onProgress((evt.loaded / evt.total) * 100);
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
      xhr.timeout = 1000 * 60 * 30; // 30 minutes
      xhr.send(form);
    });
  }

  // Prefetch upload session on mount if URL had ?mode=upload
  useEffect(() => {
    if (initialMode === "upload") {
      ensureSession({ silent: true }).catch(() => {});
      setMode("upload");
      setStep(1);
    }
    if (initialMode === "external") {
      setMode("external");
      setStep(3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure session exists whenever user is on step 1 or 2 of upload mode (silent)
  useEffect(() => {
    if (mode === "upload" && (step === 1 || step === 2)) {
      ensureSession({ silent: true }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, step]);

  // Deploy ERC721 drop
  async function deploy(payload: any) {
    const RAW_FACTORY_ADDRESS = getFactoryAddress();
    const FACTORY_ADDRESS = assertHexAddress("Factory address", RAW_FACTORY_ADDRESS);
    const REQUIRED_CHAIN_ID = getRequiredChainId();

    try {
      // 1) Fee snapshot
      show("Preparing deployment…");
      const feeRes = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractType: "ERC721_DROP",
          metadataOption: payload.metadataOption,
        }),
      });
      if (!feeRes.ok) {
        const er = await feeRes.json().catch(() => ({}));
        throw new Error(er?.error || "Failed to fetch fee config");
      }

      const feeJson = (await feeRes.json()) as {
        feeRecipient: string;
        feeAmountEtnWei: string;
      };

      const feeRecipient = assertHexAddress("Platform fee recipient", feeJson.feeRecipient);
      const feeAmount = BigInt(feeJson.feeAmountEtnWei);

      // 2) Wallet + chain
      show("Connecting wallet…");
      await ensureChain(REQUIRED_CHAIN_ID);
      const signer = await getBrowserSigner();
      const provider = signer.provider as ethers.BrowserProvider;
      const from = await signer.getAddress();

      // 3) Build args
      show("Validating configuration…");
      const royaltyBps = percentToBps(Number(payload.royaltyPercent || 0));
      const baseURI = String(payload.baseURI || "").replace(/\/+$/, "");

      if (!baseURI.startsWith("ipfs://")) {
        throw new Error("Base URI must start with ipfs://<CID>");
      }

      assertHexAddress("Royalty recipient", payload.royaltyRecipient);

      const cfg = {
        name: payload.name,
        symbol: payload.symbol,
        baseURI,
        maxSupply: BigInt(payload.totalSupply),
        feeRecipient,
        feeAmount,
        royaltyRecipient: payload.royaltyRecipient,
        royaltyBps,
        initialOwner: from,
      };

      const pubConfig = {
        startTimestamp: BigInt(Math.floor(new Date(payload.publicStartISO).getTime() / 1000)),
        price: BigInt(payload.publicPriceWei),
        maxPerWallet: BigInt(payload.maxPerWallet),
        maxPerTx: BigInt(payload.maxPerTx),
      };

      const presaleEnabled = !!payload.presale;
      const presaleConfig = presaleEnabled
        ? {
            startTimestamp: BigInt(Math.floor(new Date(payload.presale.startISO).getTime() / 1000)),
            endTimestamp: BigInt(Math.floor(new Date(payload.presale.endISO).getTime() / 1000)),
            price: BigInt(payload.presale.priceWei),
            maxSupply: BigInt(payload.presale.maxSupply),
            merkleRoot: payload.presale.merkleRoot as `0x${string}`,
          }
        : {
            startTimestamp: BigInt(0),
            endTimestamp: BigInt(0),
            price: BigInt(0),
            maxSupply: BigInt(0),
            merkleRoot:
              "0x0000000000000000000000000000000000000000000000000000000000000000" as const,
          };

      const factory = new ethers.Contract(FACTORY_ADDRESS, NFT_FACTORY_ABI, signer);

      // 4) Sanity checks
      show("Checking factory…");
      const [factoryCode, impl721] = await Promise.all([
        provider.getCode(FACTORY_ADDRESS),
        factory.erc721DropImpl(),
      ]);
      if (!factoryCode || factoryCode === "0x") {
        throw new Error("Factory address has no code. Check NEXT_PUBLIC_FACTORY_ADDRESS.");
      }
      const implCode = await provider.getCode(impl721);
      if (!ethers.isAddress(impl721) || implCode === "0x") {
        throw new Error("Factory misconfigured: erc721DropImpl is not a contract.");
      }

      // 5) Balance check
      show("Checking balance…");
      const [bal, feeData] = await Promise.all([
        provider.getBalance(from),
        provider.getFeeData().catch(() => null),
      ]);
      const gasPriceWei = feeData?.gasPrice ?? feeData?.maxFeePerGas ?? BigInt(0);
      const gasBuffer = BigInt(300_000);
      const minNeeded = feeAmount + gasBuffer * gasPriceWei;
      if (bal < minNeeded) {
        hide();
        throw new Error(
          `Insufficient ETN for fee + gas. Need ≈ ${(Number(minNeeded) / 1e18).toFixed(3)} ETN.`
        );
      }

      // 6) Simulate
      show("Simulating…");
      try {
        await factory.createERC721Drop.staticCall(cfg, pubConfig, presaleConfig, { value: feeAmount });
      } catch (err: any) {
        const msg = prettyEthersError(err);
        hide();
        toast.error(msg || "Simulation failed. Check fee, base URI, or owner.");
        throw err;
      }

      // 7) Estimate gas
      show("Estimating gas…");
      const overrides: any = { value: feeAmount };
      try {
        const est: bigint = await factory.createERC721Drop.estimateGas(cfg, pubConfig, presaleConfig, {
          value: feeAmount,
        });
        overrides.gasLimit = (est * BigInt(120)) / BigInt(100);
      } catch {
        overrides.gasLimit = BigInt(1_800_000);
      }

      // 8) Send tx
      show("Awaiting wallet approval…");
      const tx = await factory.createERC721Drop(cfg, pubConfig, presaleConfig, overrides);

      show("Transaction submitted. Waiting for confirmation…");
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        hide();
        throw new Error("Deployment failed on-chain.");
      }

      // 9) Parse event → cloneAddress
      let cloneAddress: string | null = null;
      const iface = new ethers.Interface(NFT_FACTORY_ABI as any);
      for (const log of receipt.logs ?? []) {
        if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) continue;
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "ERC721DropCloneCreated") {
            cloneAddress = parsed.args?.[1] as string;
            break;
          }
        } catch {}
      }

      // 10) Persist to DB
      show("Finalizing on server…");
      const post = await fetch("/api/drop/postdeploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: receipt.hash, payload }),
      });
      if (!post.ok) {
        hide();
        const err = await post.json().catch(() => ({}));
        throw new Error(err?.error || "Server failed to finalize");
      }
      const done = await post.json();

      hide();

      const finalAddress: string = cloneAddress ?? done?.cloneAddress ?? "";
      setDeploySuccess({
        name: payload.name,
        logoUrl: payload.logoUrl,
        contract: finalAddress,
        txHash: receipt.hash,
      });
      setDeploySuccessOpen(true);
    } catch (e: any) {
      hide();
      const msg =
        prettyEthersError(e) ||
        e?.shortMessage ||
        e?.reason ||
        e?.message ||
        (e?.receipt?.status === 0 ? "Transaction reverted (status 0)." : null) ||
        "Transaction failed.";
      toast.error(msg);
      console.error("createERC721Drop failed:", e);
    }
  }

  // --- Render ---

  if (mode === null) {
    return (
      <div className="w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Create Drop</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Pick how you want to supply metadata for your ERC-721 drop.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          <Panel onClick={() => goSelect("upload")}>
            <div className="p-5 sm:p-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-2xl border border-border bg-background flex items-center justify-center">
                  <UploadCloud className="h-5 w-5 opacity-80" />
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-lg">Upload via Panth.art</div>
                  <div className="text-sm text-muted-foreground">
                    Upload a ZIP of assets (≤ 2 GB) and a ZIP of metadata (≤ 385 MB). We’ll pin to IPFS and return a Base URI.
                  </div>
                </div>
              </div>
              <MoveRight className="h-5 w-5 opacity-70" />
            </div>
          </Panel>

          <Panel onClick={() => goSelect("external")}>
            <div className="p-5 sm:p-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-2xl border border-border bg-background flex items-center justify-center">
                  <FileArchive className="h-5 w-5 opacity-80" />
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-lg">Use External Base URI</div>
                  <div className="text-sm text-muted-foreground">
                    Provide a Base URI you manage (ipfs://CID). We’ll deploy using it directly.
                  </div>
                </div>
              </div>
              <MoveRight className="h-5 w-5 opacity-70" />
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  if (mode === "external") {
    return (
      <>
        <ConfigForm
          mode="external"
          onBack={() => {
            setMode(null);
            setStep(0);
            setModeInUrl(null);
          }}
          onDeploy={deploy}
          detectedSupply={detectedSupply ?? undefined}
          showBackButton={false}
        />

        <DeploySuccessModal
          open={deploySuccessOpen}
          name={deploySuccess?.name ?? ""}
          logoUrl={deploySuccess?.logoUrl}
          contract={deploySuccess?.contract ?? ""}
          txHash={deploySuccess?.txHash}
          onViewCollection={() => {
            if (deploySuccess?.contract) {
              setDeploySuccessOpen(false);
              router.push(`/collections/${deploySuccess.contract}`);
            }
          }}
          onGoToCollections={() => {
            setDeploySuccessOpen(false);
            router.push(`/collections`);
          }}
          onClose={() => setDeploySuccessOpen(false)}
        />
      </>
    );
  }

  // Upload mode
  return (
    <div className="w-full">
      {/* Apple-grade: no competing "Back" near the page back.
          Only show a subtle "Previous step" *inside* the wizard header area, and only when it matters. */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Create Drop</h1>

        <div className="mt-2 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">Step {step} of 3</span>
          <span className="opacity-60">—</span>
          <span>{StepLabel({ step })}</span>
        </div>

        {step > 1 ? (
          <div className="mt-5 flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-full px-4"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            >
              Previous step
            </Button>
          </div>
        ) : null}
      </div>

      {step === 1 && (
        <UploadPanel
          title="Upload Assets"
          note="ZIP should contain your images/GIFs/webp/svg/light MP4s."
          accept=".zip,application/zip,application/x-zip-compressed,application/x-zip"
          maxBytes={MAX_ASSETS_BYTES}
          disabled={false}
          onUpload={async (file, onProgress) => {
            if (!UPLOAD_BASE) throw new Error("NEXT_PUBLIC_UPLOAD_BASE not configured");

            // User is actively uploading: if session init fails, we WANT a toast
            const sess = await ensureSession({ silent: false });

            const form = new FormData();
            form.append("kind", "assets");
            form.append("file", file);

            const headers: Record<string, string> = { "x-job-id": sess.jobId };
            if (sess.token) headers["Authorization"] = `Bearer ${sess.token}`;

            const json = await uploadWithProgress(`${UPLOAD_BASE}/upload/assets`, form, headers, onProgress);

            const raw = json?.count ?? json?.itemCount ?? json?.items ?? json?.total;
            const n = typeof raw === "number" ? raw : Number(raw);
            const itemCount = Number.isFinite(n) && n > 0 ? Number(n) : undefined;

            return json?.cid ? { cid: String(json.cid), itemCount } : null;
          }}
          onDone={(res) => {
            if (res?.cid) {
              setAssetsCid(res.cid);
              if (typeof res.itemCount === "number") setDetectedSupply(res.itemCount);
              setShowAssetsModal(true);
            }
          }}
        />
      )}

      {step === 2 && (
        <UploadPanel
          title="Upload Metadata"
          note="ZIP must contain `{tokenId}.json` files. We’ll rewrite `image` to the correct ipfs:// path."
          accept=".zip,application/zip,application/x-zip-compressed,application/x-zip"
          maxBytes={MAX_METADATA_BYTES}
          disabled={!assetsCid}
          extraDisabledNote={!assetsCid ? "Upload assets first to continue." : undefined}
          onUpload={async (file, onProgress) => {
            if (!assetsCid) throw new Error("Upload assets first.");
            if (!UPLOAD_BASE) throw new Error("NEXT_PUBLIC_UPLOAD_BASE not configured");

            const sess = await ensureSession({ silent: false });

            const form = new FormData();
            form.append("kind", "metadata");
            form.append("file", file);

            const headers: Record<string, string> = {
              "x-job-id": sess.jobId,
              "x-assets-cid": assetsCid,
            };
            if (sess.token) headers["Authorization"] = `Bearer ${sess.token}`;

            const json = await uploadWithProgress(`${UPLOAD_BASE}/upload/metadata`, form, headers, onProgress);

            const raw = json?.count ?? json?.itemCount ?? json?.items ?? json?.total;
            const n = typeof raw === "number" ? raw : Number(raw);
            const itemCount = Number.isFinite(n) && n > 0 ? Number(n) : undefined;

            if (json?.cid && json?.baseUri) {
              return { cid: String(json.cid), baseUri: String(json.baseUri), itemCount };
            }
            return null;
          }}
          onDone={(res) => {
            if (res?.itemCount) setDetectedSupply(res.itemCount);
            if (res?.cid && res?.baseUri) {
              setMetadataCid(res.cid);
              setFinalBaseUri(res.baseUri);
              setShowMetadataModal(true);
            }
          }}
        />
      )}

      {step === 3 && (
        <ConfigForm
          mode="upload"
          baseUriFromUploads={finalBaseUri}
          detectedSupply={detectedSupply ?? undefined}
          onBack={() => setStep(2)}
          onDeploy={deploy}
        />
      )}

      {/* Guided success modals */}
      <SuccessDialog
        open={showAssetsModal}
        title="Assets uploaded & pinned"
        description="Copy the CID for your records."
        items={[
          {
            label: "Assets CID",
            value: assetsCid ?? "",
            display: assetsCid ?? "",
            href: assetsCid ? `https://ipfs.io/ipfs/${assetsCid}` : undefined,
          },
          ...(detectedSupply
            ? [{ label: "Detected items", value: String(detectedSupply), display: String(detectedSupply) }]
            : []),
        ]}
        proceedLabel="Proceed to Metadata"
        onProceed={() => {
          setShowAssetsModal(false);
          setStep(2);
        }}
      />

      <SuccessDialog
        open={showMetadataModal}
        title="Metadata uploaded & validated"
        description="Copy your references. Next, complete collection details."
        items={[
          {
            label: "Metadata CID",
            value: metadataCid ?? "",
            display: metadataCid ?? "",
            href: metadataCid ? `https://ipfs.io/ipfs/${metadataCid}` : undefined,
          },
          {
            label: "Base URI",
            value: finalBaseUri,
            display: finalBaseUri,
            href: metadataCid ? `https://ipfs.io/ipfs/${metadataCid}` : undefined,
          },
          ...(detectedSupply
            ? [{ label: "Detected items", value: String(detectedSupply), display: String(detectedSupply) }]
            : []),
        ]}
        proceedLabel="Proceed to Collection Details"
        onProceed={() => {
          setShowMetadataModal(false);
          setStep(3);
        }}
      />

      {/* Post-deploy success modal */}
      <DeploySuccessModal
        open={deploySuccessOpen}
        name={deploySuccess?.name ?? ""}
        logoUrl={deploySuccess?.logoUrl}
        contract={deploySuccess?.contract ?? ""}
        txHash={deploySuccess?.txHash}
        onViewCollection={() => {
          if (deploySuccess?.contract) {
            setDeploySuccessOpen(false);
            router.push(`/collections/${deploySuccess.contract}`);
          }
        }}
        onGoToCollections={() => {
          setDeploySuccessOpen(false);
          router.push(`/collections`);
        }}
        onClose={() => setDeploySuccessOpen(false)}
      />
    </div>
  );

  /** Reusable upload panel */
  function UploadPanel(props: {
    title: string;
    note?: string;
    accept: string;
    maxBytes: number;
    disabled: boolean;
    extraDisabledNote?: string;
    onUpload: (file: File, onProgress: (pct: number) => void) => Promise<UploadResult>;
    onDone: (result: UploadResult) => void;
  }) {
    const [file, setFile] = useState<File | null>(null);
    const [sizeErr, setSizeErr] = useState<string | null>(null);
    const [typeErr, setTypeErr] = useState<string | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const readableMax = useMemo(() => formatBytes(props.maxBytes), [props.maxBytes]);

    const acceptLabel = useMemo(() => {
      const parts = props.accept
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const hasZip = parts.some((p) => p.includes(".zip"));
      return hasZip ? ".zip" : parts.join(", ");
    }, [props.accept]);

    function validate(f: File): boolean {
      if (f.size > props.maxBytes) {
        setSizeErr(`File too large. Max allowed: ${readableMax}.`);
        return false;
      }

      const allowed = props.accept
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const ext = `.${(f.name.split(".").pop() || "").toLowerCase()}`;
      const mime = (f.type || "").toLowerCase();

      const ok =
        allowed.includes(ext) ||
        allowed.includes(mime) ||
        allowed.some((a) => a.endsWith("/*") && mime.startsWith(a.slice(0, -2)));

      if (!ok) {
        setTypeErr(`Invalid file type. Allowed: ${acceptLabel}`);
        return false;
      }

      setSizeErr(null);
      setTypeErr(null);
      return true;
    }

    function pick(e: React.ChangeEvent<HTMLInputElement>) {
      const f = e.target.files?.[0];
      if (!f) return;
      if (!validate(f)) {
        e.currentTarget.value = "";
        setFile(null);
        return;
      }
      setFile(f);
      setProgress(0);
    }

    function reset() {
      setFile(null);
      setSizeErr(null);
      setTypeErr(null);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }

    async function startUpload() {
      if (!file) return;
      setBusy(true);
      setProgress(0);

      const tries = 3;
      let lastErr: any;

      for (let i = 0; i < tries; i++) {
        try {
          const res = await props.onUpload(file, (p) => setProgress(p));
          props.onDone(res);
          setBusy(false);
          return;
        } catch (e: any) {
          lastErr = e;
          if (i < tries - 1) {
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
            setProgress(0);
          }
        }
      }

      setBusy(false);
      toast.error(lastErr?.message || "Upload failed");
      props.onDone(null);
    }

    function onDrop(e: React.DragEvent<HTMLDivElement>) {
      e.preventDefault();
      if (props.disabled || busy) return;
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      if (!validate(f)) return;
      setFile(f);
      setProgress(0);
    }

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-7 text-center">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{props.title}</h2>
          {props.note ? <p className="text-sm text-muted-foreground mt-2">{props.note}</p> : null}
        </div>

        <div className="text-sm text-muted-foreground mb-3">
          Accepted: <span className="font-medium text-foreground">{acceptLabel}</span>{" "}
          <span className="opacity-70">(max {readableMax})</span>
        </div>

        <div
          className={[
            "relative rounded-3xl border border-dashed border-border bg-card",
            "shadow-sm",
            "transition",
            props.disabled
              ? "opacity-60 pointer-events-none"
              : "hover:bg-background/60 hover:shadow-md cursor-pointer active:scale-[0.998]",
            "focus-within:ring-2 focus-within:ring-foreground/15",
          ].join(" ")}
          role="button"
          aria-label="File upload dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
            <div className="h-11 w-11 rounded-2xl border border-border bg-background flex items-center justify-center">
              <UploadCloud className="h-5 w-5 opacity-80" />
            </div>
            <div className="text-sm font-semibold">Click to choose a file</div>
            <div className="text-xs text-muted-foreground">or drag & drop</div>
            <div className="text-xs text-muted-foreground mt-2">
              {file ? `${file.name} • ${formatBytes(file.size)}` : "No file selected"}
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={props.accept}
            className="absolute inset-0 h-full w-full opacity-0"
            style={{ pointerEvents: "none" }}
            onChange={pick}
            tabIndex={-1}
            aria-hidden
          />
        </div>

        {sizeErr ? <p className="text-sm text-red-500 mt-3">{sizeErr}</p> : null}
        {typeErr ? <p className="text-sm text-red-500 mt-3">{typeErr}</p> : null}

        {file ? (
          <div className="mt-5 space-y-3">
       <ProgressBar value={progress} active={busy} />
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>{progress.toFixed(0)}%</span>
              <span>{formatBytes(file.size)}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={startUpload} disabled={busy} className="w-full sm:w-auto">
                {busy ? "Uploading…" : "Start Upload"}
              </Button>
              <Button variant="outline" onClick={reset} disabled={busy} className="w-full sm:w-auto">
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {props.disabled && props.extraDisabledNote ? (
          <p className="text-sm text-muted-foreground mt-5">{props.extraDisabledNote}</p>
        ) : null}
      </div>
    );
  }
}