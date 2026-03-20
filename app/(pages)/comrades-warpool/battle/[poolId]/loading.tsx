export default function WarpoolBattleLoading() {
  return (
    <main className="min-h-screen bg-[#06070A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-pulse">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-10 w-24 rounded-full bg-white/10" />
          <div className="h-10 w-40 rounded-full bg-white/10" />
        </div>

        <div className="rounded-[36px] bg-white/10 p-6">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="h-7 w-28 rounded-full bg-white/10" />
              <div className="mt-5 h-12 w-52 rounded-3xl bg-white/10" />
              <div className="mt-3 h-5 w-56 rounded-full bg-white/10" />

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="h-24 rounded-[24px] bg-black/20" />
                <div className="h-24 rounded-[24px] bg-black/20" />
                <div className="h-24 rounded-[24px] bg-black/20" />
              </div>

              <div className="mt-6 h-[320px] rounded-[28px] bg-black/20" />
            </div>

            <div className="space-y-5">
              <div className="h-[240px] rounded-[30px] bg-black/20" />
              <div className="h-[220px] rounded-[30px] bg-black/20" />
              <div className="h-[220px] rounded-[30px] bg-black/20" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}