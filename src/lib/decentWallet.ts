/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/decentWallet.ts
"use client";

import * as React from "react";

export type Eip1193Provider = {
  isDecentWallet?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, fn: (...args: any[]) => void) => void;
  removeListener?: (event: string, fn: (...args: any[]) => void) => void;
};

function getEthereum(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

export function isDecentWalletEnv() {
  const eth = getEthereum();
  return !!eth?.isDecentWallet;
}

export async function dwGetAccounts(): Promise<string[]> {
  const eth = getEthereum();
  if (!eth) return [];
  try {
    const acc = await eth.request({ method: "eth_accounts" });
    return Array.isArray(acc) ? acc : [];
  } catch {
    return [];
  }
}

export async function dwRequestAccounts(): Promise<string[]> {
  const eth = getEthereum();
  if (!eth) throw new Error("No injected provider");
  const acc = await eth.request({ method: "eth_requestAccounts" });
  return Array.isArray(acc) ? acc : [];
}

/**
 * “Disconnect” for injected wallets is not standardized.
 * We do best-effort:
 * - try wallet_revokePermissions (MetaMask-ish)
 * - try wallet_requestPermissions empty
 * - then just clear local state (the hook) as a final UX fallback.
 */
export async function dwDisconnect(): Promise<void> {
  const eth = getEthereum();
  if (!eth) return;

  // Try EIP-2255-ish revoke permissions
  try {
    await eth.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
    return;
  } catch {
    // ignore
  }

  // Some wallets use requestPermissions
  try {
    await eth.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // ignore
  }
}

export function useDecentWalletAccount() {
  const [ready, setReady] = React.useState(false);
  const [address, setAddress] = React.useState<string | null>(null);

  const isDW = isDecentWalletEnv();

  React.useEffect(() => {
    let alive = true;

    (async () => {
      if (!isDW) {
        setReady(true);
        return;
      }

      const accounts = await dwGetAccounts();
      if (!alive) return;

      setAddress(accounts[0] ?? null);
      setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [isDW]);

  React.useEffect(() => {
    const eth = getEthereum();
    if (!isDW || !eth?.on) return;

    const handler = (accounts: string[]) => {
      setAddress(Array.isArray(accounts) ? accounts[0] ?? null : null);
    };

    eth.on("accountsChanged", handler);
    return () => eth.removeListener?.("accountsChanged", handler);
  }, [isDW]);

  const connect = React.useCallback(async () => {
    if (!isDW) return;
    const accounts = await dwRequestAccounts();
    setAddress(accounts[0] ?? null);
  }, [isDW]);

  const disconnect = React.useCallback(async () => {
    if (!isDW) return;
    await dwDisconnect();
    // Even if revoke fails, we clear local session for UX.
    setAddress(null);
  }, [isDW]);

  return {
    ready,
    isDecentWallet: isDW,
    address,
    isConnected: !!address,
    connect,
    disconnect,
  };
}
