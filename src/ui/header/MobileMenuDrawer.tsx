// src/ui/app/header/MobileMenuDrawer.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

import { Container } from "@/src/ui/Container";
import { Button } from "@/src/ui/Button";
import { IconButton } from "@/src/ui/IconButton";
import { ThemeToggle } from "@/src/ui/ThemeToggle";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function shortAddr(a?: string | null) {
  const s = (a ?? "").trim();
  if (!s) return "—";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

type TriggerEl = React.ReactElement<React.ComponentPropsWithoutRef<"button">>;

export function MobileMenuDrawer({
  address,
  trigger,
}: {
  address: string;
  trigger: TriggerEl;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [open, setOpen] = React.useState(false);
  const [render, setRender] = React.useState(false);

  // Mount/unmount with exit animation
  React.useEffect(() => {
    if (open) {
      setRender(true);
      return;
    }
    const t = window.setTimeout(() => setRender(false), 220);
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape to close
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock scroll while open
  React.useEffect(() => {
    if (!open) return;

    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  const navLinks = React.useMemo(
    () => [
      { name: "Collections", href: "/collections" },
      { name: "Minting Now", href: "/minting-now" },
      { name: "Active Listings", href: "/listings" },
      { name: "Live Auctions", href: "/auction-now" },
      { name: "Submit Collection", href: "/submit-collection" },
      { name: "Profile", href: `/profile/${address}` },
    ],
    [address]
  );

  // ✅ No wrapper button. We CLONE the trigger and inject toggle behavior.
  const triggerWithHandlers = React.cloneElement(trigger, {
    type: trigger.props.type ?? "button",
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    onClick: (e) => {
      trigger.props.onClick?.(e);
      setOpen((v) => !v);
    },
  });

  const close = React.useCallback(() => setOpen(false), []);

  const copyAddress = React.useCallback(async () => {
    const a = (address ?? "").trim();
    if (!a) return;
    try {
      await navigator.clipboard.writeText(a);
      toast.success("Wallet copied");
    } catch {
      toast.error("Could not copy");
    }
  }, [address]);

  if (!mounted) return triggerWithHandlers;

  const overlay = render
    ? createPortal(
        <div className="fixed inset-0 z-160">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className={cx(
              "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
              open ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            className={cx(
              "absolute right-0 top-0 h-dvh w-full sm:w-105",
              "border-l border-border bg-background shadow-2xl",
              "transition-transform duration-200 will-change-transform",
              open ? "translate-x-0" : "translate-x-full"
            )}
            style={{
              paddingTop: "max(env(safe-area-inset-top, 0px), 12px)",
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
            }}
          >
            {/* Top bar */}
            <div className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
              <Container className="flex h-16 items-center justify-between">
                <Link href="/" onClick={close} className="inline-flex items-center gap-2">
                  <Image
                    src="/DECENT-ICON.png"
                    alt="Decentroneum"
                    width={28}
                    height={28}
                    priority
                  />
                  <span className="text-sm font-semibold tracking-tight">Panthart</span>
                </Link>

                <IconButton aria-label="Close menu" onClick={close}>
                  <X className="h-5 w-5 cursor-pointer" />
                </IconButton>
              </Container>
            </div>

            {/* Content */}
            <div className="h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
              <Container className="py-5">
                {/* Wallet row (makes it feel “real” + fixes emptiness) */}
                <div className="rounded-3xl border border-border bg-card/60 p-4 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                        Connected wallet
                      </div>
                      <div className="mt-1 flex items-center gap-2 min-w-0">
                        <span className="truncate font-mono text-sm text-foreground">
                          {address ? shortAddr(address) : "Not connected"}
                        </span>
                      </div>
                    </div>

                    <IconButton
                      aria-label="Copy wallet address"
                      title="Copy"
                      onClick={copyAddress}
                      disabled={!address}
                      className="h-10 w-10 rounded-full"
                    >
                      <Copy className="h-4 w-4" />
                    </IconButton>
                  </div>

                  <div className="mt-4">
                    <Link href="/create" onClick={close}>
                      <Button variant="primary" size="lg" className="w-full justify-center">
                        Create
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Nav list (Apple clean rows) */}
                <div className="mt-5 rounded-3xl border border-border bg-card/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/60">
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                      Browse
                    </div>
                  </div>

                  <nav className="divide-y divide-border/60">
                    {navLinks.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={close}
                        className={cx(
                          "flex items-center justify-between gap-3",
                          "px-4 py-4",
                          "text-sm font-semibold",
                          "bg-transparent hover:bg-card/60 transition"
                        )}
                      >
                        <span className="text-foreground/90">{l.name}</span>
                        <span className="text-muted">→</span>
                      </Link>
                    ))}
                  </nav>
                </div>

                {/* Preferences (clean, no ugly wrap) */}
                <div className="mt-5 rounded-3xl border border-border bg-card/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/60">
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                      Preferences
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Theme</div>
                        <div className="mt-1 text-xs text-muted leading-relaxed">
                          Choose light, dark, or system.
                        </div>
                      </div>

                      {/* ✅ “control dock” – looks intentional */}
                      <div className="rounded-full border border-border bg-background/70 px-2 py-2 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="shrink-0 overflow-x-auto max-w-full">
                          <ThemeToggle />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Utilities */}
                <div className="mt-5 rounded-3xl border border-border bg-card/30 overflow-hidden">
                  <a
                    href="https://docs.panth.art"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 px-4 py-4 text-sm font-semibold hover:bg-card/60 transition"
                  >
                    <span className="text-foreground/90">Documentation</span>
                    <ExternalLink className="h-4 w-4 text-muted" />
                  </a>
                </div>

                {/* Bottom breathing room */}
                <div
                  aria-hidden
                  style={{ height: "max(env(safe-area-inset-bottom, 0px), 24px)" }}
                />
              </Container>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {triggerWithHandlers}
      {overlay}
    </>
  );
}