// src/app/loading.tsx
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

function SectionHeaderSkeleton({
  eyebrowW = "w-16",
  titleW = "w-56",
  descW = "w-[min(520px,90%)]",
  showButton = true,
}: {
  eyebrowW?: string;
  titleW?: string;
  descW?: string;
  showButton?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="max-w-2xl">
        <Shimmer className={`h-3 rounded-lg ${eyebrowW}`} />
        <Shimmer className={`mt-2 h-6 rounded-xl ${titleW}`} />
        <Shimmer className={`mt-3 h-4 rounded-xl ${descW}`} />
      </div>

      {showButton ? (
        <Shimmer className="hidden h-10 w-28 rounded-full sm:block" />
      ) : null}
    </div>
  );
}

function MarketHeroSkeleton() {
  return (
    <section className="pt-2 sm:pt-4">
      <Container>
        <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-5 sm:p-7">
          <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.10),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.08),transparent_50%)]" />

          <div className="relative flex flex-col gap-5 sm:gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Shimmer className="h-6 w-20 rounded-full" />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <Shimmer className="h-9 w-40 rounded-full" />
                <Shimmer className="h-9 w-32 rounded-full" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5 mt-3">
              <Shimmer className="h-10 w-full rounded-full sm:w-40" />
              <Shimmer className="h-10 w-full rounded-full sm:w-40" />
              <Shimmer className="h-10 w-full rounded-full sm:w-36" />
              <Shimmer className="h-10 w-full rounded-full sm:w-40" />
            </div>

            <div className="mt-3 sm:mt-0 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
              <div className="lg:col-span-7 rounded-3xl border border-border bg-background/40 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <Shimmer className="h-16 w-16 shrink-0 rounded-2xl" />

                    <div className="min-w-0 flex-1">
                      <Shimmer className="h-3 w-20 rounded-lg" />
                      <Shimmer className="mt-2 h-4 w-[min(420px,80%)] rounded-lg" />

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Shimmer className="h-7 w-16 rounded-full" />
                        <Shimmer className="h-7 w-24 rounded-full" />
                        <Shimmer className="h-7 w-20 rounded-full" />
                      </div>
                    </div>
                  </div>

                  <Shimmer className="h-9 w-full rounded-full sm:w-28" />
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-border bg-background/40 p-4 sm:p-5"
                  >
                    <Shimmer className="h-3 w-16 rounded-lg" />
                    <Shimmer className="mt-2 h-4 w-28 rounded-lg" />
                    <Shimmer className="mt-3 h-3 w-32 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="h-3 sm:h-5" />
      </Container>
    </section>
  );
}

function WarpoolPromoSkeleton() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[36px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <div className="space-y-5">
            <Shimmer className="h-8 w-36 rounded-full" />

            <div className="space-y-4">
              <Shimmer className="h-8 w-[min(560px,92%)] rounded-xl sm:h-10" />
              <Shimmer className="h-8 w-[min(480px,82%)] rounded-xl sm:h-10" />

              <div className="space-y-2 pt-1">
                <Shimmer className="h-4 w-[min(520px,92%)] rounded-lg" />
                <Shimmer className="h-4 w-[min(470px,82%)] rounded-lg" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Shimmer className="h-8 w-32 rounded-full" />
              <Shimmer className="h-8 w-32 rounded-full" />
              <Shimmer className="h-8 w-32 rounded-full" />
            </div>

            <div className="flex flex-wrap gap-3">
              <Shimmer className="h-11 w-36 rounded-full" />
              <Shimmer className="h-11 w-32 rounded-full" />
            </div>
          </div>

          <div className="rounded-[30px] border border-border bg-background/80 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <Shimmer className="h-3 w-20 rounded-lg" />
                <Shimmer className="mt-2 h-5 w-32 rounded-lg" />
              </div>

              <Shimmer className="h-7 w-20 rounded-full" />
            </div>

            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Shimmer className="h-4 w-36 rounded-lg" />
                      <Shimmer className="mt-2 h-3 w-28 rounded-lg" />
                    </div>

                    <Shimmer className="h-6 w-16 rounded-full" />
                  </div>

                  <Shimmer className="mt-3 h-3 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TopCollectionsSkeletonSection() {
  return (
    <section className="pt-10 sm:pt-14">
      <Container>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Shimmer className="h-3 w-14 rounded-lg" />
            <Shimmer className="mt-2 h-6 w-44 rounded-xl" />
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Shimmer className="h-9 w-40 rounded-full" />
            <Shimmer className="h-9 w-24 rounded-full" />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-border bg-card px-4 py-4"
            >
              <div className="flex items-center gap-3">
                <Shimmer className="h-11 w-11 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <Shimmer className="h-4 w-44 rounded-lg" />
                  <Shimmer className="mt-2 h-3 w-56 rounded-lg" />
                </div>

                <div className="hidden sm:flex flex-col items-end gap-2">
                  <Shimmer className="h-3 w-24 rounded-lg" />
                  <Shimmer className="h-4 w-28 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Shimmer className="h-3 w-40 rounded-lg" />
        </div>
      </Container>
    </section>
  );
}

