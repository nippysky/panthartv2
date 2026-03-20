export default function WarpoolQueueLoading() {
  return (
    <main className="min-h-screen bg-[#06070A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-pulse">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-10 w-24 rounded-full bg-white/10" />
          <div className="h-10 w-40 rounded-full bg-white/10" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[34px] bg-white/10 p-6">
            <div className="h-7 w-28 rounded-full bg-white/10" />
            <div className="mt-5 h-12 w-1/2 rounded-3xl bg-white/10" />
            <div className="mt-4 h-5 w-full rounded-full bg-white/10" />
            <div className="mt-2 h-5 w-2/3 rounded-full bg-white/10" />

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="h-24 rounded-[24px] bg-black/20" />
              <div className="h-24 rounded-[24px] bg-black/20" />
              <div className="h-24 rounded-[24px] bg-black/20" />
            </div>

            <div className="mt-6 h-28 rounded-[28px] bg-black/20" />
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="h-32 rounded-[24px] bg-black/20" />
              <div className="h-32 rounded-[24px] bg-black/20" />
              <div className="h-32 rounded-[24px] bg-black/20" />
            </div>
          </div>

          <div className="space-y-5">
            <div className="h-[360px] rounded-[34px] bg-white/10" />
            <div className="h-[280px] rounded-[34px] bg-white/10" />
          </div>
        </div>
      </div>
    </main>
  );
}