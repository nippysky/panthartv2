/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { defineChain, createPublicClient, createWalletClient, custom, http, Hash } from "viem";

import { Container } from "@/src/ui/Container";
import { Button } from "@/src/ui/Button";
import { Skeleton } from "@/src/ui/Skeleton";
import { useUnifiedAccount } from "@/src/lib/useUnifiedAccount";

/* ---------------- chain config ---------------- */
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  "https://rpc.ankr.com/electroneum";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || 52014);

const ELECTRONEUM = defineChain({
  id: CHAIN_ID,
  name: "Electroneum",
  nativeCurrency: { name: "Electroneum", symbol: "ETN", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
  blockExplorers: {
    default: {
      name: "ETN Explorer",
      url: (process.env.NEXT_PUBLIC_BLOCK_EXPLORER || "https://blockexplorer.electroneum.com").replace(/\/+$/, ""),
    },
  },
});

const CHAIN_HEX_ID = `0x${ELECTRONEUM.id.toString(16)}` as const;

async function ensureWalletOnChain(provider: any) {
  if (!provider?.request) return;
  const currentHex = await provider.request({ method: "eth_chainId" });
  if (String(currentHex).toLowerCase() === CHAIN_HEX_ID.toLowerCase()) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX_ID }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_HEX_ID,
            chainName: ELECTRONEUM.name,
            nativeCurrency: ELECTRONEUM.nativeCurrency,
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [ELECTRONEUM.blockExplorers?.default?.url || ""].filter(Boolean),
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function shortAddr(a?: string | null) {
  if (!a) return "—";
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}


function toPlainIntegerString(x: unknown): string {
  if (x == null) return "";
  const s = String(x).trim();
  if (!s) return "";
  if (/^[+-]?\d+$/.test(s)) return s.replace(/^\+/, "");
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
  if (/^[+-]?\d+\.\d+$/.test(s)) return s.split(".")[0].replace(/^\+/, "");
  return s.replace(/[^\d-]/g, "");
}

function useMiniToast() {
  const [t, setT] = React.useState<{ show: boolean; msg: string }>({ show: false, msg: "" });
  const timer = React.useRef<number | null>(null);

  const show = React.useCallback((msg: string) => {
    setT({ show: true, msg });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT({ show: false, msg: "" }), 1800);
  }, []);

  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const Toast = (
    <div
      className={cx(
        "pointer-events-none fixed left-1/2 -translate-x-1/2 transition duration-200",
        t.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
      style={{ zIndex: 99999, bottom: "24px" }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        {t.msg}
      </div>
    </div>
  );

  return { show, Toast };
}

function StepPill({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cx(
          "h-8 w-8 rounded-full border border-border grid place-items-center text-xs font-semibold",
          done && "bg-foreground text-background border-transparent",
          active && !done && "bg-background text-foreground",
          !active && !done && "bg-card text-muted-foreground"
        )}
      >
        {done ? "✓" : label[0]}
      </div>
      <div className={cx("text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card/70 shadow-[0_18px_70px_rgba(0,0,0,0.12)] backdrop-blur-xl">
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        {required ? <div className="text-[11px] text-foreground/80">*</div> : null}
      </div>
      {children}
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none",
        "focus:ring-2 focus:ring-foreground/10",
        props.className
      )}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none",
        "focus:ring-2 focus:ring-foreground/10",
        props.className
      )}
    />
  );
}

function FileTile({
  title,
  value,
  onPick,
  ratio,
  hint,
}: {
  title: string;
  value: string;
  onPick: (f: File) => void;
  ratio: "cover" | "square";
  hint: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const sizeCls =
    ratio === "cover"
      ? "w-full h-40 sm:h-44 md:h-52"
      : "w-28 sm:w-32 md:w-36 aspect-square"; // ✅ always square, never full-width

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground">{title}</div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cx(
          "group relative overflow-hidden rounded-2xl border border-border bg-background",
          "transition hover:bg-card/50 active:scale-[0.99]",
          "focus:outline-none focus:ring-2 focus:ring-foreground/10",
          sizeCls
        )}
      >
        {value ? (
          <>
            <Image src={value} alt={title} fill className="object-cover" />
            <div className="absolute inset-0 grid place-items-center bg-black/35 text-white text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100">
              Click to replace
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-muted-foreground">
            Click to upload
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) onPick(f);
          e.currentTarget.value = "";
        }}
      />

      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}


