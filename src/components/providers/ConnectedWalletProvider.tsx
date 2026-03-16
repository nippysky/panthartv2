"use client";

import * as React from "react";
import { useActiveAccount } from "thirdweb/react";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";

type ConnectedWalletContextValue = {
  mounted: boolean;
  address: string | null;
  isConnected: boolean;
  source: "decent-wallet" | "thirdweb" | null;
  isDecentWallet: boolean;
  isThirdwebWallet: boolean;
};

const ConnectedWalletContext =
  React.createContext<ConnectedWalletContextValue | null>(null);

function cleanAddress(address?: string | null) {
  const v = (address || "").trim();
  return v || null;
}

export function ConnectedWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dw = useDecentWalletAccount();
  const thirdwebAccount = useActiveAccount();

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const value = React.useMemo<ConnectedWalletContextValue>(() => {
    if (!mounted) {
      return {
        mounted: false,
        address: null,
        isConnected: false,
        source: null,
        isDecentWallet: false,
        isThirdwebWallet: false,
      };
    }

    if (dw.isDecentWallet) {
      const address =
        dw.ready && dw.isConnected && dw.address
          ? cleanAddress(dw.address)
          : null;

      return {
        mounted: true,
        address,
        isConnected: !!address,
        source: address ? "decent-wallet" : null,
        isDecentWallet: true,
        isThirdwebWallet: false,
      };
    }

    const twAddress = cleanAddress(thirdwebAccount?.address || null);

    return {
      mounted: true,
      address: twAddress,
      isConnected: !!twAddress,
      source: twAddress ? "thirdweb" : null,
      isDecentWallet: false,
      isThirdwebWallet: !!twAddress,
    };
  }, [
    mounted,
    dw.isDecentWallet,
    dw.ready,
    dw.isConnected,
    dw.address,
    thirdwebAccount?.address,
  ]);

  return (
    <ConnectedWalletContext.Provider value={value}>
      {children}
    </ConnectedWalletContext.Provider>
  );
}

export function useConnectedWalletContext() {
  const ctx = React.useContext(ConnectedWalletContext);
  if (!ctx) {
    throw new Error(
      "useConnectedWalletContext must be used within ConnectedWalletProvider"
    );
  }
  return ctx;
}