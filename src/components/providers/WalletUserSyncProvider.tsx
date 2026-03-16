"use client";

import * as React from "react";
import { useConnectedWalletAddress } from "@/src/lib/hooks/useConnectedWalletAddress";

type EnsureUserResponse = {
  created?: boolean;
  user?: {
    id: string;
    walletAddress: string;
    username: string;
    profileAvatar: string;
    profileBanner: string | null;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
};

export default function WalletUserSyncProvider() {
  const { mounted, address } = useConnectedWalletAddress();

  const ensuredRef = React.useRef<Set<string>>(new Set());
  const inflightRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!mounted || !address) return;

    const walletAddress = address;

    if (ensuredRef.current.has(walletAddress)) return;
    if (inflightRef.current.has(walletAddress)) return;

    let cancelled = false;
    inflightRef.current.add(walletAddress);

    async function ensureUser() {
      try {
        const res = await fetch("/api/users/ensure", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address: walletAddress }),
          cache: "no-store",
        });

        const json = (await res.json().catch(() => ({}))) as EnsureUserResponse;

        if (!res.ok) {
          throw new Error(json?.error || "Failed to ensure connected wallet user");
        }

        if (cancelled) return;

        ensuredRef.current.add(walletAddress);
      } catch (err) {
        console.error("WalletUserSyncProvider error:", err);
      } finally {
        inflightRef.current.delete(walletAddress);
      }
    }

    void ensureUser();

    return () => {
      cancelled = true;
    };
  }, [mounted, address]);

  return null;
}