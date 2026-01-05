// src/ui/home/TopCollectionsTabs.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type WindowKey = "24h" | "7d" | "30d";

const TABS: Array<{ key: WindowKey; label: string }> = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
];

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

export function TopCollectionsTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const active = (params.get("tw") as WindowKey) || "24h";

  function setTab(next: WindowKey) {
    const sp = new URLSearchParams(params.toString());
    if (next === "24h") sp.delete("tw");
    else sp.set("tw", next);

    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
        {TABS.map((t) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cx(
                "h-9 rounded-full px-3 text-sm font-semibold transition",
                on
                  ? "bg-background text-foreground shadow-[0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-muted hover:text-foreground hover:bg-background/40"
              )}
              aria-pressed={on}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <Link
        href="/collections"
        className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-background/60 transition"
      >
        View all
      </Link>
    </div>
  );
}
