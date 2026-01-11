// app/collections/[contract]/[tokenId]/loading.tsx
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="h-5 w-40 rounded bg-black/10 dark:bg-white/10 mb-3" />
      <div className="h-8 w-80 rounded bg-black/10 dark:bg-white/10 mb-8" />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 overflow-hidden">
          <div className="h-105 sm:h-135 w-full bg-black/10 dark:bg-white/10" />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4">
            <div className="h-4 w-24 rounded bg-black/10 dark:bg-white/10" />
            <div className="mt-3 h-8 w-full rounded bg-black/10 dark:bg-white/10" />
          </div>
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4">
            <div className="h-4 w-28 rounded bg-black/10 dark:bg-white/10" />
            <div className="mt-3 h-36 w-full rounded bg-black/10 dark:bg-white/10" />
          </div>
        </div>
      </section>
    </main>
  );
}
