// components/create/single-erc721/single-deploy-success-modal.tsx
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react";
import Image from "next/image";
import { CheckCircle2, Copy, ExternalLink, X } from "lucide-react";

import { cn, shortenAddress } from "@/src/lib/utils";
import { Button } from "@/src/ui/Button"; // adjust if your revamped Button path differs

type Props = {
  open: boolean;
  name: string;
  /** Thumbnail or image for the NFT (optional) */
  mediaUrl?: string;
  /** Deployed contract address */
  contract: string;
  /** Optional, shown as a reference + explorer link */
  txHash?: string;
  /** Token ID (defaults to 1 for single mints) */
  tokenId?: number | string;

  /** Primary CTA: view the NFT details page */
  onViewNft: () => void;

  /** Secondary CTA: open the contract page within your app */
  onOpenContract: () => void;

  /** Optional extra CTA: list/sell flow (hidden if not provided) */
  onListForSale?: () => void;

  /** Close handler (kept for parity with other modals) */
  onClose: () => void;
};

export default function SingleDeploySuccessModal({
  open,
  name,
  mediaUrl,
  contract,
  txHash,
  tokenId = 1,
  onViewNft,
  onOpenContract,
  onListForSale,
  onClose,
}: Props) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // locked: no escape close
      if (e.key === "Escape") e.preventDefault();
    }
    if (open) window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true } as any);
  }, [open]);

  async function copyAddr() {
    try {
      if (!contract) return;
      await navigator.clipboard.writeText(contract);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-80"
      aria-modal="true"
      role="dialog"
      aria-label="NFT minted"
    >
      {/* Backdrop (locked) */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Center container */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cn(
            "relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl",
            "ring-1 ring-black/10"
          )}
          onMouseDown={(e) => {
            // prevent “click outside to close” by swallowing events
            e.stopPropagation();
          }}
        >
          {/* Top stripe */}
          <div className="h-1 w-full bg-[linear-gradient(90deg,var(--accent),color-mix(in_oklab,var(--accent)_60%,transparent),var(--accent))]" />

          {/* Close button (still explicit, but you can remove if you want it 100% locked) */}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl",
              "border border-border bg-background/60 text-foreground",
              "hover:bg-background transition"
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4 opacity-80" />
          </button>

          <div className="p-6">
            {/* Success icon */}
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full border border-foreground/10 bg-foreground/5 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </div>

            {/* Media + name */}
            <div className="mt-4 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl overflow-hidden border border-border bg-background/50">
                {mediaUrl ? (
                  <Image
                    src={mediaUrl}
                    alt={name || "NFT"}
                    width={64}
                    height={64}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 flex items-center justify-center text-xs text-muted-foreground">
                    No media
                  </div>
                )}
              </div>

              <h2 className="mt-3 text-xl md:text-2xl font-semibold tracking-tight">
                {name || "NFT Minted"}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Your single NFT is live on-chain{typeof tokenId !== "undefined" ? ` (Token #${tokenId})` : ""}.
              </p>
            </div>

            {/* Contract row */}
            {contract ? (
              <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                  Contract address
                </div>

                <div className="flex items-start gap-2">
                  <code className="text-sm break-all leading-5">{contract}</code>

                  <button
                    type="button"
                    onClick={copyAddr}
                    className={cn(
                      "ml-auto inline-flex h-9 w-9 items-center justify-center rounded-2xl",
                      "border border-border bg-card hover:bg-background transition"
                    )}
                    aria-label="Copy address"
                    title={copied ? "Copied" : "Copy"}
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4 opacity-80" />
                    )}
                  </button>

                  <a
                    href={`https://blockexplorer.electroneum.com/address/${contract}`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-2xl",
                      "border border-border bg-card hover:bg-background transition"
                    )}
                    aria-label="Open contract in explorer"
                    title="Explorer"
                  >
                    <ExternalLink className="h-4 w-4 opacity-80" />
                  </a>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  Short: <span className="font-mono">{shortenAddress(contract, 6, 4)}</span>
                </div>
              </div>
            ) : null}

            {/* Tx row */}
            {txHash ? (
              <div className="mt-3 rounded-2xl border border-border bg-background/40 p-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                  Transaction
                </div>

                <div className="flex items-start gap-2">
                  <code className="text-sm break-all leading-5">{txHash}</code>

                  <a
                    href={`https://blockexplorer.electroneum.com/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "ml-auto inline-flex h-9 w-9 items-center justify-center rounded-2xl",
                      "border border-border bg-card hover:bg-background transition"
                    )}
                    aria-label="Open tx in explorer"
                    title="Explorer"
                  >
                    <ExternalLink className="h-4 w-4 opacity-80" />
                  </a>
                </div>
              </div>
            ) : null}

            {/* Actions */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={onViewNft} className="w-full" disabled={!contract}>
                View NFT
              </Button>

              <Button variant="outline" onClick={onOpenContract} className="w-full" disabled={!contract}>
                Open contract
              </Button>

              {onListForSale ? (
                <Button
                  variant="secondary"
                  onClick={onListForSale}
                  className="w-full sm:col-span-2"
                  disabled={!contract}
                >
                  List for sale
                </Button>
              ) : null}

              <Button
                variant="ghost"
                onClick={onClose}
                className="w-full sm:col-span-2 h-11 rounded-2xl"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}