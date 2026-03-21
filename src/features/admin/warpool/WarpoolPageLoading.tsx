/* eslint-disable @typescript-eslint/no-unused-vars */
export default function WarpoolPageLoading({
  eyebrow = "Warpool Admin",
  title = "Loading Warpool admin",
  description = "Preparing the latest Warpool admin data and controls.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section className="rounded-[28px] border border-border bg-card p-6 md:p-8">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            {eyebrow}
          </div>

          <div className="mt-4 h-10 w-72 animate-pulse rounded-2xl bg-background" />
          <div className="mt-3 h-5 w-full max-w-2xl animate-pulse rounded-xl bg-background" />
          <div className="mt-2 h-5 w-full max-w-xl animate-pulse rounded-xl bg-background" />

          <p className="mt-5 text-sm text-muted">{description}</p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-3xl border border-border bg-card p-5"
          >
            <div className="h-3 w-24 animate-pulse rounded-full bg-background" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded-xl bg-background" />
            <div className="mt-3 h-4 w-28 animate-pulse rounded-full bg-background" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[28px] border border-border bg-card p-6"
          >
            <div className="h-6 w-44 animate-pulse rounded-xl bg-background" />
            <div className="mt-4 space-y-3">
              <div className="h-4 w-full animate-pulse rounded-full bg-background" />
              <div className="h-4 w-[88%] animate-pulse rounded-full bg-background" />
              <div className="h-4 w-[76%] animate-pulse rounded-full bg-background" />
              <div className="h-4 w-[92%] animate-pulse rounded-full bg-background" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}