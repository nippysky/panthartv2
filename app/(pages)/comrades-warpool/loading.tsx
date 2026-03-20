export default function ComradesWarpoolLoading() {
  return (
    <main className="min-h-screen bg-[#06070A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-pulse">
        <div className="mb-10 flex items-center justify-between">
          <div className="h-9 w-36 rounded-full bg-white/10" />
          <div className="h-10 w-40 rounded-full bg-white/10" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="h-7 w-32 rounded-full bg-white/10" />
            <div className="h-14 w-3/4 rounded-3xl bg-white/10" />
            <div className="h-5 w-full rounded-full bg-white/10" />
            <div className="h-5 w-2/3 rounded-full bg-white/10" />
            <div className="flex gap-3">
              <div className="h-12 w-36 rounded-full bg-white/10" />
              <div className="h-12 w-32 rounded-full bg-white/10" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="h-36 rounded-[26px] bg-white/10" />
              <div className="h-36 rounded-[26px] bg-white/10" />
              <div className="h-36 rounded-[26px] bg-white/10" />
            </div>
          </div>

          <div className="h-[360px] rounded-[32px] bg-white/10" />
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <div className="h-64 rounded-[30px] bg-white/10" />
          <div className="h-64 rounded-[30px] bg-white/10" />
          <div className="h-64 rounded-[30px] bg-white/10" />
        </div>
      </div>
    </main>
  );
}