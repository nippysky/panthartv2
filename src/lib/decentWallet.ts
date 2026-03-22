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

const DW_ADDRESS_STORAGE_KEY = "decent_wallet_address";
const DW_EVENT = "decent-wallet-address-changed";

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getEthereum(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

function readStoredAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeAddress(window.localStorage.getItem(DW_ADDRESS_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredAddress(address: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (address) {
      window.localStorage.setItem(DW_ADDRESS_STORAGE_KEY, address);
    } else {
      window.localStorage.removeItem(DW_ADDRESS_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }

  window.dispatchEvent(
    new CustomEvent(DW_EVENT, {
      detail: { address },
    })
  );
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
    const accounts = Array.isArray(acc) ? acc.map(normalizeAddress).filter(Boolean) as string[] : [];
    writeStoredAddress(accounts[0] ?? null);
    return accounts;
  } catch {
    return [];
  }
}

export async function dwRequestAccounts(): Promise<string[]> {
  const eth = getEthereum();
  if (!eth) throw new Error("No injected provider");
  const acc = await eth.request({ method: "eth_requestAccounts" });
  const accounts = Array.isArray(acc) ? acc.map(normalizeAddress).filter(Boolean) as string[] : [];
  writeStoredAddress(accounts[0] ?? null);
  return accounts;
}

/**
 * “Disconnect” for injected wallets is not standardized.
 * We do best-effort:
 * - try wallet_revokePermissions (MetaMask-ish)
 * - try wallet_requestPermissions empty
 * - then clear shared local address state as a UX fallback.
 */
export async function dwDisconnect(): Promise<void> {
  const eth = getEthereum();
  if (!eth) {
    writeStoredAddress(null);
    return;
  }

  try {
    await eth.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    try {
      await eth.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // ignore
    }
  }

  writeStoredAddress(null);
}

export function useDecentWalletAccount() {
  const [ready, setReady] = React.useState(false);
  const [address, setAddress] = React.useState<string | null>(null);

  const eth = React.useMemo(() => getEthereum(), []);
  const isDW = !!eth?.isDecentWallet;

  React.useEffect(() => {
    let alive = true;

    (async () => {
      const stored = readStoredAddress();
      if (alive && stored) {
        setAddress(stored);
      }

      const accounts = await dwGetAccounts();
      if (!alive) return;

      setAddress(accounts[0] ?? stored ?? null);
      setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const onAddressChanged = (event: Event) => {
      const custom = event as CustomEvent<{ address?: string | null }>;
      setAddress(normalizeAddress(custom.detail?.address) ?? null);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === DW_ADDRESS_STORAGE_KEY) {
        setAddress(normalizeAddress(event.newValue) ?? null);
      }
    };

    window.addEventListener(DW_EVENT, onAddressChanged as EventListener);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(DW_EVENT, onAddressChanged as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  React.useEffect(() => {
    if (!eth?.on) return;

    const handler = (accounts: string[]) => {
      const next = Array.isArray(accounts)
        ? normalizeAddress(accounts[0]) ?? null
        : null;
      setAddress(next);
      writeStoredAddress(next);
    };

    eth.on("accountsChanged", handler);
    return () => eth.removeListener?.("accountsChanged", handler);
  }, [eth]);

  const connect = React.useCallback(async () => {
    const accounts = await dwRequestAccounts();
    const next = accounts[0] ?? null;
    setAddress(next);
    writeStoredAddress(next);
  }, []);

  const disconnect = React.useCallback(async () => {
    await dwDisconnect();
    setAddress(null);
    writeStoredAddress(null);
  }, []);

  return {
    ready,
    isDecentWallet: isDW,
    address,
    isConnected: !!address,
    connect,
    disconnect,
  };
}