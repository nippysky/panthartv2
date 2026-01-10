// src/lib/currencies.ts
import prisma, { prismaReady } from "@/src/lib/db";
import { CurrencyKind } from "@/src/lib/generated/prisma/client";

export type CurrencyOption = {
  id: string; // "native" or Currency.id
  symbol: string; // "ETN", "DCNT", ...
  decimals: number;
  kind: "NATIVE" | "ERC20";
  tokenAddress?: string | null;
};

export async function getActiveCurrencies(): Promise<CurrencyOption[]> {
  await prismaReady;

  const native: CurrencyOption = {
    id: "native",
    symbol: "ETN",
    decimals: 18,
    kind: "NATIVE",
    tokenAddress: null,
  };

  // ✅ Only active ERC20 tokens. Also prevents any "native"/ETN row duplication.
  const rows = await prisma.currency.findMany({
    where: { active: true, kind: CurrencyKind.ERC20 },
    select: { id: true, symbol: true, decimals: true, kind: true, tokenAddress: true },
    orderBy: { symbol: "asc" },
  });

  return [
    native,
    ...rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      decimals: r.decimals ?? 18,
      kind: "ERC20" as const,
      tokenAddress: r.tokenAddress ?? null,
    })),
  ];
}
