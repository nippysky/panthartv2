"use client";

import React from "react";

export function ButtonLink({
  href,
  children,
  disabled,
  title,
}: {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  if (disabled) {
    return (
      <span
        title={title}
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-background px-4 text-sm opacity-60 cursor-not-allowed"
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      title={title}
      className="inline-flex h-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-background px-4 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition"
    >
      {children}
    </a>
  );
}
