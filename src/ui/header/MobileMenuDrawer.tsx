// src/ui/app/header/MobileMenuDrawer.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";

import { Container } from "@/src/ui/Container";
import { Button } from "@/src/ui/Button";
import { IconButton } from "@/src/ui/IconButton";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
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
      { name: "Explore", href: "/explore" },
      { name: "Collections", href: "/collections" },
      { name: "Minting Now", href: "/minting-now" },
      { name: "Live Auctions", href: "/auction" },
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
      setOpen((v) => !v); // toggle (hamburger closes too)
    },
  });

  if (!mounted) return triggerWithHandlers;

  const overlay = render
    ? createPortal(
        <div className="fixed inset-0 z-160">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
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
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2"
                >
                  <Image
                    src="/DECENT-ICON.png"
                    alt="Decentroneum"
                    width={28}
                    height={28}
                    priority
                  />
                  <span className="text-sm font-semibold tracking-tight">
                    Panthart
                  </span>
                </Link>

                <IconButton aria-label="Close menu" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5 cursor-pointer" />
                </IconButton>
              </Container>
            </div>

            {/* Content */}
            <div className="h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
              <Container className="py-4">
                <div className="mb-4">
                  <Button
                    href="/create"
                    variant="primary"
                    size="lg"
                    className="w-full justify-center"
                  >
                    Create
                  </Button>
                </div>

                <nav className="space-y-3">
                  {navLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={cx(
                        "block rounded-2xl border border-border bg-card/60",
                        "px-4 py-4 text-base font-semibold",
                        "transition hover:bg-card hover:border-foreground/15 active:scale-[0.99]"
                      )}
                    >
                      {l.name}
                    </Link>
                  ))}
                </nav>

                {/* Bottom breathing room */}
                <div
                  aria-hidden
                  style={{
                    height: "max(env(safe-area-inset-bottom, 0px), 24px)",
                  }}
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
