export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="h-5 w-20 rounded-full bg-black/5 dark:bg-white/10" />
          <div className="mt-3 h-8 w-72 rounded-2xl bg-black/5 dark:bg-white/10" />
          <div className="mt-2 h-4 w-[min(620px,90%)] rounded-xl bg-black/5 dark:bg-white/10" />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-8 w-16 rounded-full bg-black/5 dark:bg-white/10" />
          <div className="h-8 w-24 rounded-full bg-black/5 dark:bg-white/10" />
        </div>
      </div>

      <section className="mb-6 overflow-hidden rounded-[28px] border border-border bg-card">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-4 min-h-55 bg-black/5 dark:bg-white/10" />
          <div className="lg:col-span-8 p-5 sm:p-6">
            <div className="h-4 w-28 rounded-xl bg-black/5 dark:bg-white/10" />
            <div className="mt-3 h-8 w-[min(520px,92%)] rounded-2xl bg-black/5 dark:bg-white/10" />
            <div className="mt-3 h-4 w-[min(680px,96%)] rounded-xl bg-black/5 dark:bg-white/10" />
            <div className="mt-2 h-4 w-[min(610px,88%)] rounded-xl bg-black/5 dark:bg-white/10" />

            <div className="mt-5 flex flex-wrap gap-2">
              <div className="h-8 w-18 rounded-full bg-black/5 dark:bg-white/10" />
              <div className="h-8 w-16 rounded-full bg-black/5 dark:bg-white/10" />
              <div className="h-8 w-24 rounded-full bg-black/5 dark:bg-white/10" />
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
            <div className="h-44 w-full bg-black/5 dark:bg-white/10" />
            <div className="p-4 sm:p-5">
              <div className="h-5 w-44 rounded-xl bg-black/5 dark:bg-white/10" />
              <div className="mt-2 h-4 w-52 rounded-xl bg-black/5 dark:bg-white/10" />

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <div className="h-3 w-12 rounded-lg bg-black/5 dark:bg-white/10" />
                  <div className="mt-2 h-5 w-24 rounded-xl bg-black/5 dark:bg-white/10" />
                </div>
                <div className="text-right">
                  <div className="ml-auto h-3 w-14 rounded-lg bg-black/5 dark:bg-white/10" />
                  <div className="mt-2 ml-auto h-5 w-10 rounded-xl bg-black/5 dark:bg-white/10" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="h-3 w-12 rounded-lg bg-black/5 dark:bg-white/10" />
                  <div className="mt-2 h-5 w-28 rounded-xl bg-black/5 dark:bg-white/10" />
                </div>
                <div className="text-right">
                  <div className="ml-auto h-3 w-12 rounded-lg bg-black/5 dark:bg-white/10" />
                  <div className="mt-2 ml-auto h-5 w-28 rounded-xl bg-black/5 dark:bg-white/10" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="h-9 rounded-full bg-black/5 dark:bg-white/10" />
                <div className="h-9 rounded-full bg-black/5 dark:bg-white/10" />
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}