// app/(PAGES)/listing/loading.tsx
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

function ListingCardSkeleton() {
  return (
    <div
      className={[
        "h-full overflow-hidden rounded-[28px] border border-border bg-card/50",
        "shadow-[0_1px_0_rgba(255,255,255,0.06)]",
      ].join(" ")}
    >
      <div className="relative aspect-square bg-foreground/5">
        <Shimmer className="h-full w-full rounded-none" />

        {/* chip */}
        <div className="absolute left-3 top-3 z-10">
          <Shimmer className="h-7 w-24 rounded-full" />
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Shimmer className="h-4 w-3/5 rounded-lg" />
            <Shimmer className="mt-2 h-3 w-2/5 rounded-lg" />
          </div>

          <div className="shrink-0 text-right">
            <Shimmer className="h-3 w-10 rounded-lg ml-auto" />
            <Shimmer className="mt-2 h-4 w-16 rounded-lg ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <section className="pt-20 sm:pt-24 pb-16">
      <Container>
        {/* Header */}
        <header className="max-w-2xl">
          <Shimmer className="h-3 w-16 rounded-lg" />
          <Shimmer className="mt-3 h-8 w-40 rounded-xl" />
          <Shimmer className="mt-3 h-4 w-[min(520px,92%)] rounded-xl" />
          <Shimmer className="mt-2 h-4 w-[min(460px,85%)] rounded-xl" />
        </header>

        <div className="mt-6 sm:mt-8">
          {/* Top controls row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* segmented skeleton */}
            <div className="inline-flex rounded-full border border-border bg-card/60 p-1">
              <Shimmer className="h-9 w-16 rounded-full" />
              <div className="w-1" />
              <Shimmer className="h-9 w-24 rounded-full" />
              <div className="w-1" />
              <Shimmer className="h-9 w-24 rounded-full" />
            </div>

            {/* showing count skeleton */}
            <div className="flex items-center gap-2">
              <Shimmer className="h-3 w-16 rounded-lg" />
              <Shimmer className="h-3 w-10 rounded-lg" />
              <Shimmer className="h-3 w-12 rounded-lg" />
            </div>
          </div>

          {/* Grid */}
          <div className="mt-5 sm:mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {Array.from({ length: 15 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>

          {/* Sentinel space */}
          <div className="h-10" />

          {/* Load more button skeleton */}
          <div className="mt-6 flex items-center justify-center">
            <Shimmer className="h-10 w-36 rounded-full" />
          </div>
        </div>
      </Container>

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
    </section>
  );
}