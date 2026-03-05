// src/app/minting-now/loading.tsx
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

function MintCardSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-card p-3 shadow-sm">
      {/* media */}
      <div className="relative w-full aspect-square overflow-hidden rounded-2xl ring-1 ring-black/5">
        <Shimmer className="absolute inset-0 rounded-none" />

        {/* logo */}
        <div className="absolute left-3 top-3">
          <Shimmer className="h-9 w-9 rounded-xl" />
        </div>

        {/* status chip */}
        <div className="absolute right-3 top-3">
          <Shimmer className="h-6 w-20 rounded-full" />
        </div>

        {/* bottom gradient mimic */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/20 to-transparent" />
      </div>

      {/* content */}
      <div className="mt-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <Shimmer className="h-4 w-3/5 rounded-lg" />
          <Shimmer className="h-3 w-12 rounded-lg" />
        </div>

        {/* progress */}
        <Shimmer className="h-2 w-full rounded-full" />

        <div className="flex items-center justify-between text-[11px]">
          <Shimmer className="h-3 w-24 rounded-lg" />
          <Shimmer className="h-3 w-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-svh overflow-x-hidden">
      <section className="pt-10 sm:pt-14">
        <Container>
          {/* header skeleton */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Shimmer className="h-8 w-44 rounded-xl" />
              <Shimmer className="mt-3 h-4 w-[min(520px,90%)] rounded-lg" />
            </div>

            <div className="flex gap-2">
              <Shimmer className="h-10 w-32 rounded-2xl" />
              <Shimmer className="h-10 w-28 rounded-2xl" />
            </div>
          </div>

          {/* cards grid */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <MintCardSkeleton key={i} />
            ))}
          </div>
        </Container>
      </section>

      <div className="h-10 sm:h-16" />

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
    </div>
  );
}