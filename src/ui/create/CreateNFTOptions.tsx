// src/ui/create/CreateNFTOptions.tsx
"use client";

import Link from "next/link";
import { MoveRight } from "lucide-react";
import { cn } from "@/src/lib/utils";

export const CREATE_NFT_OPTIONS = [
  {
    title: "Collection (ERC-721 Drop)",
    desc: "Launch a collection with optional allowlist/presale and a public mint. You can also self-mint items now and open the drop later.",
    href: "/create/drop",
    meta: "Recommended",
  },
  {
    title: "Single NFT (ERC-721)",
    desc: "Mint a true 1/1 with unique metadata—ideal for a single artwork or collectible. List or auction it immediately.",
    href: "/create/erc-721",
    meta: "1/1",
  },
  {
    title: "Single (ERC-1155)",
    desc: "Create one token with many editions (shared metadata). Set total supply and let the public mint. Perfect for passes, merch, or game items.",
    href: "/create/erc-1155",
    meta: "Editions",
  },
];

function MetaPill({ text }: { text: string }) {
  const isRecommended = text.toLowerCase().includes("recommended");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm",
        isRecommended
          ? "border-foreground/15 bg-foreground text-background"
          : "border-border bg-card text-muted-foreground"
      )}
    >
      {text}
    </span>
  );
}

/**
 * ✅ Revamp: card grid (not stacked list) so it feels “designed”, not “packed”.
 * - 1 column on mobile, 2 on md, 3 on xl
 * - Better hierarchy + slightly taller cards for breathing room
 */
export default function CreateNFTOptions() {
  return (
    <section className="w-full">
      <ul className="grid gap-3 md:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CREATE_NFT_OPTIONS.map((option) => (
          <li key={option.href} className="min-w-0">
            <Link
              href={option.href}
              aria-label={option.title}
              className={cn(
                "group relative block h-full overflow-hidden rounded-[28px] border border-border bg-card/70",
                "transition will-change-transform",
                "hover:-translate-y-0.5 hover:border-foreground/15 hover:bg-card/85",
                "hover:shadow-[0_18px_60px_rgba(0,0,0,0.10)]",
                "active:translate-y-0 active:shadow-[0_10px_30px_rgba(0,0,0,0.08)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
              )}
            >
              {/* subtle premium wash */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200",
                  "bg-[radial-gradient(900px_260px_at_20%_0%,rgba(99,102,241,0.14),transparent_60%),radial-gradient(900px_260px_at_85%_100%,rgba(16,185,129,0.12),transparent_55%)]",
                  "group-hover:opacity-100"
                )}
              />

              <div className="relative p-5 sm:p-6 flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-[15px] sm:text-base font-semibold tracking-tight">
                        {option.title}
                      </h2>
                      {option.meta ? <MetaPill text={option.meta} /> : null}
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {option.desc}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      "border border-border bg-background/70 shadow-sm backdrop-blur",
                      "transition-transform duration-200",
                      "group-hover:translate-x-0.5"
                    )}
                    aria-hidden="true"
                  >
                    <MoveRight className="h-5 w-5 opacity-80" />
                  </span>
                </div>

                {/* bottom rail for “breathing” + consistent height */}
                <div className="mt-auto pt-4">
                  <div className="h-px w-full bg-border/70" />
                  <div className="mt-3 text-xs text-muted-foreground">
                    Continue →
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}