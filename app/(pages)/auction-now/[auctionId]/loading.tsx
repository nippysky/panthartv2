// app/(PAGES)/auction-now/[auctionId]/loading.tsx
import { Container } from "@/src/ui/Container";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden bg-foreground/5",
        "after:absolute after:inset-0",
        "after:translate-x-[-60%] after:animate-[panth-shimmer_1.1s_linear_infinite]",
        "after:bg-linear-to-r after:from-transparent after:via-foreground/10 after:to-transparent",
        className
      )}
    />
  );
}

function StatSkeleton() {
  return (
    <div className="min-w-0">
      <Shimmer className="h-3 w-20 rounded-lg" />
      <Shimmer className="mt-2 h-7 w-40 rounded-xl" />
      <Shimmer className="mt-3 h-10 w-full rounded-2xl" />
    </div>
  );
}

function BidRowSkeleton({ i }: { i: number }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[20px] border border-border bg-background/50 px-4 py-3"
      aria-hidden
    >
      <div className="flex items-center gap-2 min-w-0">
        <Shimmer className="h-5 w-5 rounded-full" />
        <Shimmer className="h-4 w-40 rounded-lg" />
        {i === 0 ? <Shimmer className="h-5 w-16 rounded-full" /> : null}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Shimmer className="h-4 w-24 rounded-lg" />
        <Shimmer className="h-3 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <section className="pt-8 pb-10">
      <Container size="xl">
        {/* top row */}
        <div className="flex items-center justify-between gap-3">
          <Shimmer className="h-10 w-24 rounded-full" />
          <div className="flex items-center gap-2">
            <Shimmer className="h-10 w-10 rounded-2xl" />
          </div>
        </div>

        {/* crumbs */}
        <div className="mt-3 flex items-center gap-2">
          <Shimmer className="h-4 w-14 rounded-lg" />
          <span className="opacity-40">/</span>
          <Shimmer className="h-4 w-20 rounded-lg" />
          <span className="opacity-40">/</span>
          <Shimmer className="h-4 w-24 rounded-lg" />
        </div>

        {/* hero */}
        <div className="mt-4 relative overflow-hidden rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.14),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.10),transparent_38%)]" />
          <div className="relative flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Shimmer className="h-7 w-20 rounded-full" />
              <Shimmer className="h-7 w-24 rounded-full" />
              <Shimmer className="h-7 w-28 rounded-full" />
            </div>

            <Shimmer className="h-9 w-[min(620px,92%)] rounded-xl" />

            <div className="space-y-2">
              <Shimmer className="h-4 w-[min(760px,92%)] rounded-xl" />
              <Shimmer className="h-4 w-[min(690px,88%)] rounded-xl" />
              <Shimmer className="h-4 w-[min(540px,84%)] rounded-xl" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Shimmer className="h-9 w-72 rounded-full" />
              <Shimmer className="h-9 w-56 rounded-full" />
            </div>
          </div>
        </div>

        {/* main */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
          {/* media */}
          <div className="lg:col-span-5 min-w-0">
            <div className="relative w-full aspect-square rounded-[28px] overflow-hidden bg-foreground/5 ring-1 ring-border">
              <Shimmer className="absolute inset-0 rounded-none" />
              <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_45%)]" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Shimmer className="h-11 rounded-[20px]" />
              <Shimmer className="h-11 rounded-[20px]" />
              <Shimmer className="h-11 rounded-[20px] col-span-2" />
            </div>
          </div>

          {/* right */}
          <div className="lg:col-span-7 flex flex-col gap-6 min-w-0">
            <div className="rounded-[28px] border border-border bg-card p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.12),transparent_42%)]" />
              <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </div>

              <div className="relative mt-5 rounded-3xl border border-border bg-background/50 p-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <Shimmer className="h-11 w-full rounded-2xl" />
                  <Shimmer className="h-11 w-full sm:w-36 rounded-2xl" />
                </div>

                <div className="mt-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <Shimmer className="h-3 w-44 rounded-lg" />
                  <Shimmer className="mt-2 h-7 w-56 rounded-xl" />
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <Shimmer className="h-11 w-36 rounded-2xl" />
                  <Shimmer className="h-4 w-56 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shimmer className="h-5 w-24 rounded-lg" />
                  <Shimmer className="h-6 w-20 rounded-full" />
                </div>
                <Shimmer className="h-4 w-28 rounded-lg" />
              </div>

              <div className="mt-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <BidRowSkeleton key={i} i={i} />
                ))}
              </div>
            </div>
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