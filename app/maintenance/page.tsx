// app/maintenance/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(77,238,84,0.11),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(77,238,84,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(77,238,84,0.08),transparent_24%)]" />

      <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-12 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10 md:px-6">
        <section className="w-full max-w-2xl overflow-hidden rounded-4xl border border-border bg-card/90 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl md:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Scheduled maintenance
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-border bg-background shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
              <span className="text-xl">🛠️</span>
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                We’re tuning things behind the scenes
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-7 text-muted md:text-[15px]">
                Our engineers are switching database service providers. While
                this work is in progress, this part of the site is temporarily
                unavailable.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-border bg-background/80 p-5">
            <div className="text-sm font-semibold text-foreground">
              Status: Maintenance in progress
            </div>

            <div className="mt-3 space-y-3 text-sm leading-7 text-muted">
              <p>
                Most maintenance windows are short. You can safely close this
                tab and check back a little later — your data and settings
                remain safe.
              </p>
              <p>
                Thanks for your patience while we upgrade the platform.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-card"
            >
              Try homepage later
            </Link>

            <div className="inline-flex h-11 items-center rounded-full border border-border bg-card px-5 text-sm text-muted">
              Panth.art platform upgrade
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}