"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  zIndex = 1000,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  zIndex?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex }}>
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-3xl border border-border bg-card text-foreground shadow-2xl",
          "p-5 sm:p-6",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {title ? (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="text-base font-semibold">{title}</div>
            <button
              onClick={onClose}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-card"
            >
              Close
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  );
}
