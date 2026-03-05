// src/app/profile/[address]/loading.tsx
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

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-3">
      <Shimmer className="h-3 w-20 rounded-lg" />
      <Shimmer className="mt-2 h-5 w-14 rounded-xl" />
    </div>
  );
}

function ChipSkeleton() {
  return <Shimmer className="h-8 w-28 rounded-full" />;
}

function TabSkeleton({ w = "w-28" }: { w?: string }) {
  return <Shimmer className={`h-10 ${w} rounded-full`} />;
}

function NftCardSkeleton() {
  return (
    <div className="rounded-[28px] border border-border bg-card overflow-hidden">
      <Shimmer className="aspect-square w-full rounded-none" />
      <div className="p-3 sm:p-4">
        <Shimmer className="h-4 w-3/5 rounded-lg" />
        <Shimmer className="mt-2 h-3 w-2/5 rounded-lg" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <Shimmer className="h-4 w-24 rounded-lg" />
          <Shimmer className="h-4 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-svh overflow-x-hidden">
      {/* Header shell (mirrors ProfileHeader structure) */}
      <div className="relative">
        {/* banner */}
        <div className="relative h-44 w-full overflow-hidden sm:h-60 md:h-72">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(77,238,84,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent)]" />
          <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/25 to-background" />
          <div className="absolute inset-0 [background:radial-gradient(900px_circle_at_30%_18%,rgba(77,238,84,0.12),transparent_55%)]" />
          <div className="absolute inset-0 opacity-60">
            <Shimmer className="h-full w-full rounded-none" />
          </div>
        </div>

        <Container>
          <div className="-mt-9 rounded-[28px] border border-border bg-card/75 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:-mt-12 sm:p-6">
            {/* crumbs */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Shimmer className="h-3 w-12 rounded-lg" />
              <span className="opacity-40">/</span>
              <Shimmer className="h-3 w-14 rounded-lg" />
            </div>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              {/* left identity */}
              <div className="flex min-w-0 gap-4">
                <Shimmer className="h-14 w-14 rounded-2xl sm:h-16 sm:w-16 md:h-20 md:w-20" />

                <div className="min-w-0">
                  <Shimmer className="h-7 w-[min(320px,75vw)] rounded-2xl" />

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Shimmer className="h-7 w-32 rounded-full" />
                    <Shimmer className="h-7 w-20 rounded-full" />
                    <Shimmer className="h-7 w-28 rounded-full" />
                  </div>

                  <div className="mt-3 max-w-2xl space-y-2">
                    <Shimmer className="h-4 w-[min(520px,88vw)] rounded-xl" />
                    <Shimmer className="h-4 w-[min(460px,80vw)] rounded-xl" />
                    <Shimmer className="h-4 w-[min(420px,74vw)] rounded-xl" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ChipSkeleton />
                    <ChipSkeleton />
                    <ChipSkeleton />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Shimmer className="h-9 w-28 rounded-full" />
                    <Shimmer className="h-9 w-36 rounded-full" />
                  </div>
                </div>
              </div>

              {/* right stats */}
              <div className="md:w-110">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                </div>

                {/* statsSlot area */}
                <div className="mt-3 flex flex-wrap items-center gap-2 justify-start md:justify-end">
                  <Shimmer className="h-9 w-28 rounded-full" />
                  <Shimmer className="h-9 w-36 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Tabs + grid shell (mirrors ProfileShell + ProfileTabsClient) */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-16">
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-border bg-card p-1">
              <TabSkeleton w="w-28" />
              <div className="w-1" />
              <TabSkeleton w="w-24" />
              <div className="w-1" />
              <TabSkeleton w="w-24" />
            </div>
          </div>

          {/* Tab content skeleton (assume NFT grid like collected/created) */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <NftCardSkeleton key={i} />
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Shimmer className="h-10 w-36 rounded-full" />
          </div>
        </div>
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