type ProbeResp = {
  ok: boolean;
  error?: string;
  isErc721?: boolean;
  name?: string | null;
  symbol?: string | null;
  supply?: string | null;
  ownerAddress?: string | null;
};

type FeeResp = {
  feeRecipient: string;
  feeAmountEtnWei: string;
  targetUsdCents?: number;
  lastPriceUsd?: string;
};

type PreviewResp = {
  ok: boolean;
  error?: string;
  triedUrls?: string[];
  meta?: {
    name?: string;
    description?: string;
    attributes?: Array<{ trait_type?: string; value?: any }>;
  };
  media?: { kind: "image" | "video"; url: string } | null;
};

export default function SubmitCollectionClient() {
  const acct = useUnifiedAccount();
  const connected = !!acct.address;
  const { show: toast, Toast } = useMiniToast();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);

  // Step 1
  const [contract, setContract] = React.useState("");
  const [probing, setProbing] = React.useState(false);
  const [probe, setProbe] = React.useState<ProbeResp | null>(null);

  // Step 2
  const [logoUrl, setLogoUrl] = React.useState("");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [baseUri, setBaseUri] = React.useState("");
  const [baseValid, setBaseValid] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewResp | null>(null);
  const [previewing, setPreviewing] = React.useState(false);

  // Step 3
  const [description, setDescription] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [x, setX] = React.useState("");
  const [instagram, setInstagram] = React.useState("");
  const [telegram, setTelegram] = React.useState("");
  const [agree, setAgree] = React.useState(false);

  const [fee, setFee] = React.useState<FeeResp | null>(null);
  const [feeLoading, setFeeLoading] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<null | { id: string; contract: string; name: string; owner: string }>(
    null
  );

  const isOwnerMatch = React.useMemo(() => {
    const owner = (probe?.ownerAddress || "").toLowerCase();
    const me = (acct.address || "").toLowerCase();
    if (!owner || !me) return null;
    return owner === me;
  }, [probe?.ownerAddress, acct.address]);

  async function uploadImage(file: File): Promise<string> {
    // lightweight validation (keeps UX snappy)
    if (!file.type?.startsWith("image/")) throw new Error("Please choose an image file.");
    if (file.size > 3 * 1024 * 1024) throw new Error("Image too large (max 3MB).");

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/upload-image", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success || !json?.data?.secure_url) {
      throw new Error(json?.error || "Upload failed");
    }
    return String(json.data.secure_url);
  }

  async function probeContract() {
    const addr = contract.trim();
    setProbe(null);

    if (!addr) return toast("Enter a contract address");
    setProbing(true);

    try {
      const qs = new URLSearchParams({
        contract: addr,
        ...(acct.address ? { account: acct.address } : {}),
      });

      const res = await fetch(`/api/collections/submission/probe?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
      });

      const json = (await res.json().catch(() => null)) as ProbeResp | null;
      if (!res.ok || !json) throw new Error((json as any)?.error || "Failed to probe contract");

      setProbe(json);

      if (!json.ok) {
        toast(json.error || "Could not validate contract");
        return;
      }
      if (json.isErc721 === false) {
        toast("Only ERC-721 collections are supported");
        return;
      }
      toast("Contract verified");
    } catch (e: any) {
      toast(e?.message || "Failed to probe contract");
    } finally {
      setProbing(false);
    }
  }

  async function validateBaseUri() {
    const v = baseUri.trim();
    setBaseValid(false);
    setPreview(null);

    if (!v) return toast("Enter Base URI");
    setPreviewing(true);

    try {
      const res = await fetch("/api/collections/submission/preview", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ baseUri: v }),
      });

      const json = (await res.json().catch(() => null)) as PreviewResp | null;
      if (!res.ok || !json) throw new Error((json as any)?.error || "Failed to validate Base URI");

      setPreview(json);

      if (!json.ok) {
        toast(json.error || "Base URI invalid");
        setBaseValid(false);
        return;
      }

      setBaseValid(true);
      toast("Base URI validated");
    } catch (e: any) {
      toast(e?.message || "Failed to validate Base URI");
    } finally {
      setPreviewing(false);
    }
  }

  async function loadFee() {
    setFee(null);
    setFeeLoading(true);

    try {
      const res = await fetch("/api/fees", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ contractType: "ERC721_DROP", metadataOption: "EXTERNAL" }),
      });

      const json = (await res.json().catch(() => null)) as FeeResp | null;
      if (!res.ok || !json) throw new Error((json as any)?.error || "Failed to load fee");

      setFee(json);
    } catch (e: any) {
      toast(e?.message || "Failed to load fee");
    } finally {
      setFeeLoading(false);
    }
  }

  React.useEffect(() => {
    if (step === 3 && connected) void loadFee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, connected]);

  const canGoStep2 = !!probe?.ok && probe.isErc721 !== false && isOwnerMatch === true;
  const canGoStep3 = !!logoUrl && !!coverUrl && baseValid;

  const feeHuman = React.useMemo(() => {
    const wei = toPlainIntegerString(fee?.feeAmountEtnWei || "");
    if (!wei) return "—";
    // viem formatEther without importing extra (small trick):
    // 1e18 wei -> string formatting manually is annoying;
    // keep it compact: show ETN in compact based on bigint/1e18 approximation.
    try {
      const b = BigInt(wei);
      const etn = Number(b) / 1e18;
      if (!Number.isFinite(etn)) return "—";
      return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(etn)} ETN`;
    } catch {
      return "—";
    }
  }, [fee?.feeAmountEtnWei]);

  const usdLine = React.useMemo(() => {
    if (!fee) return "";
    if (typeof fee.targetUsdCents === "number" && fee.targetUsdCents > 0) {
      return `You’re paying $${(fee.targetUsdCents / 100).toFixed(2)} worth of ETN.`;
    }
    if (fee.lastPriceUsd && fee.feeAmountEtnWei) {
      try {
        const b = BigInt(toPlainIntegerString(fee.feeAmountEtnWei));
        const etn = Number(b) / 1e18;
        const px = Number(fee.lastPriceUsd);
        if (!Number.isFinite(etn) || !Number.isFinite(px) || px <= 0) return "";
        return `You’re paying ~$${(etn * px).toFixed(2)} worth of ETN.`;
      } catch {
        return "";
      }
    }
    return "";
  }, [fee]);

  async function payAndSubmit() {
    if (!acct.address) return toast("Connect your wallet first");
    if (!probe?.ok || probe.isErc721 === false) return toast("Contract must be a valid ERC-721");
    if (isOwnerMatch !== true) return toast("Connected wallet must match collection owner");
    if (!logoUrl || !coverUrl) return toast("Logo and cover are required");
    if (!baseValid) return toast("Please validate Base URI");
    if (!agree) return toast("You must agree to the Terms");
    if (!fee?.feeRecipient || !fee?.feeAmountEtnWei) return toast("Fee is not available right now");

    setSubmitting(true);
    try {
      // Always refetch fee right before paying (freshness)
      const feeRes = await fetch("/api/fees", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ contractType: "ERC721_DROP", metadataOption: "EXTERNAL" }),
      });
      const fresh = (await feeRes.json().catch(() => null)) as FeeResp | null;
      if (!feeRes.ok || !fresh) throw new Error((fresh as any)?.error || "Failed to refresh fee");

      const recipient = String(fresh.feeRecipient);
      const amountWei = BigInt(toPlainIntegerString(fresh.feeAmountEtnWei));

      const provider = (globalThis as any).ethereum;
      if (!provider?.request) throw new Error("No injected wallet provider found");

      await ensureWalletOnChain(provider);

      const pub = createPublicClient({ chain: ELECTRONEUM, transport: http(RPC_URL) });
      const wal = createWalletClient({ chain: ELECTRONEUM, transport: custom(provider) });

      toast("Confirm payment in your wallet…");
      const hash = (await wal.sendTransaction({
        account: acct.address as any,
        to: recipient as any,
        value: amountWei,
      })) as Hash;

      toast("Payment submitted. Waiting for confirmation…");
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Payment failed on-chain");

      toast("Submitting collection…");

      const payload = {
        contract: contract.trim(),
        standard: "ERC721",
        name: probe.name || "Collection",
        symbol: probe.symbol || "",
        supply: probe.supply ? Number(probe.supply) : 0,
        ownerAddress: probe.ownerAddress || acct.address,
        baseUri: baseUri.trim(),
        logoUrl,
        coverUrl,
        description: description.trim() || null,
        website: website.trim() || null,
        x: x.trim() || null,
        instagram: instagram.trim() || null,
        telegram: telegram.trim() || null,
        submitterAddress: acct.address,
        feeTxHash: hash,
      };

      const res = await fetch("/api/collections/submission", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Submission failed");

      setSuccess({
        id: String(json.data.id),
        contract: String(json.data.contract),
        name: String(json.data.name),
        owner: String(json.data.ownerAddress || probe.ownerAddress || acct.address),
      });

      toast("Submission received");
    } catch (e: any) {
      toast(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setStep(1);
    setContract("");
    setProbe(null);
    setLogoUrl("");
    setCoverUrl("");
    setBaseUri("");
    setBaseValid(false);
    setPreview(null);
    setDescription("");
    setWebsite("");
    setX("");
    setInstagram("");
    setTelegram("");
    setAgree(false);
    setFee(null);
    setSuccess(null);
    toast("Reset");
  }

  return (
    <>
      {Toast}

      <div className="page-enter">
        <section className="pt-10 sm:pt-14">
          <Container>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Submit collection</h1>
                <p className="mt-2 text-sm text-muted max-w-[70ch]">
                  A clean onboarding path for serious builders. Verify ownership, validate metadata, pay the fee, and submit.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                  Network: <span className="text-foreground/90 font-semibold">Electroneum</span>
                </div>
                <div className="rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                  Wallet: <span className="text-foreground/90 font-semibold">{connected ? shortAddr(acct.address) : "Not connected"}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <StepPill active={step === 1} done={step > 1} label="Contract" />
                <div className="hidden sm:block h-px w-8 bg-border" />
                <StepPill active={step === 2} done={step > 2} label="Media" />
                <div className="hidden sm:block h-px w-8 bg-border" />
                <StepPill active={step === 3} done={false} label="Submit" />
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={resetAll} disabled={submitting}>
                  Reset
                </Button>
              </div>
            </div>

            {!connected ? (
              <div className="mt-6">
                <Panel>
                  <div className="p-6">
                    <div className="text-sm font-semibold">Connect your wallet</div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      You need to connect the wallet that owns the collection contract to submit it.
                    </p>
                  </div>
                </Panel>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {/* STEP 1 */}
                {step === 1 ? (
                  <Panel>
                    <div className="p-6 sm:p-7">
                      <div className="text-sm font-semibold">Contract verification</div>
                      <p className="mt-2 text-sm text-muted-foreground max-w-[70ch]">
                        Paste the collection contract address. We’ll read it server-side (fast + lighter client bundle).
                      </p>

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Contract address" required hint="Example: 0x… (ERC-721 only)">
                            <TextInput
                              value={contract}
                              onChange={(e) => setContract(e.target.value)}
                              onBlur={() => void probeContract()}
                              placeholder="0x…"
                              inputMode="text"
                              autoCapitalize="none"
                              spellCheck={false}
                            />
                          </Field>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void probeContract()}
                              disabled={probing || !contract.trim()}
                            >
                              {probing ? "Checking…" : "Check contract"}
                            </Button>

                            <div className="text-xs text-muted-foreground">
                              Tip: If the contract doesn’t expose <span className="font-mono">owner()</span>, we’ll still try common patterns.
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background/60 p-4">
                          <div className="text-[11px] text-muted-foreground">Name</div>
                          <div className="mt-1 text-sm font-semibold">
                            {probing ? <Skeleton className="h-4 w-40 rounded-lg" /> : (probe?.name || "—")}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background/60 p-4">
                          <div className="text-[11px] text-muted-foreground">Symbol</div>
                          <div className="mt-1 text-sm font-semibold">
                            {probing ? <Skeleton className="h-4 w-24 rounded-lg" /> : (probe?.symbol || "—")}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background/60 p-4">
                          <div className="text-[11px] text-muted-foreground">Supply</div>
                          <div className="mt-1 text-sm font-semibold">
                            {probing ? <Skeleton className="h-4 w-20 rounded-lg" /> : (probe?.supply || "—")}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background/60 p-4">
                          <div className="text-[11px] text-muted-foreground">Owner</div>
                          <div className="mt-1 text-sm font-semibold">
                            {probing ? <Skeleton className="h-4 w-44 rounded-lg" /> : shortAddr(probe?.ownerAddress)}
                          </div>
                          {probe?.ownerAddress && acct.address ? (
                            <div className={cx("mt-1 text-[11px] font-semibold", isOwnerMatch ? "text-emerald-500" : "text-red-400")}>
                              {isOwnerMatch ? "Owner verified ✅" : "Connected wallet does not match owner"}
                            </div>
                          ) : null}
                        </div>

                        <div className="sm:col-span-2 rounded-2xl border border-border bg-background/60 p-4">
                          <div className="text-[11px] text-muted-foreground">Standard</div>
                          <div className="mt-1 text-sm font-semibold">
                            {probing ? <Skeleton className="h-4 w-28 rounded-lg" /> : probe?.ok ? (probe.isErc721 ? "ERC-721" : "Not ERC-721") : "—"}
                          </div>
                          {!probing && probe && !probe.ok ? (
                            <div className="mt-2 text-sm text-red-400">{probe.error || "Could not verify contract"}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setStep(2)}
                          disabled={!canGoStep2}
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </Panel>
                ) : null}

                {/* STEP 2 */}
                {step === 2 ? (
                  <Panel>
                    <div className="p-6 sm:p-7">
                      <div className="text-sm font-semibold">Branding & metadata</div>
                      <p className="mt-2 text-sm text-muted-foreground max-w-[70ch]">
                        Upload cover & logo, then validate your Base URI so we can preview token metadata.
                      </p>

               <div className="mt-6 space-y-6">
  <FileTile
    title="Cover photo"
    value={coverUrl}
    ratio="cover"
    hint="Recommended ~1600×400. Max 3MB."
    onPick={async (f) => {
      try {
        toast("Uploading cover…");
        const url = await uploadImage(f);
        setCoverUrl(url);
        toast("Cover uploaded");
      } catch (e: any) {
        toast(e?.message || "Upload failed");
      }
    }}
  />

  <FileTile
    title="Logo"
    value={logoUrl}
    ratio="square"
    hint="Recommended ≥ 400×400. Max 3MB."
    onPick={async (f) => {
      try {
        toast("Uploading logo…");
        const url = await uploadImage(f);
        setLogoUrl(url);
        toast("Logo uploaded");
      } catch (e: any) {
        toast(e?.message || "Upload failed");
      }
    }}
  />
</div>


                      <div className="mt-8">
                        <Field
                          label="Base URI"
                          required
                          hint="ipfs://… or https://… (we’ll try token #1 and #0, with and without .json)"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <TextInput
                              value={baseUri}
                              onChange={(e) => setBaseUri(e.target.value)}
                              onBlur={() => void validateBaseUri()}
                              placeholder="ipfs://bafy…/  or  https://ipfs.io/ipfs/<cid>/"
                              autoCapitalize="none"
                              spellCheck={false}
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void validateBaseUri()}
                              disabled={previewing || !baseUri.trim()}
                              className="sm:w-auto"
                            >
                              {previewing ? "Validating…" : "Validate"}
                            </Button>
                          </div>
                        </Field>

                        {preview ? (
                          <div className="mt-4 rounded-3xl border border-border bg-background/60 p-4">
                            {preview.ok ? (
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-border bg-background shrink-0">
                                  {preview.media?.kind === "video" ? (
                                    <video
                                      src={preview.media.url}
                                      className="h-full w-full object-cover"
                                      playsInline
                                      muted
                                      loop
                                      controls
                                    />
                                  ) : preview.media?.kind === "image" ? (
                                    <Image src={preview.media.url} alt="Preview" fill className="object-cover" />
                                  ) : (
                                    <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">
                                      No media
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold">{preview.meta?.name || "Untitled"}</div>
                                  {preview.meta?.description ? (
                                    <p className="mt-2 text-sm text-muted-foreground wrap-break-word">
                                      {preview.meta.description}
                                    </p>
                                  ) : null}

                                  {Array.isArray(preview.meta?.attributes) && preview.meta!.attributes!.length ? (
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                      {preview.meta!.attributes!.slice(0, 6).map((a, i) => (
                                        <div key={i} className="rounded-2xl border border-border bg-card/60 p-2">
                                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                            {String(a.trait_type ?? "Trait")}
                                          </div>
                                          <div className="text-sm font-semibold truncate">
                                            {String(a.value ?? "—")}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  <div className="mt-3 text-[11px] font-semibold text-emerald-500">
                                    Base URI validated ✅
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-red-400">{preview.error || "Base URI invalid"}</div>
                            )}

                            {preview.triedUrls?.length ? (
                              <details className="mt-4">
                                <summary className="cursor-pointer text-xs text-muted-foreground">
                                  Debug: tried URLs
                                </summary>
                                <div className="mt-2 max-h-40 overflow-auto">
                                  <ul className="space-y-1 text-xs text-muted-foreground break-all">
                                    {preview.triedUrls.map((u) => (
                                      <li key={u}>{u}</li>
                                    ))}
                                  </ul>
                                </div>
                              </details>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-8 flex items-center justify-between gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setStep(1)} disabled={submitting}>
                          Back
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setStep(3)}
                          disabled={!canGoStep3 || submitting}
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </Panel>
                ) : null}

                {/* STEP 3 */}
                {step === 3 ? (
                  <Panel>
                    <div className="p-6 sm:p-7">
                      <div className="text-sm font-semibold">Submit</div>
                      <p className="mt-2 text-sm text-muted-foreground max-w-[70ch]">
                        We’ll show the current fee, then you pay and submit in one clean flow.
                      </p>

                      <div className="mt-6 rounded-3xl border border-border bg-background/60 p-4">
                        <div className="text-[11px] text-muted-foreground">Submission fee</div>
                        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                          <div className="text-lg font-semibold">
                            {feeLoading ? <Skeleton className="h-6 w-28 rounded-lg" /> : feeHuman}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Recipient:{" "}
                            <span className="font-mono text-foreground/70">
                              {feeLoading ? "…" : shortAddr(fee?.feeRecipient)}
                            </span>
                          </div>
                        </div>
                        {usdLine ? <div className="mt-2 text-xs text-muted-foreground">{usdLine}</div> : null}
                      </div>

                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Description" hint="Optional, but recommended">
                            <TextArea
                              rows={5}
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Tell collectors what makes this collection special…"
                              disabled={submitting}
                            />
                          </Field>
                        </div>

                        <Field label="Website" hint="https://yourdomain.com">
                          <TextInput
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://yourdomain.com"
                            disabled={submitting}
                          />
                        </Field>

                        <Field label="X" hint="https://x.com/username">
                          <TextInput value={x} onChange={(e) => setX(e.target.value)} placeholder="https://x.com/username" disabled={submitting} />
                        </Field>

                        <Field label="Instagram" hint="https://instagram.com/username">
                          <TextInput
                            value={instagram}
                            onChange={(e) => setInstagram(e.target.value)}
                            placeholder="https://instagram.com/username"
                            disabled={submitting}
                          />
                        </Field>

                        <Field label="Telegram" hint="https://t.me/username">
                          <TextInput
                            value={telegram}
                            onChange={(e) => setTelegram(e.target.value)}
                            placeholder="https://t.me/username"
                            disabled={submitting}
                          />
                        </Field>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setAgree((v) => !v)}
                          className={cx(
                            "h-5 w-5 rounded border border-border grid place-items-center",
                            agree ? "bg-foreground text-background" : "bg-background text-transparent"
                          )}
                          aria-label="Agree to terms"
                        >
                          ✓
                        </button>

                        <div className="text-sm text-muted-foreground">
                          I agree to the{" "}
                          <Link
                            href="https://docs.panth.art/governance-and-policies/terms-and-conditions"
                            className="text-foreground underline underline-offset-4 hover:opacity-90"
                            target="_blank"
                          >
                            Terms & Conditions
                          </Link>
                        </div>
                      </div>

                      <div className="mt-8 flex items-center justify-between gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setStep(2)} disabled={submitting}>
                          Back
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void payAndSubmit()}
                          disabled={submitting || !agree || !fee?.feeRecipient || !fee?.feeAmountEtnWei}
                        >
                          {submitting ? "Processing…" : "Pay & Submit"}
                        </Button>
                      </div>
                    </div>
                  </Panel>
                ) : null}

                {/* Success */}
                {success ? (
                  <Panel>
                    <div className="p-6 sm:p-7">
                      <div className="text-sm font-semibold">Submission received ✅</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Your collection is pending admin review. You’ll see it on Panthart once approved.
                      </p>

                      <div className="mt-5 grid gap-2">
                        {[
                          { k: "Submission ID", v: success.id },
                          { k: "Name", v: success.name },
                          { k: "Contract", v: success.contract },
                          { k: "Owner", v: success.owner },
                        ].map((row) => (
                          <div key={row.k} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
                            <div className="text-xs text-muted-foreground">{row.k}</div>
                            <div className="text-xs font-mono text-foreground/80 truncate max-w-[60%]">{row.v}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={resetAll}>
                          Close
                        </Button>
                      </div>
                    </div>
                  </Panel>
                ) : null}
              </div>
            )}
          </Container>
        </section>

        <div className="h-10 sm:h-14" />
      </div>
    </>
  );
}
