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

export default function Loading() {
  return (
    <div className="min-h-svh">
      <Container>
        {/* top spacing matches home */}
        <div className="pt-6 sm:pt-10">
          {/* Hero shell */}
          <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-5 sm:p-7">
            <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.10),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.08),transparent_50%)]" />

            <div className="relative flex flex-col gap-5 sm:gap-6">
              {/* top row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Shimmer className="h-6 w-24 rounded-full" />
                </div>
                <div className="flex gap-3">
                  <Shimmer className="h-9 w-40 rounded-full" />
                  <Shimmer className="h-9 w-32 rounded-full hidden sm:block" />
                </div>
              </div>

              {/* pills */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2.5">
                <Shimmer className="h-10 w-full sm:w-44 rounded-full" />
                <Shimmer className="h-10 w-full sm:w-44 rounded-full" />
                <Shimmer className="h-10 w-full sm:w-44 rounded-full" />
                <Shimmer className="h-10 w-full sm:w-44 rounded-full" />
              </div>

              {/* spotlight + actions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
                <div className="lg:col-span-7 rounded-3xl border border-border bg-background/40 p-4 sm:p-5">
                  <div className="flex items-center gap-4">
                    <Shimmer className="h-16 w-16 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Shimmer className="h-3 w-24 rounded-lg" />
                      <Shimmer className="h-4 w-[min(420px,80%)] rounded-lg" />
                      <div className="flex gap-2">
                        <Shimmer className="h-7 w-20 rounded-full" />
                        <Shimmer className="h-7 w-28 rounded-full" />
                        <Shimmer className="h-7 w-24 rounded-full" />
                      </div>
                    </div>
                    <Shimmer className="h-9 w-28 rounded-full" />
                  </div>
                </div>

                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-3xl border border-border bg-background/40 p-4 sm:p-5">
                    <Shimmer className="h-3 w-20 rounded-lg" />
                    <Shimmer className="mt-2 h-4 w-28 rounded-lg" />
                    <Shimmer className="mt-3 h-3 w-32 rounded-lg" />
                  </div>
                  <div className="rounded-3xl border border-border bg-background/40 p-4 sm:p-5">
                    <Shimmer className="h-3 w-20 rounded-lg" />
                    <Shimmer className="mt-2 h-4 w-24 rounded-lg" />
                    <Shimmer className="mt-3 h-3 w-36 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* spacing blocks mimic homepage rhythm */}
          <div className="h-6 sm:h-10" />

          {/* two section shells */}
          <div className="space-y-6">
            <div className="flex items-end justify-between gap-6">
              <div className="max-w-2xl">
                <Shimmer className="h-3 w-16 rounded-lg" />
                <Shimmer className="mt-2 h-6 w-56 rounded-xl" />
                <Shimmer className="mt-3 h-4 w-[min(520px,90%)] rounded-xl" />
              </div>
              <Shimmer className="h-10 w-28 rounded-full hidden sm:block" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-border bg-card/50 overflow-hidden">
                  <Shimmer className="aspect-square w-full rounded-none" />
                  <div className="p-3 sm:p-4">
                    <Shimmer className="h-4 w-3/5 rounded-lg" />
                    <Shimmer className="mt-2 h-3 w-2/5 rounded-lg" />
                    <Shimmer className="mt-4 h-4 w-24 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-10 sm:h-16" />
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
    </div>
  );
}