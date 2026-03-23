// src/providers/UnifiedWalletProvider.tsx
"use client";

import * as React from "react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";

export type WalletType = "decent" | "thirdweb" | null;

export interface UnifiedWalletState {
  // State
  address: string | null;
  walletType: WalletType;
  isConnected: boolean;
  isReady: boolean;
  isLoading: boolean;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  copyAddress: () => Promise<boolean>;
}

const UnifiedWalletContext = React.createContext<UnifiedWalletState | null>(null);

export function useUnifiedWallet() {
  const context = React.useContext(UnifiedWalletContext);
  if (!context) {
    throw new Error("useUnifiedWallet must be used within a UnifiedWalletProvider");
  }
  return context;
}

function useUnifiedWalletLogic(): UnifiedWalletState {
  // Get both wallet hooks
  const dw = useDecentWalletAccount();
  const twAccount = useActiveAccount();
  const twWallet = useActiveWallet();
  const { disconnect: twDisconnect } = useDisconnect();
  
  // Determine active wallet
  const walletType = React.useMemo<WalletType>(() => {
    if (dw.isDecentWallet && dw.isConnected) return "decent";
    if (twAccount?.address) return "thirdweb";
    return null;
  }, [dw.isDecentWallet, dw.isConnected, twAccount?.address]);
  
  // Get the active address
  const address = React.useMemo(() => {
    if (walletType === "decent") return dw.address;
    if (walletType === "thirdweb") return twAccount?.address ?? null;
    return null;
  }, [walletType, dw.address, twAccount?.address]);
  
  // Combined ready state
  const isReady = React.useMemo(() => {
    if (dw.isDecentWallet) return dw.ready;
    return true; // Thirdweb is always ready
  }, [dw.isDecentWallet, dw.ready]);
  
  // Combined loading state
  const isLoading = React.useMemo(() => {
    if (dw.isDecentWallet) return !dw.ready;
    return false;
  }, [dw.isDecentWallet, dw.ready]);
  
  // Connect action
  const connect = React.useCallback(async () => {
    if (dw.isDecentWallet) {
      await dw.connect();
    }
    // Thirdweb connection is handled by ConnectButton component
  }, [dw]);
  
  // Disconnect action
  const disconnect = React.useCallback(async () => {
    if (walletType === "decent") {
      await dw.disconnect();
    } else if (walletType === "thirdweb" && twWallet) {
      await twDisconnect(twWallet);
    }
  }, [walletType, dw, twWallet, twDisconnect]);
  
  // Copy address helper
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