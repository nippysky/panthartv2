// src/lib/useAppConnection.ts
"use client";

import * as React from "react";
import { useActiveAccount } from "thirdweb/react";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";

export function useAppConnection() {
  const dw = useDecentWalletAccount();
  const tw = useActiveAccount();

  // Hydration-safe: don’t decide based on Thirdweb until mounted
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDecentWallet = dw.isDecentWallet;

  const address = isDecentWallet ? dw.address : mounted ? tw?.address : undefined;
  const isConnected = isDecentWallet ? !!dw.isConnected : mounted ? !!tw?.address : false;

  return {
    mounted,
    isDecentWallet,
    address,
    isConnected,
    // useful if you want a “connect now” CTA for Decent Wallet only
    connectDW: dw.connect,
  };
}
