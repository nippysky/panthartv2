"use client";

import { useEffect, useRef } from "react";

type Options = {
  enabled?: boolean;
  intervalMs?: number;
};

export function usePolling(
  callback: () => void | Promise<void>,
  options: Options = {}
) {
  const { enabled = true, intervalMs = 15000 } = options;
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      void saved.current();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
}