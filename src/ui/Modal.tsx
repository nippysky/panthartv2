"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

type ModalSize = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-xl",
  xl: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  zIndex = 1000,
  closeOnBackdrop = true,
  closeOnEsc = true,

  // ✅ NEW: force the panel to never grow beyond this.
  // The body becomes scrollable automatically.
  scroll = true,
  size = "md",
  maxHeightClass = "max-h-[78vh]",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  zIndex?: number;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;

  scroll?: boolean;
  size?: ModalSize;
  maxHeightClass?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEsc) onClose();
    };

    window.addEventListener("keydown", onKey);

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open, onClose, closeOnEsc]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (!closeOnBackdrop) return;
          if (e.target === e.currentTarget) onClose();
        }}
      />

      {/* Panel */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 w-[92vw] -translate-x-1/2 -translate-y-1/2",
          sizeMap[size],
          "rounded-3xl border border-border bg-card text-foreground shadow-2xl",
          // ✅ The magic: hard cap height + flex column
          scroll ? cn(maxHeightClass, "flex flex-col overflow-hidden") : "p-5 sm:p-6",
          className
        )}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header (fixed) */}
        {title ? (
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              scroll ? "px-5 py-4 border-b border-border" : "mb-4"
            )}
          >
            <div className="text-base font-semibold">{title}</div>
            <button
              onClick={onClose}
              type="button"
              className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-card transition"
            >
              Close
            </button>
          </div>
        ) : null}

        {/* Body (scrolls ONLY when scroll=true) */}
        {scroll ? (
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>,
    document.body
  );
}