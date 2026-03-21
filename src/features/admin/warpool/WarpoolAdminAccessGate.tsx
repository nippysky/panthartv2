"use client";

import * as React from "react";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { normalizeAdminAddress } from "@/src/features/admin/warpool/admin-access";
import { WalletPill } from "@/src/ui/WalletPill";

type Props = {
  slug: string;
  allowedWallets: string[];
  title?: string;
  description?: string;
  children: React.ReactNode;
};

function GateShell({
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
        <p className="mt-3 text-sm leading-6 text-muted md:text-base">{description}</p>
        <div className="mt-6 flex justify-center">{children}</div>
      </div>
    </div>
  );
}

export default function WarpoolAdminAccessGate({
  slug,
  allowedWallets,
  title = "Protected admin surface",
  description = "Connect an allowed admin wallet to continue into the Warpool control panel.",
  children,
}: Props) {
  const { address, isConnected } = useDecentWalletAccount();

  const normalizedAddress = normalizeAdminAddress(address);
  const isAllowedWallet =
    allowedWallets.length > 0 && !!normalizedAddress && allowedWallets.includes(normalizedAddress);

  if (!slug) {
    return (
      <GateShell
        title="Invalid admin route"
        description="This Warpool admin route is missing its admin slug."
      >
        <WalletPill />
      </GateShell>
    );
  }

  if (!isConnected || !address) {
    return (
      <GateShell title={title} description={description}>
        <WalletPill />
      </GateShell>
    );
  }

  if (!isAllowedWallet) {
    return (
      <GateShell
        title="Wallet not allowed"
        description="This connected wallet is not currently included in the allowed Warpool admin list."
      >
        <WalletPill />
      </GateShell>
    );
  }

  return <>{children}</>;
}