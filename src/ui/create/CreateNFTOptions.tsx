// src/ui/create/CreateNFTOptions.tsx
"use client";

import Link from "next/link";
import { MoveRight } from "lucide-react";
import { cn } from "@/src/lib/utils";

export const CREATE_NFT_OPTIONS = [
  {
    title: "Collection (ERC-721 Drop)",
    desc: "Launch a collection with optional allowlist, presale, and public mint. You can also self-mint items now and open the drop later.",
    href: "/create/drop",
    meta: "Recommended",
  },
  {
    title: "Single NFT (ERC-721)",
    desc: "Mint a true 1/1 with unique metadata for a single artwork or collectible, then list or auction it immediately.",
    href: "/create/erc-721",
    meta: "1/1",
  },
  {
    title: "Single (ERC-1155)",
    desc: "Create one token with many editions using shared metadata. Ideal for passes, merch, collectibles, or game items.",
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
          : "border-border bg-card/80 text-muted-foreground"
      )}
    >
      {text}
    </span>
  );
}

function CardGlow() {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300",
        "bg-[radial-gradient(1000px_320px_at_15%_0%,rgba(56,189,248,0.10),transparent_55%),radial-gradient(1000px_320px_at_85%_100%,rgba(168,85,247,0.10),transparent_55%)]",
        "group-hover:opacity-100 group-focus-visible:opacity-100"
      )}
    />
  );
}

export default function CreateNFTOptions() {
  return (
    <section className="w-full">
      <ul className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">
        {CREATE_NFT_OPTIONS.map((option) => (
          <li key={option.href} className="min-w-0">
            <Link
              href={option.href}
              aria-label={option.title}
              className={cn(
                "group relative flex h-full min-h-63 flex-col overflow-hidden rounded-[30px] border border-border bg-card/72",
                "transition-all duration-200 will-change-transform",
                "hover:-translate-y-0.5 hover:border-foreground/15 hover:bg-card/88",
                "hover:shadow-[0_18px_60px_rgba(0,0,0,0.10)]",
                "active:translate-y-0 active:shadow-[0_10px_28px_rgba(0,0,0,0.08)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
              )}
            >
              <CardGlow />

              <div className="relative flex h-full flex-col p-5 sm:p-6 lg:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-[18px]">
                        {option.title}
                      </h2>
                      {option.meta ? <MetaPill text={option.meta} /> : null}
                    </div>

                    <p className="mt-3 max-w-[34ch] text-sm leading-7 text-muted-foreground sm:text-[15px]">
                      {option.desc}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                      "border border-border bg-background/70 shadow-sm backdrop-blur",
                      "transition-transform duration-200",
                      "group-hover:translate-x-0.5"
                    )}
                    aria-hidden="true"
                  >
                    <MoveRight className="h-5 w-5 opacity-80" />
                  </span>
                </div>

                <div className="mt-auto pt-8">
                  <div className="h-px w-full bg-border/70" />
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground/88 transition-transform duration-200 group-hover:translate-x-0.5">
                    <span>Continue</span>
                    <span aria-hidden="true">→</span>
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