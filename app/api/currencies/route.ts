// app/api/currencies/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { CurrencyKind } from "@/src/lib/generated/prisma/client";

export type CurrencyOption = {
  id: string; // "native" or Currency.id
  symbol: string;
  decimals: number;
  kind: "NATIVE" | "ERC20";
  tokenAddress?: string | null;
};

export async function GET() {
  await prismaReady;

  const native: CurrencyOption = {
    id: "native",
    symbol: "ETN",
    decimals: 18,
    kind: "NATIVE",
    tokenAddress: null,
  };

  const rows = await prisma.currency.findMany({
    where: { active: true, kind: CurrencyKind.ERC20 },
    select: { id: true, symbol: true, decimals: true, kind: true, tokenAddress: true },
    orderBy: { symbol: "asc" },
  });

  const currencies: CurrencyOption[] = [
    native,
    ...rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      decimals: r.decimals ?? 18,
      kind: "ERC20" as const,
      tokenAddress: r.tokenAddress ?? null,
    })),
  ];

  const resp = NextResponse.json({ currencies }, { status: 200 });
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}
