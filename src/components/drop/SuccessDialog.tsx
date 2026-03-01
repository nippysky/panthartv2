"use client";

import * as React from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

import { Button } from "@/src/ui/Button";
import { Modal } from "@/src/ui/Modal";

type KV = {
  label: string;
  value: string;
  display?: string;
  href?: string;
};

type SuccessDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  items: KV[];
  proceedLabel?: string;
  onProceed: () => void;
  zIndex?: number;
};

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

export function SuccessDialog({
  open,
  title,
  description,
  items,
  proceedLabel = "Proceed",
  onProceed,
  zIndex = 1_000_050,
}: SuccessDialogProps) {
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);

  return (
    <Modal
      open={open}
      // locked: only proceed closes it (parent controls open)
      onClose={() => {}}
      title={title}
      zIndex={zIndex}
      className="max-w-lg"
    >
      {description ? (
        <div className="text-sm text-muted-foreground">{description}</div>
      ) : null}

      <div className="mt-4 space-y-3">
        {items.map((item, idx) => {
          const visible = item.display ?? item.value;
          return (
            <div
              key={`${item.label}-${idx}`}
              className="rounded-2xl border border-border bg-background p-3 flex items-start gap-3"
            >
              <div className="min-w-28 text-xs uppercase tracking-wide text-muted pt-1">
                {item.label}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm break-all">{visible}</code>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={async () => {
                      const ok = await copyToClipboard(visible);
                      if (!ok) return;
                      setCopiedIdx(idx);
                      window.setTimeout(() => setCopiedIdx(null), 1200);
                    }}
                    aria-label={`Copy ${item.label}`}
                  >
                    {copiedIdx === idx ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>

                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-border bg-card hover:bg-background/60 transition"
                      aria-label={`Open ${item.label}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onProceed} className="px-6">
          {proceedLabel}
        </Button>
      </div>
    </Modal>
  );
}