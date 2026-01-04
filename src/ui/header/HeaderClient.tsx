// src/ui/app/header/HeaderClient.tsx
"use client";

import * as React from "react";
import { Menu, Plus } from "lucide-react";

import { Button } from "@/src/ui/Button";
import { IconButton } from "@/src/ui/IconButton";
import { WalletPill } from "@/src/ui/WalletPill";
import { MobileMenuDrawer } from "./MobileMenuDrawer";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";
import { useActiveAccount } from "thirdweb/react";

function useUnifiedAddress() {
  const dw = useDecentWalletAccount();
  const tw = useActiveAccount();

  // Decent Wallet takes precedence if present
  if (dw.isDecentWallet) {
    return dw.isConnected ? dw.address ?? null : null;
  }

  // Outside Decent Wallet, Thirdweb connection (WalletPill renders ConnectWallet UI)
  return tw?.address ?? null;
}

export function HeaderClient() {
  const address = useUnifiedAddress();

  return (
    <div className="flex items-center gap-2">
      {/* Desktop: Create */}
      {address ? (
        <div className="hidden md:block">
          <Button href="/create" variant="primary" size="md">
            <Plus className="h-4 w-4" />
            <span className="ml-1">Create</span>
          </Button>
        </div>
      ) : null}

      {/* Wallet */}
      <WalletPill />

      {/* Mobile menu (and desktop menu icon too, if you want) */}
      {address ? (
    <MobileMenuDrawer
  address={address}
  trigger={
    <IconButton aria-label="Open menu">
      <Menu className="h-5 w-5" />
    </IconButton>
  }
/>

      ) : null}
    </div>
  );
}
