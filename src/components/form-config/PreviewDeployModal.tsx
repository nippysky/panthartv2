/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";

import { Button } from "@/src/ui/Button";
import { formatNumber } from "@/src/lib/utils";

function formatUsd(n?: number | null) {
  if (n == null || !isFinite(n)) return "—";
  try {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
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
  confirming?: boolean;

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

function InfoCard({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-border bg-background/70 p-4 ${className}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 min-w-0">{children}</div>
    </div>
  );
}

export default function PreviewDeployModal({
  open,
  onClose,
  onConfirm,
  confirming = false,

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirming) onClose();
    };

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, confirming]);

  if (!mounted || !open) return null;

  const modal = (
    <div className="fixed inset-0 z-9999">
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close modal"
        onClick={confirming ? undefined : onClose}
        disabled={confirming}
        className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
      />

      {/* viewport-centered shell */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-deploy-title"
          aria-busy={confirming}
          className={[
            "relative w-full",
            "max-w-170",
            "max-h-[min(88vh,820px)]",
            "overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_20px_80px_rgba(0,0,0,0.18)]",
            "animate-in fade-in zoom-in-95 duration-200",
          ].join(" ")}
        >
          {/* header */}
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <h2
                id="preview-deploy-title"
                className="text-base sm:text-lg font-semibold tracking-tight"
              >
                Review &amp; confirm
              </h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Double-check the collection details before deploying your drop.
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full"
              onClick={onClose}
              aria-label="Close modal"
              disabled={confirming}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* internal scroll area */}
          <div
            className="max-h-[calc(min(88vh,820px)-73px)] overflow-y-auto"
            style={{
              paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
            }}
          >
            {(coverUrl || logoUrl) && (
              <div className="border-b border-border bg-background/40">
                {coverUrl ? (
                  <div className="relative h-24 sm:h-28 w-full overflow-hidden">
                    <Image
                      src={coverUrl}
                      alt="Cover"
                      fill
                      className="object-cover"
                      sizes="680px"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/15 via-black/5 to-transparent" />
                  </div>
                ) : null}

                <div className="px-4 sm:px-5">
                  <div className={coverUrl ? "-mt-7" : "pt-4"}>
                    {logoUrl ? (
                      <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
                        <Image
                          src={logoUrl}
                          alt="Logo"
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="pb-4 pt-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="text-base sm:text-lg font-semibold tracking-tight wrap-break-word">
                          {name || "Untitled Collection"}
                        </div>
                        <span className="text-muted-foreground">·</span>
                        <div className="text-sm font-medium text-muted-foreground wrap-break-word">
                          {symbol || "—"}
                        </div>
                      </div>

                      {description ? (
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap wrap-break-word">
                          {description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              {baseUriWarning ? (
                <div className="rounded-2xl border border-yellow-600/35 bg-yellow-600/10 px-4 py-3 text-sm text-yellow-300">
                  {baseUriWarning}
                </div>
              ) : null}

              {confirming ? (
                <div className="rounded-2xl border border-brand/20 bg-brand/8 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        Preparing deployment…
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        Please wait and confirm the transaction in your wallet. Other actions are temporarily disabled.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* fee */}
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Platform fee</div>
                    <div className="mt-1 text-sm text-muted-foreground break-all">
                      Payable to{" "}
                      <span className="font-mono text-[12px] sm:text-sm">
                        {feeRecipient || "—"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      ≈ {formatUsd(feeAmountUsdApprox)} · Last updated {feeLastUpdatedLabel}
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold self-start sm:self-auto">
                    {formatNumber(Number(feeAmountEtn || 0))}
                    <Image src="/ETN_LOGO.png" alt="ETN" width={16} height={16} />
                  </div>
                </div>
              </div>

              {/* core */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoCard label="Collection">
                  <div className="font-semibold wrap-break-word">
                    {name || "—"}{" "}
                    <span className="text-muted-foreground font-normal">·</span>{" "}
                    {symbol || "—"}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">Supply</div>
                  <div className="mt-1 font-semibold">
                    {Number.isFinite(totalSupply) ? totalSupply : "—"}
                  </div>
                </InfoCard>

                <InfoCard label="Royalties">
                  <div className="font-semibold">
                    {Number.isFinite(royaltyPercent) ? royaltyPercent : "—"}%
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">Recipient</div>
                  <div className="mt-1 font-mono text-[12px] break-all">
                    {royaltyRecipient || "—"}
                  </div>
                </InfoCard>

                <InfoCard label="Public sale" className="md:col-span-2">
                  <div className="font-semibold wrap-break-word">
                    {formatLagos(publicStartISO)} · {publicPriceEtn || "—"} ETN
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {Number.isFinite(maxPerWallet) ? maxPerWallet : "—"} per wallet ·{" "}
                    {Number.isFinite(maxPerTx) ? maxPerTx : "—"} per txn
                  </div>
                </InfoCard>

                <InfoCard label="Base URI" className="md:col-span-2">
                  <div className="font-mono text-[12px] break-all">
                    {baseUri || "—"}
                  </div>
                </InfoCard>
              </div>

              {enablePresale ? (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="text-sm font-semibold">Presale</div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfoCard label="Window">
                      <div className="font-semibold wrap-break-word">
                        {presaleStartISO ? formatLagos(presaleStartISO) : "—"}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground wrap-break-word">
                        → {presaleEndISO ? formatLagos(presaleEndISO) : "—"}
                      </div>
                    </InfoCard>

                    <InfoCard label="Price">
                      <div className="font-semibold">
                        {presalePriceEtn || "—"} ETN
                      </div>
                    </InfoCard>

                    <InfoCard label="Reserved supply">
                      <div className="font-semibold">
                        {Number.isFinite(presaleSupply) ? presaleSupply : "—"}
                      </div>
                    </InfoCard>

                    <InfoCard label="Allowlist size">
                      <div className="font-semibold">
                        {Number.isFinite(allowlistCount) ? allowlistCount : "—"}
                      </div>
                    </InfoCard>

                    <InfoCard label="Merkle root" className="md:col-span-2">
                      <div className="font-mono text-[12px] break-all">
                        {merkleRoot || "—"}
                      </div>
                    </InfoCard>
                  </div>
                </div>
              ) : null}

              {!coverUrl && !logoUrl && description ? (
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Description
                  </div>
                  <div className="mt-2 text-sm whitespace-pre-wrap wrap-break-word text-foreground/90">
                    {description}
                  </div>
                </div>
              ) : null}
            </div>

            {/* sticky footer */}
            <div
              className="sticky bottom-0 border-t border-border bg-card/95 backdrop-blur px-4 py-4 sm:px-5"
              style={{
                paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
              }}
            >
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  className="w-full sm:w-auto"
                  disabled={confirming}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={onConfirm}
                  className="w-full sm:w-auto"
                  disabled={confirming}
                >
                  {confirming ? "Preparing…" : "Confirm & deploy"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}