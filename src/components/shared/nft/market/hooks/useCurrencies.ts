"use client";

import { useEffect, useState } from "react";
import { CurrencyOption } from "../types";


export function useCurrencies() {
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([
    { id: "native", symbol: "ETN", decimals: 18, kind: "NATIVE", tokenAddress: null },
  ]);
  const [currLoading, setCurrLoading] = useState(true);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setCurrLoading(true);
        const res = await fetch("/api/currencies", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { currencies?: CurrencyOption[] } | null;

        const list = Array.isArray(json?.currencies) ? json!.currencies! : [];
        if (!ok) return;

        const native: CurrencyOption = {
          id: "native",
          symbol: "ETN",
          decimals: 18,
          kind: "NATIVE",
          tokenAddress: null,
        };

        const rest = list.filter((c) => c.id !== "native");
        setCurrencies([native, ...rest]);
      } catch {
        // keep default
      } finally {
        if (ok) setCurrLoading(false);
      }
    })();

    return () => {
      ok = false;
    };
  }, []);

  return { currencies, currLoading };
}
