"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  ConnectButton,
  darkTheme,
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
} from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";

import { client } from "@/src/lib/client";
import { electroneumChain } from "@/src/lib/chain";
import { isDecentWalletEnv, useDecentWalletAccount } from "@/src/lib/decentWallet";

const wallets = [createWallet("io.metamask"), createWallet("io.rabby")];
const recommendedWallets = [createWallet("io.metamask"), createWallet("io.rabby")];

function shorten(addr: string) {
  return addr.length <= 12 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function PillButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-card/80 transition inline-flex items-center gap-2"
    >
      {children}
    </button>
  );
}

function DropdownItem({
  children,
  onClick,
  disabled,
  destructive,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full px-4 py-3 text-left text-sm transition",
        "hover:bg-card/60",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        destructive ? "text-red-500" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function ConnectWallet() {
  const { theme } = useTheme();

  // Decent Wallet injected (inside Expo WebView)
  const dw = useDecentWalletAccount();
  const inDW = isDecentWalletEnv();

  // Thirdweb (normal browsers)
  const thirdwebAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const [open, setOpen] = useState(false);

  // pick address source
  const address = useMemo(() => {
    if (inDW) return dw.address;
    return thirdwebAccount?.address ?? null;
  }, [inDW, dw.address, thirdwebAccount?.address]);

  const connected = !!address;

  const copyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // ignore
    } finally {
      setOpen(false);
    }
  }, [address]);

  const doDisconnect = useCallback(() => {
    // In injected mode: disconnect is controlled by the wallet (your WebView "Disconnect site" menu).
    if (inDW) {
      setOpen(false);
      return;
    }

    if (activeWallet) {
      disconnect(activeWallet); // ✅ fixes "Expected 1 arguments"
    }
    setOpen(false);
  }, [activeWallet, disconnect, inDW]);

  const connectDW = useCallback(async () => {
    if (!inDW) return;
    await dw.connect();
  }, [dw, inDW]);

  const label = useMemo(() => {
    if (!address) return "Connect wallet";
    return shorten(address);
  }, [address]);

  // If connected, show our own wallet pill UI (so you get the dropdown behavior you wanted)
  if (connected) {
    return (
      <div className="relative">
        <PillButton onClick={() => setOpen((v) => !v)}>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          <span>{label}</span>
          <span className="opacity-60">▾</span>
        </PillButton>

        {open ? (
          <>
            {/* click-away backdrop */}
            <button
              aria-label="Close wallet menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-2 w-65 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
              <div className="px-4 py-3">
                <div className="text-xs text-muted">Connected</div>
                <div className="mt-1 text-sm font-semibold">{shorten(address!)}</div>
                <div className="mt-2 text-xs text-muted">
                  {inDW ? "Decent Wallet (in-app browser)" : "External wallet"}
                </div>
              </div>

              <div className="h-px bg-border" />

              <DropdownItem onClick={copyAddress}>Copy address</DropdownItem>

              <DropdownItem
                onClick={doDisconnect}
                destructive={!inDW}
                disabled={inDW}
              >
                {inDW ? "Disconnect in wallet menu" : "Disconnect"}
              </DropdownItem>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // Not connected yet:
  // - Inside Decent Wallet → one button that calls injected eth_requestAccounts
  // - Outside → Thirdweb ConnectButton (wallet options)
  if (inDW) {
    return (
      <button
        type="button"
        onClick={connectDW}
        disabled={!dw.ready}
        className="h-10 rounded-full bg-foreground text-background px-4 text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
        title={!dw.ready ? "Loading wallet…" : "Connect Decent Wallet"}
      >
        {dw.ready ? "Connect wallet" : "Loading…"}
      </button>
    );
  }

  return (
    <ConnectButton
      client={client}
      chain={electroneumChain}
      wallets={wallets}
      recommendedWallets={recommendedWallets}
      connectModal={{
        size: "compact",
        title: "Connect Wallet",
        showThirdwebBranding: false,
      }}
      theme={darkTheme({
        colors: {
          accentText: theme === "light" ? "#131418" : "#4DEE54",
          accentButtonBg: theme === "light" ? "#131418" : "#4DEE54",
          modalBg: theme === "light" ? "#ffffff" : "#131418",
          primaryText: theme === "light" ? "#000000" : "#ffffff",
          primaryButtonBg: theme === "light" ? "#131418" : "#4DEE54",
          primaryButtonText: theme === "light" ? "#ffffff" : "#131418",
          tertiaryBg: theme === "light" ? "#F5F5F5" : "#000000",
          secondaryButtonBg: theme === "light" ? "#f5f5f5" : "#000000",
          secondaryButtonText: theme === "light" ? "#131418" : "#ffffff",
          connectedButtonBg: theme === "light" ? "#F5F5F5" : "#131418",
          connectedButtonBgHover: theme === "light" ? "#ffffff" : "#000000",
          borderColor: theme === "light" ? "#E5E5E5" : "#FFFFFF1A",
        },
        fontFamily: "Lexend",
      })}
    />
  );
}
