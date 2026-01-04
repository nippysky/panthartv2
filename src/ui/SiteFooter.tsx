"use client";

import * as React from "react";
import Link from "next/link";
import { Container } from "@/src/ui/Container";
import { ThemeToggle } from "@/src/ui/ThemeToggle";
import { FaTelegramPlane } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const NAV: { title: string; items: FooterLink[] }[] = [
  {
    title: "Directory",
    items: [
      { label: "Collections", href: "/collections" },
      { label: "Minting Now", href: "/minting-now" },
      { label: "Live Auctions", href: "/auction" },
    ],
  },
  {
    title: "Explore",
    items: [
      { label: "Explore Panthart", href: "/explore" },
      { label: "Create a Collection", href: "/create" },
      { label: "Submit a Collection", href: "/submit-collection" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "Documentation", href: "https://docs.panth.art", external: true },
      {
        label: "Terms & Conditions",
        href: "https://docs.panth.art/governance-and-policies/terms-and-conditions",
        external: true,
      },
    ],
  },
];

const SOCIALS = {
  x: "https://x.com/decentroneum",
  telegram: "https://t.me/DecentroneumGroupChat",
  decentroneum: "https://decentroneum.com",
};

function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <header className="max-w-3xl">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">
        {desc}
      </p>
    </header>
  );
}

function SocialButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="
        group inline-flex items-center justify-center gap-2
        rounded-full border border-border bg-background
        px-5 h-11 text-sm font-semibold
        transition
        hover:border-foreground/20 hover:bg-card
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
        shadow-[0_1px_0_rgba(255,255,255,0.06)]
      "
    >
      <span
        className="
          grid place-items-center h-8 w-8 rounded-full
          border border-border bg-card
          transition
          group-hover:border-foreground/15
          group-hover:shadow-[0_8px_28px_color-mix(in_oklab,var(--accent)_18%,transparent)]
        "
        aria-hidden="true"
      >
        {icon}
      </span>
      <span>{label}</span>
    </a>
  );
}

function NavColumn({ title, items }: { title: string; items: FooterLink[] }) {
  return (
    <div className="min-w-48">
      <div className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">
        {title}
      </div>

      <ul className="mt-4 space-y-2.5">
        {items.map((i) => {
          const externalProps = i.external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {};

          return (
            <li key={`${title}-${i.href}`}>
              <Link
                href={i.href}
                {...externalProps}
                className="
                  text-sm text-foreground/80
                  transition-colors
                  hover:text-foreground
                  underline-offset-4 hover:underline
                "
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const year = React.useMemo(() => new Date().getFullYear(), []);

  return (
    <footer className="pt-16 sm:pt-24 pb-20">
      <Container>
        <div
          className="
            rounded-3xl border border-border bg-card p-8 sm:p-10
            shadow-[0_1px_0_rgba(255,255,255,0.06)]
          "
        >
          <SectionTitle
            title="Stay connected"
            desc="Panthart is the NFT marketplace of the Electroneum ecosystem — mint, trade, and discover digital assets with speed, clarity, and trust."
          />

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <SocialButton
              href={SOCIALS.x}
              label="Follow on X"
              icon={<FaXTwitter className="h-4 w-4 text-primary" />}
            />
            <SocialButton
              href={SOCIALS.telegram}
              label="Join Telegram"
              icon={<FaTelegramPlane className="h-4 w-4 text-primary" />}
            />
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {NAV.map((col) => (
              <NavColumn key={col.title} title={col.title} items={col.items} />
            ))}
          </div>

          <div className="mt-10 border-t border-border/70 pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="text-xs text-muted" suppressHydrationWarning>
                © {year} Panthart. All rights reserved.
              </div>

              {/* ✅ Mobile fix: stack controls to avoid squishing ThemeToggle */}
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
                <Link
                  href={SOCIALS.decentroneum}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted hover:text-foreground underline-offset-4 hover:underline"
                >
                  Visit Decentroneum
                </Link>

                {/* Prevent the toggle from shrinking/distorting */}
                <div className="shrink-0 overflow-x-auto max-w-full">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
