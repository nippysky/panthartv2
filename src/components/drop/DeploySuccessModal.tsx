"use client";

import * as React from "react";
import Image from "next/image";
import { CheckCircle2, Copy, ExternalLink, X } from "lucide-react";

import { Button } from "@/src/ui/Button";
import { Modal } from "@/src/ui/Modal";

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

type Props = {
  open: boolean;
  name: string;
  logoUrl?: string;
  contract: string;
  txHash?: string;
  onViewCollection: () => void;
  onGoToCollections: () => void;
  onClose: () => void;
  zIndex?: number;
};

export default function DeploySuccessModal({
  open,
  name,
  logoUrl,
  contract,
  txHash,
  onViewCollection,
  onGoToCollections,
  onClose,
  zIndex = 1_000_060,
}: Props) {
  const [copied, setCopied] = React.useState(false);

  return (
    <Modal
      open={open}
      // locked modal: ignore overlay/esc close (we provide explicit close button)
      onClose={() => {}}
      title="Deployment complete"
      zIndex={zIndex}
      className="max-w-md"
    >
      <div className="relative">
        {/* Close (explicit) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 -translate-y-2 translate-x-2 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card hover:bg-background/60 transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl overflow-hidden border border-border bg-background">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={name || "Collection"}
                width={64}
                height={64}
                className="h-16 w-16 object-cover"
              />
            ) : (
              <div className="h-16 w-16 flex items-center justify-center text-xs text-muted-foreground">
                No logo
              </div>
            )}
          </div>

          <h2 className="mt-3 text-xl font-semibold tracking-tight">
            {name || "Collection Deployed"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Your drop is live on-chain.</p>
        </div>

        {contract ? (
          <div className="mt-5 rounded-2xl border border-border bg-background p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Contract address
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm break-all">{contract}</code>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={async () => {
                  const ok = await copyToClipboard(contract);
                  if (!ok) return;
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1200);
                }}
                aria-label="Copy address"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>

              <a
                href={`https://blockexplorer.electroneum.com/address/${contract}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-border bg-card hover:bg-background/60 transition"
                aria-label="Open contract in explorer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        ) : null}

        {txHash ? (
          <div className="mt-3 rounded-2xl border border-border bg-background p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Transaction
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm break-all">{txHash}</code>
              <a
                href={`https://blockexplorer.electroneum.com/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-border bg-card hover:bg-background/60 transition"
                aria-label="Open tx in explorer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button onClick={onViewCollection} className="w-full" disabled={!contract}>
            View collection
          </Button>
          <Button variant="outline" onClick={onGoToCollections} className="w-full">
            Go to Collections
          </Button>
        </div>
      </div>
    </Modal>
  );
}