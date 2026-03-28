"use client";

import * as React from "react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";

export type WalletType = "decent" | "thirdweb" | null;

export interface UnifiedWalletState {
  address: string | null;
  walletType: WalletType;
  isConnected: boolean;
  isReady: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  copyAddress: () => Promise<boolean>;
}

const UnifiedWalletContext = React.createContext<UnifiedWalletState | null>(null);

const ACTIVE_WALLET_STORAGE_KEY = "panth_active_wallet_session";

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function persistActiveWalletSession(payload: {
  walletType: WalletType;
  address: string | null;
}) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      ACTIVE_WALLET_STORAGE_KEY,
      JSON.stringify({
        walletType: payload.walletType,
        address: payload.address,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore storage failures
  }
}

export function useUnifiedWallet() {
  const context = React.useContext(UnifiedWalletContext);
  if (!context) {
    throw new Error("useUnifiedWallet must be used within a UnifiedWalletProvider");
  }
  return context;
}

function useUnifiedWalletLogic(): UnifiedWalletState {
  const dw = useDecentWalletAccount();
  const twAccount = useActiveAccount();
  const twWallet = useActiveWallet();
  const { disconnect: twDisconnect } = useDisconnect();

  const walletType = React.useMemo<WalletType>(() => {
    if (dw.isDecentWallet && dw.isConnected) return "decent";
    if (twAccount?.address) return "thirdweb";
    return null;
  }, [dw.isDecentWallet, dw.isConnected, twAccount?.address]);

  const address = React.useMemo(() => {
    if (walletType === "decent") return normalizeAddress(dw.address);
    if (walletType === "thirdweb") return normalizeAddress(twAccount?.address ?? null);
    return null;
  }, [walletType, dw.address, twAccount?.address]);

  const isReady = React.useMemo(() => {
    if (dw.isDecentWallet) return dw.ready;
    return true;
  }, [dw.isDecentWallet, dw.ready]);

  const isLoading = React.useMemo(() => {
    if (dw.isDecentWallet) return !dw.ready;
    return false;
  }, [dw.isDecentWallet, dw.ready]);

  React.useEffect(() => {
    persistActiveWalletSession({ walletType, address });
  }, [walletType, address]);

  const connect = React.useCallback(async () => {
    if (dw.isDecentWallet) {
      await dw.connect();
    }
  }, [dw]);

  const disconnect = React.useCallback(async () => {
    if (walletType === "decent") {
      await dw.disconnect();
    } else if (walletType === "thirdweb" && twWallet) {
      await twDisconnect(twWallet);
    }

    persistActiveWalletSession({ walletType: null, address: null });
  }, [walletType, dw, twWallet, twDisconnect]);

  const copyAddress = React.useCallback(async () => {
    if (!address) return false;

    try {
      await navigator.clipboard.writeText(address);
      return true;
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = address;
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.focus();
        el.select();
        const success = document.execCommand("copy");
        document.body.removeChild(el);
        return success;
      } catch {
        return false;
      }
    }
  }, [address]);

  return {
    address,
    walletType,
    isConnected: !!address,
    isReady,
    isLoading,
    connect,
    disconnect,
    copyAddress,
  };
}

export function UnifiedWalletProvider({ children }: { children: React.ReactNode }) {
  const walletState = useUnifiedWalletLogic();

  return (
    <UnifiedWalletContext.Provider value={walletState}>
      {children}
    </UnifiedWalletContext.Provider>
  );
}