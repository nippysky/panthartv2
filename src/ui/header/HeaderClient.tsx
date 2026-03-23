// src/ui/header/HeaderClient.tsx
"use client";

import * as React from "react";
import { Menu, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/src/ui/Button";
import { IconButton } from "@/src/ui/IconButton";
import { MobileMenuDrawer } from "./MobileMenuDrawer";
import { useUnifiedWallet } from "@/src/providers/UnifiedWalletProvider";
import Link from "next/link";
import WalletPill from "../WalletPill";

export function HeaderClient() {
  const unifiedWallet = useUnifiedWallet();
  const pathname = usePathname();
  
  // Track if we're on the create page to possibly hide the create button
  const isCreatePage = pathname === "/create";
  
  // Use a stable reference to prevent unnecessary re-renders
  const showCreateButton = unifiedWallet.isConnected && !isCreatePage;
  const showMobileMenu = unifiedWallet.isConnected;
  
  // Add a key to force remount when wallet state changes
  const mobileMenuKey = React.useMemo(() => {
    return unifiedWallet.address ? `menu-${unifiedWallet.address}` : "menu-disconnected";
  }, [unifiedWallet.address]);

  return (
    <div className="flex items-center gap-2">
      {/* Desktop: Create button */}
      {showCreateButton && (
        <div className="hidden md:block">
          <Link href="/create">
            <Button variant="primary" size="md">
              <Plus className="h-4 w-4" />
              <span className="ml-1">Create</span>
            </Button>
          </Link>
        </div>
      )}

      {/* Wallet button - always rendered */}
      <WalletPill />

      {/* Mobile menu - always rendered when connected, with key for stability */}
      {showMobileMenu && (
        <MobileMenuDrawer
          key={mobileMenuKey}
          address={unifiedWallet.address!}
          trigger={
            <IconButton aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </IconButton>
          }
        />
      )}
    </div>
  );
}