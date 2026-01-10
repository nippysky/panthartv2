"use client";

import * as React from "react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { isDecentWalletEnv, useDecentWalletAccount } from "@/src/lib/decentWallet";

/**
 * Unified wallet account:
 * - Inside Decent Wallet (in-app browser): use injected DW account
 * - Else (normal browsers): use Thirdweb active account
 *
 * Hooks are ALWAYS called unconditionally to avoid hook-order bugs.
 */
export function useUnifiedAccount() {
  // Decent Wallet injected mode
  const dw = useDecentWalletAccount();
  const inDW = isDecentWalletEnv();

  // Thirdweb mode (normal browsers)
  const thirdwebAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const address = React.useMemo(() => {
    if (inDW) return dw.address ?? null;
    return thirdwebAccount?.address ?? null;
  }, [inDW, dw.address, thirdwebAccount?.address]);

  const ready = inDW ? dw.ready : true;

  const connect = React.useCallback(async () => {
    if (!inDW) return; // thirdweb connect happens via your ConnectButton UI
    await dw.connect();
  }, [inDW, dw]);

  const disconnectUnified = React.useCallback(async () => {
    if (inDW) {
      await dw.disconnect();
      return;
    }
    if (activeWallet) disconnect(activeWallet);
  }, [inDW, dw, activeWallet, disconnect]);

  return {
    ready,
    address,
    isConnected: !!address,
    isDecentWallet: inDW,
    connect,
    disconnect: disconnectUnified,
  };
}
