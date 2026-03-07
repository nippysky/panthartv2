// app/(pages)/collections/[contract]/[tokenId]/auctions/loading.tsx
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-10 animate-pulse">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="h-4 w-20 rounded bg-black/8 dark:bg-white/8" />
          <div className="mt-3 h-8 w-72 max-w-[80vw] rounded bg-black/8 dark:bg-white/8" />
          <div className="mt-2 h-4 w-96 max-w-[90vw] rounded bg-black/6 dark:bg-white/6" />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-8 w-16 rounded-full bg-black/8 dark:bg-white/8" />
          <div className="h-8 w-24 rounded-full bg-black/8 dark:bg-white/8" />
        </div>
      </div>

      <section className="mb-6 overflow-hidden rounded-[28px] border border-border bg-card">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-4 min-h-55 bg-black/6 dark:bg-white/6" />
          <div className="lg:col-span-8 p-5 sm:p-6">
            <div className="h-4 w-28 rounded bg-black/8 dark:bg-white/8" />
            <div className="mt-3 h-7 w-80 max-w-[90%] rounded bg-black/8 dark:bg-white/8" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full rounded bg-black/6 dark:bg-white/6" />
              <div className="h-4 w-[92%] rounded bg-black/6 dark:bg-white/6" />
              <div className="h-4 w-[70%] rounded bg-black/6 dark:bg-white/6" />
            </div>
            <div className="mt-4 flex gap-2">
              <div className="h-7 w-20 rounded-full bg-black/8 dark:bg-white/8" />
              <div className="h-7 w-20 rounded-full bg-black/8 dark:bg-white/8" />
              <div className="h-7 w-24 rounded-full bg-black/8 dark:bg-white/8" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[28px] border border-border bg-card"
          >
            <div className="h-44 w-full bg-black/6 dark:bg-white/6" />
            <div className="p-4 sm:p-5">
              <div className="h-5 w-2/3 rounded bg-black/8 dark:bg-white/8" />
              <div className="mt-2 h-4 w-3/4 rounded bg-black/6 dark:bg-white/6" />

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <div className="h-3 w-14 rounded bg-black/6 dark:bg-white/6" />
                  <div className="mt-2 h-5 w-24 rounded bg-black/8 dark:bg-white/8" />
                </div>
                <div className="text-right">
                  <div className="ml-auto h-3 w-14 rounded bg-black/6 dark:bg-white/6" />
                  <div className="mt-2 ml-auto h-5 w-10 rounded bg-black/8 dark:bg-white/8" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="h-3 w-12 rounded bg-black/6 dark:bg-white/6" />
                  <div className="mt-2 h-5 w-10 rounded bg-black/8 dark:bg-white/8" />
                </div>
                <div className="text-right">
                  <div className="ml-auto h-3 w-12 rounded bg-black/6 dark:bg-white/6" />
                  <div className="mt-2 ml-auto h-5 w-20 rounded bg-black/8 dark:bg-white/8" />
                </div>
              </div>

              <div className="mt-5 h-9 w-full rounded-full bg-black/8 dark:bg-white/8" />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}