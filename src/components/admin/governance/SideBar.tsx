// src/components/admin/governance/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gift,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShieldAlert,
  Store,
} from "lucide-react";

const items: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { href: "overview", label: "Overview", icon: LayoutDashboard },
  { href: "transactions", label: "Transactions", icon: ReceiptText },
  { href: "marketplace", label: "Marketplace", icon: Store },
  { href: "rewards", label: "Rewards", icon: Gift },
  { href: "stolen-registry", label: "Stolen Registry", icon: ShieldAlert },
  { href: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ baseHref }: { baseHref: string }) {
  const pathname = usePathname();

  return (
    <nav className="rounded-3xl border border-border bg-card p-3">
      <div className="mb-3 px-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Governance Sections
        </div>
      </div>

      <div className="grid gap-1.5">
        {items.map((it) => {
          const href = `${baseHref}/${it.href}`;
          const active = pathname?.startsWith(href);
          const Icon = it.icon;

          return (
            <Link
              key={it.href}
              href={href}
              className={[
                "group flex items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-medium transition-all duration-200",
                active
                  ? "border border-border bg-foreground text-background shadow-sm"
                  : "border border-transparent text-muted hover:border-border hover:bg-background hover:text-foreground",
              ].join(" ")}
            >
              <Icon
                size={16}
                className={[
                  "shrink-0 transition-colors",
                  active
                    ? "text-background"
                    : "text-muted group-hover:text-foreground",
                ].join(" ")}
              />
              <span className="truncate">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}