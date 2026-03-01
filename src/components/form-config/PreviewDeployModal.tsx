"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";

import { Button } from "@/src/ui/Button";
import { formatNumber } from "@/src/lib/utils";

function formatUsd(n?: number | null) {
  if (n == null || !isFinite(n)) return "—";
  try {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function formatLagos(iso: string) {
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return "—";
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${s} WAT`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;

  baseUri: string;
  name: string;
  symbol: string;
  description: string;
  totalSupply: number;
  royaltyRecipient: string;
  royaltyPercent: number;

  publicStartISO: string;
  publicPriceEtn: string;
  maxPerWallet: number;
  maxPerTx: number;

  enablePresale: boolean;
  presaleStartISO: string | null;
  presaleEndISO: string | null;
  presalePriceEtn: string;
  presaleSupply: number;
  merkleRoot: string;
  allowlistCount: number;

  feeRecipient: string;
  feeAmountEtn: string;
  feeAmountUsdApprox: number | null;
  feeLastUpdatedLabel: string;

  logoUrl?: string;
  coverUrl?: string;

  baseUriWarning?: string | null;
};

export default function PreviewDeployModal({
  open,
  onClose,
  onConfirm,

  baseUri,
  name,
  symbol,
  description,
  totalSupply,
  royaltyRecipient,
  royaltyPercent,

  publicStartISO,
  publicPriceEtn,
  maxPerWallet,
  maxPerTx,

  enablePresale,
  presaleStartISO,
  presaleEndISO,
  presalePriceEtn,
  presaleSupply,
  merkleRoot,
  allowlistCount,

  feeRecipient,
  feeAmountEtn,
  feeAmountUsdApprox,
  feeLastUpdatedLabel,

  logoUrl,
  coverUrl,

  baseUriWarning,
}: Props) {
  // ESC + lock scroll
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-1000">
      {/* backdrop */}
      <button
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        aria-label="Close modal"
        onClick={onClose}
      />

      {/* panel */}
      <div className="absolute inset-x-0 top-[6vh] mx-auto w-[min(920px,92vw)]">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
          {/* header */}
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
            <div className="min-w-0">
              <div className="text-lg font-semibold">Review &amp; confirm</div>
              <div className="text-sm text-muted-foreground mt-1">
                Double-check everything before deploying your drop contract.
              </div>
            </div>

            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* cover/brand */}
          {coverUrl ? (
            <div className="relative h-36 w-full border-b border-border bg-background">
              <Image src={coverUrl} alt="Cover" fill className="object-cover" />
              {logoUrl ? (
                <div className="absolute left-6 -bottom-8 h-16 w-16 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
                  <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                </div>
              ) : null}
            </div>
          ) : logoUrl ? (
            <div className="px-6 pt-6">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-border bg-background">
                <Image src={logoUrl} alt="Logo" fill className="object-cover" />
              </div>
            </div>
          ) : null}

          <div className={`px-6 ${coverUrl ? "pt-12" : "pt-6"} pb-6 space-y-5`}>
            {/* warning */}
            {baseUriWarning ? (
              <div className="rounded-2xl border border-yellow-600/40 bg-yellow-600/10 text-yellow-300 p-3 text-sm">
                {baseUriWarning}
              </div>
            ) : null}

            {/* fee block */}
            <div className="rounded-3xl border border-border bg-background px-4 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="text-sm font-semibold">Platform Fee (one-time)</div>
                  <div className="text-sm text-muted-foreground break-all">
                    Payable to <span className="font-mono">{feeRecipient || "—"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ≈ {formatUsd(feeAmountUsdApprox)} · Last updated {feeLastUpdatedLabel}
                  </div>
                </div>

                <div className="text-base font-semibold inline-flex items-center gap-2">
                  {formatNumber(Number(feeAmountEtn || 0))}
                  <Image src="/ETN_LOGO.png" alt="ETN" width={16} height={16} />
                </div>
              </div>
            </div>

            {/* core grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-3xl border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Collection</div>
                <div className="mt-2 font-semibold wrap-break-word">
                  {name || "—"} <span className="text-muted-foreground">·</span> {symbol || "—"}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">Supply</div>
                <div className="font-semibold">{Number.isFinite(totalSupply) ? totalSupply : "—"}</div>
              </div>

              <div className="rounded-3xl border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Royalties</div>
                <div className="mt-2 font-semibold">{Number.isFinite(royaltyPercent) ? royaltyPercent : "—"}%</div>
                <div className="mt-2 text-sm text-muted-foreground">Recipient</div>
                <div className="font-mono text-xs break-all">{royaltyRecipient || "—"}</div>
              </div>

              <div className="rounded-3xl border border-border bg-background p-4 md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Base URI</div>
                <div className="mt-2 font-mono text-xs break-all">{baseUri || "—"}</div>
              </div>

              <div className="rounded-3xl border border-border bg-background p-4 md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Public sale</div>
                <div className="mt-2 font-semibold">
                  {formatLagos(publicStartISO)} · {publicPriceEtn || "—"} ETN
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {Number.isFinite(maxPerWallet) ? maxPerWallet : "—"} per wallet ·{" "}
                  {Number.isFinite(maxPerTx) ? maxPerTx : "—"} per txn
                </div>
              </div>
            </div>

            {description ? (
              <div className="rounded-3xl border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Description</div>
                <div className="mt-2 whitespace-pre-wrap text-sm wrap-break-word">{description}</div>
              </div>
            ) : null}

            {/* presale */}
            {enablePresale ? (
              <div className="rounded-3xl border border-border bg-background p-4">
                <div className="text-sm font-semibold">Presale</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Window</div>
                    <div className="mt-1 font-semibold">
                      {presaleStartISO ? formatLagos(presaleStartISO) : "—"} →{" "}
                      {presaleEndISO ? formatLagos(presaleEndISO) : "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Price</div>
                    <div className="mt-1 font-semibold">{presalePriceEtn || "—"} ETN</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Reserved supply</div>
                    <div className="mt-1 font-semibold">{Number.isFinite(presaleSupply) ? presaleSupply : "—"}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Allowlist size</div>
                    <div className="mt-1 font-semibold">
                      {Number.isFinite(allowlistCount) ? allowlistCount : "—"}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Merkle root</div>
                    <div className="mt-1 font-mono text-xs break-all">{merkleRoot || "—"}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Back
              </Button>
              <Button type="button" onClick={onConfirm}>
                Confirm &amp; deploy
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
