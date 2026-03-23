"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  ConnectButton,
  darkTheme,
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
} from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";

import { client } from "@/src/lib/client";
import { electroneumChain } from "@/src/lib/chain";
import { isDecentWalletEnv, useDecentWalletAccount } from "@/src/lib/decentWallet";

const wallets = [createWallet("io.metamask"), createWallet("io.rabby")];
const recommendedWallets = [createWallet("io.metamask"), createWallet("io.rabby")];

function shorten(addr: string) {
  return addr.length <= 12 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Dropdown Menu for Thirdweb connected state
function ThirdwebDropdown({
  address,
  onClose,
  onCopy,
  onDisconnect,
}: {
  address: string;
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

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-2 z-50 min-w-70 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
    >
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-muted font-medium">Connected Wallet</p>
            <p className="text-sm font-semibold text-foreground">
              {shorten(address)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted">External wallet connected</p>
      </div>

      <div className="py-2">
        <button
          onClick={onCopy}
          className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-background/60 transition-colors flex items-center gap-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>Disconnect</span>
        </button>
      </div>

      <div className="px-4 py-3 bg-background/50 border-t border-border">
        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Full Address</p>
        <p className="text-xs text-foreground font-mono break-all">{address}</p>
      </div>
    </motion.div>
  );
}

export default function ConnectWallet() {
  const { theme } = useTheme();
  const dw = useDecentWalletAccount();
  const inDW = isDecentWalletEnv();
  const thirdwebAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [isOpen, setIsOpen] = useState(false);

  const address = useMemo(() => {
    if (inDW) return dw.address;
    return thirdwebAccount?.address ?? null;
  }, [inDW, dw.address, thirdwebAccount?.address]);

  const connected = !!address;

  const copyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // ignore
    }
    setIsOpen(false);
  }, [address]);

  const doDisconnect = useCallback(() => {
    if (inDW) {
      setIsOpen(false);
      return;
    }
    if (activeWallet) {
      disconnect(activeWallet);
    }
    setIsOpen(false);
  }, [activeWallet, disconnect, inDW]);

  const connectDW = useCallback(async () => {
    if (!inDW) return;
    await dw.connect();
  }, [dw, inDW]);

  const label = useMemo(() => {
    if (!address) return "Connect wallet";
    return shorten(address);
  }, [address]);

  // Connected state with dropdown
  if (connected) {
    return (
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
          <span>{label}</span>
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
            <ThirdwebDropdown
              address={address}
              onClose={() => setIsOpen(false)}
              onCopy={copyAddress}
              onDisconnect={doDisconnect}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Not connected - Decent Wallet
  if (inDW) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={connectDW}
        disabled={!dw.ready}
        className="h-10 rounded-full bg-linear-to-r from-emerald-500 to-emerald-600 px-5 text-sm font-semibold text-white shadow-lg hover:shadow-emerald-500/25 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {dw.ready ? "Connect Wallet" : "Loading..."}
      </motion.button>
    );
  }

  // Not connected - Thirdweb
  return (
    <ConnectButton
      client={client}
      chain={electroneumChain}
      wallets={wallets}
      recommendedWallets={recommendedWallets}
      connectModal={{
        size: "compact",
        title: "Connect Wallet",
        showThirdwebBranding: false,
      }}
      theme={darkTheme({
        colors: {
          accentText: theme === "light" ? "#131418" : "#4DEE54",
          accentButtonBg: theme === "light" ? "#131418" : "#4DEE54",
          modalBg: theme === "light" ? "#ffffff" : "#131418",
          primaryText: theme === "light" ? "#000000" : "#ffffff",
          primaryButtonBg: theme === "light" ? "#131418" : "#4DEE54",
          primaryButtonText: theme === "light" ? "#ffffff" : "#131418",
          tertiaryBg: theme === "light" ? "#F5F5F5" : "#000000",
          secondaryButtonBg: theme === "light" ? "#f5f5f5" : "#000000",
          secondaryButtonText: theme === "light" ? "#131418" : "#ffffff",
          connectedButtonBg: theme === "light" ? "#F5F5F5" : "#131418",
          connectedButtonBgHover: theme === "light" ? "#ffffff" : "#000000",
          borderColor: theme === "light" ? "#E5E5E5" : "#FFFFFF1A",
        },
        fontFamily: "Lexend",
      })}
    />
  );
}