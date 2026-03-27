/* eslint-disable @typescript-eslint/no-explicit-any */
// src/ui/app/header/MobileMenuDrawer.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { ethers } from "ethers";
import {
  BookOpen,
  Copy,
  ExternalLink,
  Gavel,
  Gamepad2,
  Layers3,
  Sparkles,
  User2,
  Wallet,
  X,
  ChevronRight,
  Coins,
} from "lucide-react";
import { toast } from "sonner";

import { Container } from "@/src/ui/Container";
import { Button } from "@/src/ui/Button";
import { IconButton } from "@/src/ui/IconButton";
import { ThemeToggle } from "@/src/ui/ThemeToggle";
import { formatNumber } from "@/src/lib/utils";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function shortAddr(a?: string | null) {
  const s = (a ?? "").trim();
  if (!s) return "—";
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function formatBalanceDisplay(value: string, maxDp = 4) {
  const s = String(value || "0").trim();
  if (!s || s === "NaN") return "0";

  const [whole, frac = ""] = s.split(".");
  if (!frac) return whole;

  const trimmed = frac.slice(0, maxDp).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

type TriggerEl = React.ReactElement<React.ComponentPropsWithoutRef<"button">>;

const DCNT_TOKEN_ADDRESS = "0xE74e4E7A064310466f3bdBd3F3Ce4e8c8F7CF1d5" as const;

const ERC20_MIN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

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

  const [balances, setBalances] = React.useState<{
    native: string;
    dcnt: string;
    dcntSymbol: string;
    loading: boolean;
  }>({
    native: "0",
    dcnt: "0",
    dcntSymbol: "DCNT",
    loading: false,
  });

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

  React.useEffect(() => {
    let cancelled = false;

    async function loadBalances() {
      const wallet = (address ?? "").trim();
      if (!wallet || !ethers.isAddress(wallet) || typeof window === "undefined") {
        if (!cancelled) {
          setBalances({
            native: "0",
            dcnt: "0",
            dcntSymbol: "DCNT",
            loading: false,
          });
        }
        return;
      }

      const eth = (window as any)?.ethereum;
      if (!eth) {
        if (!cancelled) {
          setBalances((prev) => ({
            ...prev,
            native: "0",
            dcnt: "0",
            loading: false,
          }));
        }
        return;
      }

      if (!cancelled) {
        setBalances((prev) => ({ ...prev, loading: true }));
      }

      try {
        const provider = new ethers.BrowserProvider(eth);
        const token = new ethers.Contract(DCNT_TOKEN_ADDRESS, ERC20_MIN_ABI, provider);

        const [nativeBal, dcntBalRaw, dcntDecimals, dcntSymbol] = await Promise.all([
          provider.getBalance(wallet),
          token.balanceOf(wallet).catch(() => BigInt(0)),
          token.decimals().catch(() => 18),
          token.symbol().catch(() => "DCNT"),
        ]);

        if (cancelled) return;

        setBalances({
          native: formatBalanceDisplay(ethers.formatEther(nativeBal), 4),
          dcnt: formatBalanceDisplay(ethers.formatUnits(dcntBalRaw, Number(dcntDecimals || 18)), 4),
          dcntSymbol: String(dcntSymbol || "DCNT"),
          loading: false,
        });
      } catch {
        if (cancelled) return;
        setBalances({
          native: "0",
          dcnt: "0",
          dcntSymbol: "DCNT",
          loading: false,
        });
      }
    }

    void loadBalances();

    return () => {
      cancelled = true;
    };
  }, [address, open]);

  const navLinks = React.useMemo(
    () => [
      { name: "Collections", href: "/collections", icon: BookOpen },
      { name: "Minting Now", href: "/minting-now", icon: Sparkles },
      { name: "Active Listings", href: "/listings", icon: Layers3 },
      { name: "Live Auctions", href: "/auction-now", icon: Gavel },
      { name: "Comrades Warpool", href: "/comrades-warpool", icon: Gamepad2 },
      { name: "Profile", href: `/profile/${address}`, icon: User2 },
    ],
    [address]
  );

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
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className={cx(
              "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
              open ? "opacity-100" : "opacity-0"
            )}
          />

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

            <div className="h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
              <Container className="py-5">
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

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/70 bg-background/60 px-3 py-3">
                      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                        <Wallet className="h-3.5 w-3.5" />
                        ETN balance
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground">
                        {balances.loading ? "Loading..." : `${formatNumber(Number(balances.native))} ETN`}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/60 px-3 py-3">
                      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                        <Coins className="h-3.5 w-3.5" />
                        {balances.dcntSymbol}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground">
                        {balances.loading ? "Loading..." : `${formatNumber(Number(balances.dcnt))} ${balances.dcntSymbol}`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Link href="/create" onClick={close}>
                      <Button variant="primary" size="lg" className="w-full justify-center">
                        Create
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-border bg-card/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/60">
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                      Browse
                    </div>
                  </div>

                  <nav className="divide-y divide-border/60">
                    {navLinks.map((l) => {
                      const Icon = l.icon;

                      return (
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
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background/70">
                              <Icon className="h-4.5 w-4.5 text-foreground/85" />
                            </span>
                            <span className="truncate text-foreground/90">{l.name}</span>
                          </div>

                          <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                <div className="mt-5 rounded-3xl border border-border bg-card/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/60">
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                      Preferences
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <div className="rounded-full border border-border bg-background/70 px-2 py-2 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="shrink-0 overflow-x-auto max-w-full">
                          <ThemeToggle />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

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