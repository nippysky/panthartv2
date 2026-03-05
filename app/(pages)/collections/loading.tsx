// src/app/collections/loading.tsx
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

function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <Shimmer className="h-12 w-12 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Shimmer className="h-4 w-44 rounded-lg" />
          <Shimmer className="mt-2 h-3 w-28 rounded-lg" />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Shimmer className="h-3 w-24 rounded-lg" />
            <Shimmer className="h-3 w-20 rounded-lg" />
          </div>
        </div>
        <div className="w-full sm:w-auto sm:shrink-0 sm:self-start flex justify-end">
          <Shimmer className="h-6 w-20 rounded-full" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-3">
          <Shimmer className="h-3 w-20 rounded-lg" />
          <Shimmer className="mt-2 h-4 w-24 rounded-lg" />
        </div>
        <div className="rounded-2xl border border-border bg-background p-3">
          <Shimmer className="h-3 w-24 rounded-lg" />
          <Shimmer className="mt-2 h-4 w-28 rounded-lg" />
        </div>
      </div>

      <Shimmer className="mt-4 h-3 w-44 rounded-lg" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-svh overflow-x-hidden">
      <section className="pt-10 sm:pt-14">
        <Container>
          {/* Header + controls skeleton (matches CollectionsClient layout) */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Shimmer className="h-8 w-44 rounded-2xl" />
              <Shimmer className="mt-3 h-4 w-[min(520px,90%)] rounded-xl" />
              <Shimmer className="mt-2 h-4 w-[min(460px,80%)] rounded-xl" />
              <Shimmer className="mt-3 h-3 w-28 rounded-lg" />
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2 lg:w-auto">
              <Shimmer className="h-10 w-full sm:w-40 rounded-2xl" />
              <Shimmer className="h-10 w-full sm:w-44 rounded-2xl" />
            </div>
          </div>

          {/* Grid skeleton */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>

          {/* Bottom “load more / end” area */}
          <div className="mt-6 flex justify-center">
            <Shimmer className="h-10 w-36 rounded-full" />
          </div>
        </Container>
      </section>

      <div className="h-10 sm:h-14" />

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