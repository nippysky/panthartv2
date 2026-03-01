"use client";

import { useLoaderStore } from "@/src/lib/store/loader-store";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function LoaderModal() {
  const { isVisible, message } = useLoaderStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isVisible) timeout = setTimeout(() => setMounted(true), 0);
    else timeout = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timeout);
  }, [isVisible]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-1100 flex items-center justify-center bg-background/70 backdrop-blur-sm transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="w-[320px] max-w-[92vw] rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-border bg-background flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Working…</div>
            <p className="text-xs text-muted-foreground wrap-break-word mt-1">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
