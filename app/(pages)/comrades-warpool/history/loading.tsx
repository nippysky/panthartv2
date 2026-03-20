export default function WarpoolHistoryLoading() {
  return (
    <main className="min-h-screen bg-[#06070A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-pulse">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-10 w-24 rounded-full bg-white/10" />
          <div className="h-10 w-40 rounded-full bg-white/10" />
        </div>

        <div className="rounded-[36px] bg-white/10 p-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div className="space-y-4">
              <div className="h-7 w-28 rounded-full bg-white/10" />
              <div className="h-12 w-72 rounded-3xl bg-white/10" />
              <div className="h-5 w-[520px] max-w-full rounded-full bg-white/10" />
              <div className="h-5 w-[420px] max-w-full rounded-full bg-white/10" />
            </div>
            <div className="hidden h-24 w-28 rounded-[24px] bg-black/20 lg:block" />
          </div>

          <div className="grid gap-4">
            <div className="h-28 rounded-[28px] bg-black/20" />
            <div className="h-28 rounded-[28px] bg-black/20" />
            <div className="h-28 rounded-[28px] bg-black/20" />
            <div className="h-28 rounded-[28px] bg-black/20" />
            <div className="h-28 rounded-[28px] bg-black/20" />
          </div>
        </div>
      </div>
    </main>
  );
}