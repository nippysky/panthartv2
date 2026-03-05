// app/(PAGES)/auction/loading.tsx
import { Container } from "@/src/ui/Container";

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl bg-foreground/5",
        "after:absolute after:inset-0",
        "after:translate-x-[-60%] after:animate-[panth-shimmer_1.1s_linear_infinite]",
        "after:bg-linear-to-r after:from-transparent after:via-foreground/10 after:to-transparent",
        className,
      ].join(" ")}
    />
  );
}

function AuctionCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-card/50 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
      <div className="relative aspect-square bg-foreground/5">
        <Shimmer className="h-full w-full rounded-none" />
        {/* top-left badge */}
        <div className="absolute left-3 top-3">
          <Shimmer className="h-7 w-16 rounded-full" />
        </div>
        {/* top-right badge */}
        <div className="absolute right-3 top-3">
          <Shimmer className="h-7 w-20 rounded-full" />
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-2">
        <Shimmer className="h-4 w-4/5 rounded-lg" />
        <Shimmer className="h-3 w-2/5 rounded-lg" />

        <div className="pt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Shimmer className="h-3 w-14 rounded-lg" />
            <Shimmer className="mt-2 h-4 w-20 rounded-lg" />
          </div>
          <div className="shrink-0 text-right">
            <Shimmer className="h-3 w-10 rounded-lg ml-auto" />
            <Shimmer className="mt-2 h-4 w-16 rounded-lg ml-auto" />
          </div>
        </div>

        <div className="pt-2">
          <Shimmer className="h-10 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <Container size="xl" className="py-6 md:py-10">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-2 text-sm text-muted">
        <Shimmer className="h-4 w-12 rounded-lg" />
        <span className="opacity-40">/</span>
        <Shimmer className="h-4 w-16 rounded-lg" />
      </nav>

      {/* Header hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_15%_10%,rgba(56,189,248,0.14),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_85%_90%,rgba(168,85,247,0.14),transparent_60%)]" />
          <div className="absolute inset-0 [background:linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.04)_45%,rgba(0,0,0,0.08)_100%)] dark:[background:linear-gradient(180deg,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0.30)_45%,rgba(0,0,0,0.65)_100%)]" />
        </div>

        <div className="relative p-5 md:p-7">
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-2">
              <Shimmer className="h-7 w-16 rounded-full" />
              <Shimmer className="h-4 w-44 rounded-lg" />
            </div>

            <Shimmer className="h-9 w-56 rounded-xl" />

            <div className="space-y-2">
              <Shimmer className="h-4 w-[min(680px,92%)] rounded-xl" />
              <Shimmer className="h-4 w-[min(560px,85%)] rounded-xl" />
            </div>

            {/* Toolbar */}
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:max-w-md">
                <Shimmer className="h-11 w-full rounded-2xl" />
              </div>

              <div className="flex items-center gap-2">
                <Shimmer className="h-4 w-10 rounded-lg hidden sm:block" />
                <Shimmer className="h-11 w-36 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <div className="mt-8">
        <section className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 mt-6 mb-16">
          {Array.from({ length: 10 }).map((_, i) => (
            <AuctionCardSkeleton key={i} />
          ))}
        </section>
      </div>

      <style>{`
        @keyframes panth-shimmer {
          0% { transform: translateX(-60%); }
          100% { transform: translateX(60%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .after\\:animate-\\[panth-shimmer_1\\.1s_linear_infinite\\]::after {
            animation: none !important;
          }
        }
      `}</style>
    </Container>
  );
}