function MintingNowSkeletonSection() {
  return (
    <section className="py-10 sm:py-14">
      <Container>
        <SectionHeaderSkeleton
          eyebrowW="w-16"
          titleW="w-40"
          descW="w-[min(440px,85%)]"
        />

        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-border bg-card/50 overflow-hidden"
            >
              <Shimmer className="aspect-square w-full rounded-none" />
              <div className="p-3 sm:p-4">
                <Shimmer className="h-4 w-3/5 rounded-lg" />
                <Shimmer className="mt-2 h-3 w-2/5 rounded-lg" />
                <Shimmer className="mt-4 h-4 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 sm:hidden">
          <Shimmer className="h-11 w-full rounded-2xl" />
        </div>
      </Container>
    </section>
  );
}

function ActiveListingsSkeletonSection() {
  return (
    <section className="py-10 sm:py-14">
      <Container>
        <SectionHeaderSkeleton
          eyebrowW="w-14"
          titleW="w-28"
          descW="w-[min(420px,82%)]"
        />

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-border bg-card/50 overflow-hidden"
            >
              <div className="relative">
                <Shimmer className="aspect-square w-full rounded-none" />
                <div className="absolute left-3 top-3">
                  <Shimmer className="h-6 w-20 rounded-full" />
                </div>
              </div>

              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Shimmer className="h-4 w-4/5 rounded-lg" />
                    <Shimmer className="mt-2 h-3 w-2/5 rounded-lg" />
                  </div>

                  <Shimmer className="h-4 w-16 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 sm:hidden">
          <Shimmer className="h-11 w-full rounded-2xl" />
        </div>
      </Container>
    </section>
  );
}

function LiveAuctionsSkeletonSection() {
  return (
    <section className="pt-10 sm:pt-14">
      <Container>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Shimmer className="h-3 w-14 rounded-lg" />
            <Shimmer className="mt-2 h-6 w-36 rounded-xl" />
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Shimmer className="h-7 w-16 rounded-full" />
            <Shimmer className="h-9 w-24 rounded-full" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[28px] border border-border bg-card overflow-hidden"
            >
              <div className="relative h-44 w-full">
                <Shimmer className="h-full w-full rounded-none" />
                <div className="absolute left-3 top-3">
                  <Shimmer className="h-6 w-14 rounded-full" />
                </div>
                <div className="absolute right-3 top-3">
                  <Shimmer className="h-6 w-20 rounded-full" />
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <Shimmer className="h-4 w-4/5 rounded-lg" />
                <Shimmer className="mt-2 h-3 w-2/5 rounded-lg" />

                <div className="mt-5 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Shimmer className="h-3 w-16 rounded-lg" />
                    <Shimmer className="mt-2 h-4 w-24 rounded-lg" />
                  </div>

                  <div className="shrink-0">
                    <Shimmer className="h-3 w-10 rounded-lg" />
                    <Shimmer className="mt-2 h-4 w-8 rounded-lg" />
                  </div>
                </div>

                <Shimmer className="mt-5 h-9 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Shimmer className="h-3 w-36 rounded-lg" />
        </div>
      </Container>
    </section>
  );
}

export default function Loading() {
  return (
    <div className="min-h-svh">
      <div className="pt-6 sm:pt-10">
        <MarketHeroSkeleton />

        <div className="h-10 sm:h-14" />
        <WarpoolPromoSkeleton />

        <div className="h-10 sm:h-14" />
        <TopCollectionsSkeletonSection />

        <div className="h-10 sm:h-14" />
        <MintingNowSkeletonSection />

        <div className="h-10 sm:h-14" />
        <ActiveListingsSkeletonSection />

        <div className="h-10 sm:h-14" />
        <LiveAuctionsSkeletonSection />

        <div className="h-10 sm:h-16" />
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
    </div>
  );
}