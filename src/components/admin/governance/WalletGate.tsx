// src/components/admin/governance/WalletGate.tsx
"use client";

import * as React from "react";
import { useActiveAccount } from "thirdweb/react";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import WalletPill from "@/src/ui/WalletPill";

function short(addr?: string | null) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function isAllowed(allowed: string[], addr?: string | null) {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return allowed.map((w) => w.toLowerCase()).includes(a);
}

function GateCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
      <div className="flex flex-col items-center justify-center gap-5 py-10 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background">
          {icon}
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <div className="max-w-lg text-sm leading-6 text-muted">{body}</div>
        </div>

        <WalletPill />
      </div>
    </section>
  );
}

export default function WalletGate({
  allowedWallets,
  children,
}: {
  allowedWallets: string[];
  children: React.ReactNode;
}) {
  const dw = useDecentWalletAccount();
  const activeAccount = useActiveAccount();

  const connectedAddress = React.useMemo(() => {
    if (dw?.isDecentWallet) {
      if (dw.ready && dw.isConnected && dw.address) return dw.address;
      return null;
    }

    return activeAccount?.address || null;
  }, [
    dw?.isDecentWallet,
    dw?.ready,
    dw?.isConnected,
    dw?.address,
    activeAccount?.address,
  ]);

  const connected = Boolean(connectedAddress);
  const permitted = isAllowed(allowedWallets, connectedAddress);

  if (!connected) {
    return (
      <GateCard
        title="Connect your admin wallet"
        body="Connect the wallet linked to Panth.art admin access to use governance tools."
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        }
      />
    );
  }

  if (!permitted) {
    return (
      <GateCard
        title="Access denied"
        body={
          <>
            The connected wallet{" "}
            <span className="font-mono text-foreground">
              {short(connectedAddress)}
            </span>{" "}
            is not on the allowed admin list. Switch to an approved admin wallet.
          </>
        }
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-amber-600 dark:text-amber-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86l-7.5 13A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.71-3.14l-7.5-13a2 2 0 0 0-3.42 0z" />
          </svg>
        }
      />
    );
  }

  return <>{children}</>;
}