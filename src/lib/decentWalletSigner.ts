/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/decentWalletSigner.ts
"use client";

import * as React from "react";
import { ethers } from "ethers";

export type InjectedEip1193Provider = {
  isDecentWallet?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, fn: (...args: any[]) => void) => void;
  removeListener?: (event: string, fn: (...args: any[]) => void) => void;
};

function getInjectedEthereum(): InjectedEip1193Provider | null {
  if (typeof window === "undefined") return null;
  return ((window as any).ethereum as InjectedEip1193Provider | undefined) ?? null;
}

export function hasInjectedWallet() {
  return !!getInjectedEthereum();
}

export function isInjectedDecentWallet() {
  return !!getInjectedEthereum()?.isDecentWallet;
}

export async function getInjectedAccounts(): Promise<string[]> {
  const eth = getInjectedEthereum();
  if (!eth) return [];

  try {
    const accounts = await eth.request({ method: "eth_accounts" });
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    return [];
  }
}

export async function requestInjectedAccounts(): Promise<string[]> {
  const eth = getInjectedEthereum();
  if (!eth) {
    throw new Error("No injected wallet was found in this browser.");
  }

  const accounts = await eth.request({ method: "eth_requestAccounts" });
  return Array.isArray(accounts) ? accounts : [];
}

export async function getBrowserProvider() {
  const eth = getInjectedEthereum();
  if (!eth) {
    throw new Error("No injected wallet provider found.");
  }

  return new ethers.BrowserProvider(eth as ethers.Eip1193Provider);
}

export async function getInjectedSigner(options?: { requestAccounts?: boolean }) {
  const shouldRequest = options?.requestAccounts ?? true;

  const provider = await getBrowserProvider();

  if (shouldRequest) {
    await provider.send("eth_requestAccounts", []);
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    address,
    chainId: Number(network.chainId),
    isDecentWallet: isInjectedDecentWallet(),
  };
}

export function normalizeEthersError(error: unknown) {
  if (error instanceof Error) {
    const msg = error.message || "Transaction failed.";

    if (msg.includes("user rejected") || msg.includes("User denied")) {
      return "The wallet request was rejected.";
    }

    if (msg.includes("insufficient funds")) {
      return "The connected wallet does not have enough gas funds for this transaction.";
    }

    return msg;
  }

  return "Transaction failed.";
}

export function useInjectedWalletAccount() {
  const [ready, setReady] = React.useState(false);
  const [address, setAddress] = React.useState<string | null>(null);

  const injected = hasInjectedWallet();
  const isDecentWallet = isInjectedDecentWallet();

  React.useEffect(() => {
    let alive = true;

    (async () => {
      if (!injected) {
        setReady(true);
        return;
      }

      const accounts = await getInjectedAccounts();
      if (!alive) return;

      setAddress(accounts[0] ?? null);
      setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [injected]);

  React.useEffect(() => {
    const eth = getInjectedEthereum();
    if (!eth?.on) return;

    const handler = (accounts: string[]) => {
      setAddress(Array.isArray(accounts) ? accounts[0] ?? null : null);
    };

    eth.on("accountsChanged", handler);
    return () => eth.removeListener?.("accountsChanged", handler);
  }, []);

  const connect = React.useCallback(async () => {
    const accounts = await requestInjectedAccounts();
    setAddress(accounts[0] ?? null);
    return accounts[0] ?? null;
  }, []);

  return {
    ready,
    injected,
    isDecentWallet,
    address,
    isConnected: !!address,
    connect,
  };
}