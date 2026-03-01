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
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card",
        "px-2.5 py-1 text-[11px] font-semibold text-muted-foreground",
        "shadow-sm"
      )}
    >
      {text}
    </span>
  );
}

export default function CreateNFTOptions() {
  return (
    <section className="w-full">
      <ul className="grid gap-3">
        {CREATE_NFT_OPTIONS.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              aria-label={option.title}
              className={cn(
                "group relative block overflow-hidden rounded-3xl border border-border bg-card",
                "transition will-change-transform",
                "hover:-translate-y-px hover:border-foreground/15 hover:shadow-[0_18px_60px_rgba(0,0,0,0.10)]",
                "active:translate-y-0 active:shadow-[0_10px_30px_rgba(0,0,0,0.08)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30"
              )}
            >
              {/* subtle inner wash */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200",
                  "bg-linear-to-br from-brand/10 via-transparent to-brandsec/10",
                  "group-hover:opacity-100"
                )}
              />

              <div className="relative p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-[1.05rem] font-semibold tracking-tight">
                        {option.title}
                      </h2>
                      {option.meta ? <MetaPill text={option.meta} /> : null}
                    </div>

                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {option.desc}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      "border border-border bg-background/70 shadow-sm",
                      "transition-transform duration-200",
                      "group-hover:translate-x-0.5"
                    )}
                    aria-hidden="true"
                  >
                    <MoveRight className="h-5 w-5 opacity-80" />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}