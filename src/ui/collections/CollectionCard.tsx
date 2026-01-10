// src/ui/collections/CollectionCard.tsx
import * as React from "react";
import Link from "next/link";

type Props = {
  href: string;
  name: string;
  symbol: string;
  logoUrl: string | null;
  coverUrl: string | null;
  floorActiveEtn: number | null;
  volumeAllTimeEtn: number;
  itemsCount: number;
  ownersCount: number;
  indexStatus: string;
};

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (abs >= 100) return `${n.toFixed(0)}`;
  if (abs >= 10) return `${n.toFixed(2)}`;
  return `${n.toFixed(3)}`;
}

function statusLabel(indexStatus: string): { text: string; tone: "muted" | "good" | "warn" } {
  const s = String(indexStatus || "").toUpperCase();
  if (s === "COMPLETED") return { text: "Indexed", tone: "good" };
  if (s === "INDEXING" || s === "QUEUED" || s === "PENDING") return { text: "Indexing", tone: "warn" };
  if (s === "ERROR") return { text: "Needs attention", tone: "warn" };
  return { text: "Indexing", tone: "muted" };
}

export default function CollectionCard(p: Props) {
  const st = statusLabel(p.indexStatus);

  return (
    <Link
      href={p.href}
      className="group block rounded-3xl border border-border bg-card overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.06)] hover:bg-card/80 transition"
    >
      {/* Cover */}
      <div className="relative h-24 sm:h-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.10),rgba(0,0,0,0))]" />
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            loading="lazy"
          />
        ) : null}
        <div className="absolute inset-0 bg-linear-to-t from-card via-card/40 to-transparent" />
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-2xl border border-border bg-background overflow-hidden shrink-0">
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.logoUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-semibold tracking-tight truncate">{p.name}</div>
              <span className="text-xs text-muted truncate">· {p.symbol}</span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span
                className={[
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  st.tone === "good"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : st.tone === "warn"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : "border-border bg-background text-muted",
                ].join(" ")}
              >
                {st.text}
              </span>
            </div>
          </div>
        </div>

        {/* Metrics (responsive, no overflow) */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background p-3 min-w-0">
            <div className="text-[11px] text-muted">Floor (active)</div>
            <div className="mt-1 text-sm font-semibold truncate">
              {p.floorActiveEtn == null ? "—" : `${formatCompact(p.floorActiveEtn)} ETN`}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-3 min-w-0">
            <div className="text-[11px] text-muted">Volume (all-time)</div>
            <div className="mt-1 text-sm font-semibold truncate">
              {formatCompact(p.volumeAllTimeEtn)} ETN
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-3 min-w-0">
            <div className="text-[11px] text-muted">Items</div>
            <div className="mt-1 text-sm font-semibold truncate">
              {p.itemsCount.toLocaleString()}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-3 min-w-0">
            <div className="text-[11px] text-muted">Owners</div>
            <div className="mt-1 text-sm font-semibold truncate">
              {p.ownersCount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
