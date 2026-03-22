"use client";

import * as React from "react";

import { normalizeAdminAddress } from "@/src/features/admin/warpool/admin-access";
import WalletPill from "@/src/ui/WalletPill";

type Props = {
  allowedWallets: string[];
  children: React.ReactNode;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, fn: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, fn: (...args: unknown[]) => void) => void;
};

function getEthereum(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return ((window as Window & { ethereum?: Eip1193Provider }).ethereum ?? null);
}

function AccessShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-border bg-card p-6 md:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Warpool Admin Access
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted md:text-base">
          {description}
        </p>

        <div className="mt-6 flex justify-center">{children}</div>
      </div>
    </div>
  );
}

export default function WarpoolAdminAccessGate({
  allowedWallets,
  children,
}: Props) {
  const [address, setAddress] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const eth = getEthereum();

    async function syncAccounts() {
      if (!eth) {
        if (!alive) return;
        setAddress(null);
        setReady(true);
        return;
      }

      try {
        const result = await eth.request({ method: "eth_accounts" });
        const accounts = Array.isArray(result)
          ? result.filter((item): item is string => typeof item === "string")
          : [];

        if (!alive) return;
        setAddress(accounts[0] ?? null);
      } catch {
        if (!alive) return;
        setAddress(null);
      } finally {
        if (alive) setReady(true);
      }
    }

    syncAccounts();

    if (eth?.on) {
      const handleAccountsChanged = (...args: unknown[]) => {
        const first = args[0];
        const accounts = Array.isArray(first)
          ? first.filter((item): item is string => typeof item === "string")
          : [];

        setAddress(accounts[0] ?? null);
      };

      eth.on("accountsChanged", handleAccountsChanged);

      return () => {
        alive = false;
        eth.removeListener?.("accountsChanged", handleAccountsChanged);
      };
    }

    return () => {
      alive = false;
    };
  }, []);

  const normalizedAllowed = React.useMemo(
    () =>
      allowedWallets
        .map((item) => normalizeAdminAddress(item))
        .filter(Boolean),
    [allowedWallets]
  );

  const normalizedAddress = normalizeAdminAddress(address);
  const isConnected = !!address;
  const isAllowed =
    !!normalizedAddress && normalizedAllowed.includes(normalizedAddress);

  if (!ready || !isConnected) {
    return (
      <AccessShell
        title="Protected admin surface"
        description="Connect an allowed admin wallet to continue into the Warpool control panel."
      >
        <WalletPill />
      </AccessShell>
    );
  }

  if (!isAllowed) {
    return (
      <AccessShell
        title="Wallet not allowed"
        description="This connected wallet is not currently included in the Warpool admin wallet list."
      >
        <WalletPill />
      </AccessShell>
    );
  }

  return <>{children}</>;
}