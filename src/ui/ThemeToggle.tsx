"use client";

import * as React from "react";
import { useTheme } from "next-themes";

type Opt = { id: "system" | "light" | "dark"; label: string };

const OPTIONS: Opt[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    // Ensure a consistent baseline: system first.
    if (!theme) setTheme("system");
  }, [theme, setTheme]);

  const current: Opt["id"] = (mounted ? (theme as Opt["id"]) : "system") ?? "system";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted">Theme</span>

      <div
        role="group"
        aria-label="Theme selection"
        className="
          inline-flex items-center
          rounded-full border border-border bg-card p-1
          shadow-[0_1px_0_rgba(255,255,255,0.06)]
        "
      >
        {OPTIONS.map((opt) => {
          const active = current === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              aria-pressed={active}
              className={[
                "h-9 px-3 rounded-full text-xs font-medium transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                active
                  ? "bg-background text-foreground border border-border"
                  : "text-foreground/75 hover:text-foreground hover:bg-foreground/5",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
