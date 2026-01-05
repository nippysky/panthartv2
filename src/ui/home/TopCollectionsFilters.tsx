// src/ui/app/home/TopCollectionsFilters.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "../LoadingSpinner";


type WindowKey = "24h" | "7d" | "30d";

const OPTIONS: Array<{ key: WindowKey; label: string }> = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
];

export default function TopCollectionsFilters({ active }: { active: WindowKey }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  function setWindow(next: WindowKey) {
    const params = new URLSearchParams(sp.toString());
    if (next === "24h") params.delete("tw");
    else params.set("tw", next);

    startTransition(() => {
      router.replace(`/?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
      {OPTIONS.map((o) => {
        const isActive = o.key === active;

        return (
          <button
            key={o.key}
            type="button"
            onClick={() => setWindow(o.key)}
            disabled={pending && !isActive}
            className={[
              "relative inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-semibold",
              "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
              pending && !isActive ? "opacity-50" : "",
            ].join(" ")}
            aria-current={isActive ? "true" : "false"}
          >
            {isActive && pending ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner className="h-3.5 w-3.5" />
                {o.label}
              </span>
            ) : (
              o.label
            )}
          </button>
        );
      })}
    </div>
  );
}
