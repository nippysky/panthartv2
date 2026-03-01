// components/create/single-erc1155/Single1155DeploySuccessModal.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";

import { Modal } from "@/src/ui/Modal";
import { Button } from "@/src/ui/Button";
import { IconButton } from "@/src/ui/IconButton";
import { cn } from "@/src/lib/utils";

type Props = {
  open: boolean;
  name: string;
  mediaUrl?: string;
  contract: string;
  txHash?: string;
  tokenId?: number | string;

  onViewNft: () => void;
  onOpenContract: () => void;
  onClose: () => void;

  onListForSale?: () => void;
};

export default function Single1155DeploySuccessModal({
  open,
  name,
  mediaUrl,
  contract,
  txHash,
  tokenId = 1,
  onViewNft,
  onOpenContract,
  onClose,
  onListForSale,
}: Props) {
  const [copied, setCopied] = React.useState(false);

  async function copyAddr() {
    try {
      if (!contract) return;
      await navigator.clipboard.writeText(contract);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  // Your Modal component likely supports open/onClose.
  // If your Modal API differs, adjust these two props only.
  return (
    <Modal open={open} onClose={() => {}}>
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl",
          "ring-1 ring-black/10"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* top stripe */}
        <div className="h-1 w-full bg-linear-to-r from-emerald-400 via-cyan-400 to-violet-400" />

        <div className="p-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl overflow-hidden border border-border bg-background/40">
              {mediaUrl ? (
                <Image
                  src={mediaUrl}
                  alt={name || "NFT"}
                  width={64}
                  height={64}
                  className="h-16 w-16 object-cover"
                />
              ) : (
                <div className="h-16 w-16 flex items-center justify-center text-xs text-muted">
                  No media
                </div>
              )}
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {name || "Single Edition Live"}
            </h2>

            <p className="mt-1 text-sm text-muted">
              Your ERC-1155 single is live on-chain
              {typeof tokenId !== "undefined" ? ` (Token #${tokenId})` : ""}.
            </p>
          </div>

          {contract ? (
            <div className="mt-5 rounded-2xl border border-border bg-background/40 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted mb-1">
                Contract address
              </div>

              <div className="flex items-center gap-2">
                <code className="text-sm break-all">{contract}</code>

                <IconButton onClick={copyAddr} aria-label="Copy address" className="h-9 w-9 rounded-2xl">
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </IconButton>

                <a
                  href={`https://blockexplorer.electroneum.com/address/${contract}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card hover:bg-background/60 transition"
                  aria-label="Open in explorer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ) : null}

          {txHash ? (
            <div className="mt-3 rounded-2xl border border-border bg-background/40 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Transaction</div>
              <div className="flex items-center gap-2">
                <code className="text-sm break-all">{txHash}</code>
                <a
                  href={`https://blockexplorer.electroneum.com/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card hover:bg-background/60 transition"
                  aria-label="Open tx"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={onViewNft} className="w-full" disabled={!contract}>
              Mint Now
            </Button>

            <Button variant="outline" onClick={onOpenContract} className="w-full" disabled={!contract}>
              Open contract
            </Button>

            {onListForSale ? (
              <Button variant="secondary" onClick={onListForSale} className="w-full sm:col-span-2">
                List for sale
              </Button>
            ) : null}

            <Button variant="ghost" onClick={onClose} className="w-full sm:col-span-2">
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}