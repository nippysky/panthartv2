/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { ethers } from "ethers";

export async function getBrowserSigner() {
  if (typeof window === "undefined") {
    throw new Error("Wallet not available on server.");
  }

  const eth = (window as any).ethereum;
  if (!eth?.request) {
    throw new Error("No injected wallet found. Use Decent Wallet or install MetaMask/Rabby.");
  }

  // If the wallet supports it, ensure we have permission to access accounts
  // (Decent Wallet will succeed; MetaMask will prompt if needed)
  try {
    const accounts = await eth.request({ method: "eth_accounts" });
    if (!Array.isArray(accounts) || accounts.length === 0) {
      await eth.request({ method: "eth_requestAccounts" });
    }
  } catch {
    // If user rejects, signer.getSigner() will still fail later—this just improves UX.
  }

  const provider = new ethers.BrowserProvider(eth, "any");
  const network = await provider.getNetwork();
  const signer = await provider.getSigner();
  return { provider, signer, chainId: Number(network.chainId) };
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
