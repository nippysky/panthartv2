"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function shortenAddress(addr: string, a = 6, b = 4) {
  const s = addr.trim();
  if (s.length <= a + b + 3) return s;
  return `${s.slice(0, a)}…${s.slice(-b)}`;
}

function lc(s?: string | null) {
  return (s ?? "").trim().toLowerCase();
}

export function useAddressLabels(addresses: Array<string | null | undefined>) {
  const want = useMemo(() => {
    return Array.from(
      new Set(
        addresses
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map(lc)
      )
    );
  }, [addresses]);

  const [map, setMap] = useState<Record<string, string>>({});
  const fetchedRef = useRef(new Set<string>());

  useEffect(() => {
    const missing = want.filter((a) => !fetchedRef.current.has(a));
    if (missing.length === 0) return;

    missing.forEach((a) => fetchedRef.current.add(a));

    void (async () => {
      const res = await fetch("/api/users/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: missing }),
      }).catch(() => null);

      const data = await res?.json().catch(() => null);
      const next = (data?.map ?? {}) as Record<string, string>;

      if (next && typeof next === "object") {
        setMap((prev) => ({ ...prev, ...next }));
      }
    })();
  }, [want]);

  const labelFor = useCallback(
    (addr?: string | null) => {
      const a = (addr ?? "").trim();
      if (!a) return null;

      const u = map[lc(a)];
      if (u) return `@${u}`;
      return shortenAddress(a, 6, 4);
    },
    [map]
  );

  return { labelFor };
}
