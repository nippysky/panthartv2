"use client";

import * as React from "react";
import Link from "next/link";
import { Slash } from "lucide-react";
import { cn } from "../lib/utils";

export function BreadcrumbsBar({
  items,
  className,
}: {
  items: Array<{ type: "link"; href: string; label: string } | { type: "page"; label: string }>;
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-5 mt-2", className)}>
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {items.map((c, i) => (
          <React.Fragment key={`${c.type}:${"href" in c ? c.href : c.label}`}>
            {i > 0 && <Slash className="h-3.5 w-3.5 opacity-50" />}
            <li className="min-w-0">
              {c.type === "link" ? (
                <Link
                  href={c.href}
                  className="text-muted hover:text-foreground transition truncate"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="text-foreground font-semibold truncate">{c.label}</span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}
