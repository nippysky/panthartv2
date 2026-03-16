"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThirdwebProvider } from "thirdweb/react";

import { ConnectedWalletProvider } from "@/src/components/providers/ConnectedWalletProvider";
import WalletUserSyncProvider from "@/src/components/providers/WalletUserSyncProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 10_000,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <ThirdwebProvider>
          <ConnectedWalletProvider>
            <WalletUserSyncProvider />
            {children}
          </ConnectedWalletProvider>
        </ThirdwebProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}