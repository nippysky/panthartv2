// src/ui/WalletPill.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import ConnectWallet from "@/src/ui/connectWallet";
import { useUnifiedWallet } from "@/src/providers/UnifiedWalletProvider";
import { isDecentWalletEnv } from "@/src/lib/decentWallet";

function shorten(addr: string) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ToastPortal({ show, message }: { show: boolean; message: string }) {
  const [portalReady, setPortalReady] = React.useState(false);

  React.useEffect(() => setPortalReady(true), []);
  if (!portalReady) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : 20 }}
      transition={{ duration: 0.2 }}
      style={{ zIndex: 9999 }}
      className="fixed left-1/2 bottom-6 -translate-x-1/2"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur-sm">
        {message}
      </div>
    </motion.div>,
    document.body
  );
}

function WalletDropdown({
  address,
  walletType,
  onClose,
  onCopy,
  onDisconnect,
}: {
  address: string;
  walletType: "decent" | "thirdweb" | null;
  onClose: () => void;
  onCopy: () => void;
  onDisconnect: () => void;
}) {
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const walletLabel = walletType === "decent" 
    ? "Decent Wallet (in-app browser)" 
    : "External wallet connected";

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute right-0 top-full mt-2 z-50 min-w-70 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
    >
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Connected Wallet</p>
            <p className="text-sm font-semibold text-foreground">
              {shorten(address)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted">{walletLabel}</p>
      </div>

      <div className="py-2">
        <button
          onClick={onCopy}
          className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-background/60 transition-colors flex items-center gap-3 group"
        >
          <svg
            className="w-4 h-4 text-muted group-hover:text-foreground transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            />
          </svg>
          <span>Copy address</span>
        </button>

        <button
          onClick={onDisconnect}
          disabled={walletType === "decent"}
          className={`
            w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors group
            ${
              walletType === "decent"
                ? "text-muted cursor-not-allowed opacity-60"
                : "text-red-500 hover:bg-red-500/10"
            }
          `}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>
            {walletType === "decent" ? "Disconnect in wallet menu" : "Disconnect"}
          </span>
        </button>
      </div>

      <div className="px-4 py-3 bg-background/50 border-t border-border">
        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">
          Full Address
        </p>
        <p className="text-xs text-foreground font-mono break-all">{address}</p>
      </div>
    </motion.div>
  );
}

export default function WalletPill() {
  const unifiedWallet = useUnifiedWallet();
  const [mounted, setMounted] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [toast, setToast] = React.useState<{ show: boolean; msg: string }>({
    show: false,
    msg: "",
  });
  const toastTimer = React.useRef<number | null>(null);

  React.useEffect(() => setMounted(true), []);

  const showToast = React.useCallback((msg: string) => {
    setToast({ show: true, msg });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, 1800);
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const handleCopy = React.useCallback(async () => {
    const success = await unifiedWallet.copyAddress();
    showToast(success ? "Address copied" : "Copy failed");
    setIsOpen(false);
  }, [unifiedWallet, showToast]);

  const handleDisconnect = React.useCallback(async () => {
    await unifiedWallet.disconnect();
    setIsOpen(false);
    showToast("Disconnected");
  }, [unifiedWallet, showToast]);

  // Loading skeleton
  if (!mounted || unifiedWallet.isLoading) {
    return (
      <>
        <div className="h-10 w-32 rounded-full border border-border bg-card/70 animate-pulse" />
        <ToastPortal show={toast.show} message={toast.msg} />
      </>
    );
  }

  // Not connected
  if (!unifiedWallet.isConnected) {
    return (
      <>
        {isDecentWalletEnv() ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => unifiedWallet.connect()}
            className="h-10 rounded-full bg-linear-to-r from-emerald-500 to-emerald-600 px-5 text-sm font-semibold text-white shadow-lg hover:shadow-emerald-500/25 transition-shadow"
          >
            Connect Wallet
          </motion.button>
        ) : (
          <ConnectWallet />
        )}
        <ToastPortal show={toast.show} message={toast.msg} />
      </>
    );
  }

  // Connected - Show wallet pill with dropdown
  return (
    <>
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`
            inline-flex items-center gap-2 h-10 px-3 rounded-full
            border border-border bg-card
            text-sm font-semibold text-foreground
            hover:bg-background/60 transition-all
            ${isOpen ? "ring-2 ring-emerald-500/50" : ""}
          `}
        >
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </div>
          <span className="tabular-nums">{shorten(unifiedWallet.address!)}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            <path fill="currentColor" d="M7 10l5 5l5-5z" />
          </svg>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <WalletDropdown
              address={unifiedWallet.address!}
              walletType={unifiedWallet.walletType}
              onClose={() => setIsOpen(false)}
              onCopy={handleCopy}
              onDisconnect={handleDisconnect}
            />
          )}
        </AnimatePresence>
      </div>

      <ToastPortal show={toast.show} message={toast.msg} />
    </>
  );
}