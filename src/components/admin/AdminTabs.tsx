"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { label: "Submissions", href: (slug: string) => `/${slug}/submissions` },
  { label: "Reconcile", href: (slug: string) => `/${slug}/reconcile` },
  { label: "Governance", href: (slug: string) => `/${slug}/governance` },
  { label: "Warpool", href: (slug: string) => `/${slug}/warpool` },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminTabs({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap items-center gap-2"
    >
      {ITEMS.map((item) => {
        const href = item.href(slug);
        const active = isActive(pathname, href);

        return (
          <Link
            key={item.label}
            href={href}
            className={[
              "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-all duration-200",
              active
                ? "border border-border bg-foreground text-background shadow-sm"
                : "border border-border bg-card text-foreground hover:bg-background",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}