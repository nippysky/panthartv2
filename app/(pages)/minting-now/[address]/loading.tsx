// app/(pages)/minting-now/[address]/loading.tsx
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

export default function Loading() {
  return (
    <div className="min-h-svh overflow-x-hidden">
      <Container size="xl" className="py-6 md:py-10">
        {/* breadcrumbs */}
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <Shimmer className="h-4 w-14 rounded-lg" />
          <span className="opacity-40">/</span>
          <Shimmer className="h-4 w-24 rounded-lg" />
          <span className="opacity-40">/</span>
          <Shimmer className="h-4 w-44 rounded-lg" />
        </div>

        {/* hero */}
        <div className="relative overflow-hidden rounded-[28px] border border-border">
          <Shimmer className="h-80 sm:h-90 md:h-105 rounded-none" />
          <div className="absolute inset-0 bg-black/25" />

          <div className="absolute left-4 right-4 top-4 sm:left-6 sm:right-6 sm:top-6 md:left-7 md:right-7 md:top-7">
            <div className="max-w-3xl rounded-3xl border border-white/12 bg-white/8 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="p-4 sm:p-6">
                <div className="flex items-start gap-4">
                  <Shimmer className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white/10" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Shimmer className="h-6 w-24 rounded-full bg-white/10" />
                      <Shimmer className="h-4 w-44 rounded-lg bg-white/10" />
                    </div>

                    <Shimmer className="mt-3 h-8 w-[min(520px,95%)] rounded-xl bg-white/10" />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Shimmer className="h-7 w-56 rounded-full bg-white/10" />
                      <Shimmer className="h-7 w-64 rounded-full bg-white/10" />
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/12 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Shimmer className="h-9 w-9 rounded-full bg-white/10" />
                        <div className="space-y-2">
                          <Shimmer className="h-4 w-40 rounded-lg bg-white/10" />
                          <Shimmer className="h-3 w-24 rounded-lg bg-white/10" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Shimmer className="h-9 w-14 rounded-2xl bg-white/10" />
                        <Shimmer className="h-9 w-16 rounded-2xl bg-white/10" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* tiny line-clamp hint */}
            <div className="mt-4 max-w-3xl">
              <Shimmer className="h-4 w-[min(680px,95%)] rounded-lg bg-white/10" />
            </div>
          </div>
        </div>

        {/* About */}
        <div className="mt-6 rounded-[28px] border border-border bg-card p-4 sm:p-5">
          <Shimmer className="h-4 w-20 rounded-lg" />
          <Shimmer className="mt-3 h-4 w-[min(820px,96%)] rounded-lg" />
          <Shimmer className="mt-2 h-4 w-[min(760px,92%)] rounded-lg" />
          <Shimmer className="mt-2 h-4 w-[min(680px,88%)] rounded-lg" />
        </div>

        {/* Mint + Items */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[.92fr,1.08fr] items-start">
          {/* Mint panel */}
          <div className="rounded-[28px] ring-1 ring-border bg-background/95 p-4 md:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <Shimmer className="h-5 w-20 rounded-lg" />
              <Shimmer className="h-6 w-24 rounded-full" />
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Shimmer className="h-4 w-24 rounded-lg" />
                <Shimmer className="h-4 w-28 rounded-lg" />
              </div>
              <Shimmer className="h-2 w-full rounded-full" />
              <div className="flex items-center justify-between">
                <Shimmer className="h-3 w-32 rounded-lg" />
                <Shimmer className="h-3 w-10 rounded-lg" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Shimmer className="h-16 rounded-2xl" />
              <Shimmer className="h-16 rounded-2xl" />
              <Shimmer className="h-16 rounded-2xl" />
              <Shimmer className="h-16 rounded-2xl" />
            </div>

            <Shimmer className="mt-4 h-11 w-full rounded-2xl" />
          </div>

          {/* Items panel */}
          <div>
            <Shimmer className="mb-3 h-4 w-16 rounded-lg" />
            <div className="rounded-[28px] border border-border bg-card p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <Shimmer className="h-10 w-60 rounded-full" />
                <Shimmer className="h-10 w-28 rounded-full" />
              </div>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-3xl border border-border bg-card overflow-hidden">
                    <Shimmer className="aspect-square w-full rounded-none" />
                    <div className="p-3">
                      <Shimmer className="h-4 w-3/5 rounded-lg" />
                      <Shimmer className="mt-2 h-3 w-2/5 rounded-lg" />
                      <Shimmer className="mt-4 h-8 w-full rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
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
    </div>
  );
}