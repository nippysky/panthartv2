"use client";

import { useConnectedWalletContext } from "@/src/components/providers/ConnectedWalletProvider";

export function useConnectedWalletAddress() {
  const ctx = useConnectedWalletContext();

  return {
    mounted: ctx.mounted,
    address: ctx.address,
    isConnected: ctx.isConnected,
    source: ctx.source,
    isDecentWallet: ctx.isDecentWallet,
    isThirdwebWallet: ctx.isThirdwebWallet,
  };
}