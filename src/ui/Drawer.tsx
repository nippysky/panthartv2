"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

export function Drawer({
  open,
  onClose,
  side = "right",
  title,
  children,
  className,
  zIndex = 1000,
}: {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left";
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

  const sideClasses =
    side === "right"
      ? "right-0 translate-x-0"
      : "left-0 translate-x-0";

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex }}>
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute top-0 h-full w-[92vw] max-w-xl",
          "border border-border bg-card text-foreground shadow-2xl",
          "rounded-l-3xl",
          side === "left" ? "rounded-l-none rounded-r-3xl" : "",
          sideClasses,
          className
        )}
      >
        {title ? (
          <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-border flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{title}</div>
            <button
              onClick={onClose}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-card"
            >
              Close
            </button>
          </div>
        ) : null}
        <div className="h-[calc(100%-72px)] overflow-y-auto px-6 sm:px-8 py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
