"use client";

import { useEffect, useState } from "react";

export function useNowTicker() {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return nowMs;
}
