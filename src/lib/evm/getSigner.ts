/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ethers } from "ethers";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const ACTIVE_WALLET_STORAGE_KEY = "panth_active_wallet_session";

type InjectedProvider = {
  isDecentWallet?: boolean;
  isMetaMask?: boolean;
  isRabby?: boolean;
  request?: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, fn: (...args: any[]) => void) => void;
  removeListener?: (event: string, fn: (...args: any[]) => void) => void;
};

type ActiveWalletSession = {
  walletType: "decent" | "thirdweb" | null;
  address: string | null;
  updatedAt: number;
};

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return ethers.getAddress(trimmed);
  } catch {
    return null;
  }
}

function sameAddress(a: string | null | undefined, b: string | null | undefined) {
  const aa = normalizeAddress(a);
  const bb = normalizeAddress(b);
  return !!aa && !!bb && aa === bb;
}

function getWindowEthereum(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  return ((window as any).ethereum ?? null) as InjectedProvider | null;
}

function getInjectedProviders(): InjectedProvider[] {
  const eth = getWindowEthereum();
  if (!eth) return [];

  const providers = Array.isArray((eth as any).providers)
    ? ((eth as any).providers as InjectedProvider[])
    : null;

  if (providers && providers.length > 0) return providers;
  return [eth];
}

function readActiveWalletSession(): ActiveWalletSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_WALLET_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ActiveWalletSession>;
    const walletType =
      parsed.walletType === "decent" || parsed.walletType === "thirdweb"
        ? parsed.walletType
        : null;
    const address = normalizeAddress(parsed.address);
    const updatedAt =
      typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : Date.now();

    return {
      walletType,
      address,
      updatedAt,
    };
  } catch {
    return null;
  }
}

async function getAccounts(provider: InjectedProvider | null): Promise<string[]> {
  if (!provider?.request) return [];

  try {
    const res = await provider.request({ method: "eth_accounts" });
    if (!Array.isArray(res)) return [];
    return res.map(normalizeAddress).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

async function requestAccounts(provider: InjectedProvider | null): Promise<string[]> {
  if (!provider?.request) return [];

  try {
    const res = await provider.request({ method: "eth_requestAccounts" });
    if (!Array.isArray(res)) return [];
    return res.map(normalizeAddress).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

function providerMatchesWalletType(
  provider: InjectedProvider,
  walletType: "decent" | "thirdweb" | null
) {
  if (walletType === "decent") return !!provider.isDecentWallet;
  if (walletType === "thirdweb") return !provider.isDecentWallet;
  return true;
}

async function pickInjectedProviderForSession(
  session: ActiveWalletSession | null
): Promise<InjectedProvider | null> {
  const providers = getInjectedProviders();
  if (!providers.length) return null;

  const expectedAddress = normalizeAddress(session?.address);
  const expectedWalletType = session?.walletType ?? null;

  const typedProviders = providers.filter((p) =>
    providerMatchesWalletType(p, expectedWalletType)
  );

  const candidates = typedProviders.length ? typedProviders : providers;

  if (expectedAddress) {
    for (const provider of candidates) {
      const accounts = await getAccounts(provider);
      if (accounts.some((addr) => sameAddress(addr, expectedAddress))) {
        return provider;
      }
    }
  }

  for (const provider of candidates) {
    const accounts = await getAccounts(provider);
    if (accounts.length > 0) return provider;
  }

  for (const provider of candidates) {
    const accounts = await requestAccounts(provider);
    if (accounts.length > 0) return provider;
  }

  return candidates[0] ?? null;
}

export async function getBrowserSigner() {
  if (typeof window === "undefined") {
    throw new Error("Wallet not available on server.");
  }

  const session = readActiveWalletSession();
  const expectedAddress = normalizeAddress(session?.address);

  const injected = await pickInjectedProviderForSession(session);
  if (!injected?.request) {
    throw new Error("No injected wallet found. Use Decent Wallet or install MetaMask/Rabby.");
  }

  const accounts = await getAccounts(injected);
  if (!accounts.length) {
    await requestAccounts(injected);
  }

  const provider = new ethers.BrowserProvider(injected as any, "any");
  const network = await provider.getNetwork();

  let signer: ethers.JsonRpcSigner;

  if (expectedAddress) {
    signer = await provider.getSigner(expectedAddress);
  } else {
    signer = await provider.getSigner();
  }

  const signerAddress = normalizeAddress(await signer.getAddress());

  if (expectedAddress && signerAddress !== expectedAddress) {
    throw new Error(
      `Connected wallet mismatch. UI expects ${expectedAddress}, but signer resolved ${signerAddress ?? "unknown"}.`
    );
  }

  return {
    provider,
    signer,
    chainId: Number(network.chainId),
    address: signerAddress,
  };
}