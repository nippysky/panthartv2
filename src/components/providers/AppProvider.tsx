"use client";

import * as React from "react";
import WalletUserSyncProvider from "@/src/components/providers/WalletUserSyncProvider";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WalletUserSyncProvider />
      {children}
    </>
  );
}