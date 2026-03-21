"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  slug: string;
};

const ITEMS = [
  {
    label: "Overview",
    href: (slug: string) => `/admin/${slug}/warpool`,
  },
  {
    label: "Config",
    href: (slug: string) => `/admin/${slug}/warpool/config`,
  },
  {
    label: "Proposals",
    href: (slug: string) => `/admin/${slug}/warpool/proposals`,
  },
  {
    label: "Runtime",
    href: (slug: string) => `/admin/${slug}/warpool/runtime`,
  },
];

function isActive(pathname: string, href: string) {
  if (href.endsWith("/warpool")) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function WarpoolSectionTabs({ slug }: Props) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Warpool sections"
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