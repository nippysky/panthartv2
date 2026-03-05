export default function Loading() {
  return (
    <div className="pt-6 pb-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="py-8">
          <div className="h-6 w-24 rounded-full bg-black/5 dark:bg-white/10" />
          <div className="mt-4 h-10 w-56 rounded-2xl bg-black/5 dark:bg-white/10" />
          <div className="mt-3 h-5 w-[min(600px,90%)] rounded-xl bg-black/5 dark:bg-white/10" />

          <div className="mt-6 rounded-[26px] border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-black/5 dark:bg-white/10" />
              <div className="min-w-0 flex-1">
                <div className="h-5 w-64 rounded-xl bg-black/5 dark:bg-white/10" />
                <div className="mt-2 h-4 w-80 rounded-xl bg-black/5 dark:bg-white/10" />
              </div>
              <div className="h-10 w-28 rounded-full bg-black/5 dark:bg-white/10" />
            </div>
          </div>

          <div
            className="
              mt-6 grid gap-4 sm:gap-6
              grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5
            "
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[26px] border border-border bg-card/50 overflow-hidden"
              >
                <div className="aspect-square bg-black/5 dark:bg-white/10" />
                <div className="p-3.5">
                  <div className="h-4 w-40 rounded-xl bg-black/5 dark:bg-white/10" />
                  <div className="mt-3 h-7 w-28 rounded-2xl bg-black/5 dark:bg-white/10" />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="h-9 rounded-full bg-black/5 dark:bg-white/10" />
                    <div className="h-9 rounded-full bg-black/5 dark:bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}