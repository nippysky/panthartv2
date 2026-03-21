import LoadingPanel from "@/src/features/warpool/components/LoadingPanel";

export default function WarpoolBattleLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground page-enter">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <LoadingPanel className="h-10 w-24 rounded-full" />
        </div>

        <section className="rounded-[36px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <LoadingPanel className="h-7 w-24 rounded-full" />

              <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <LoadingPanel className="h-11 w-48 rounded-3xl" />
                  <LoadingPanel className="h-5 w-52 rounded-full" />
                </div>

                <LoadingPanel className="h-12 w-28 rounded-3xl" />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <LoadingPanel className="h-24 rounded-3xl" />
                <LoadingPanel className="h-24 rounded-3xl" />
                <LoadingPanel className="h-24 rounded-3xl" />
              </div>

              <div className="mt-6 rounded-[28px] border border-border bg-background/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="space-y-2">
                    <LoadingPanel className="h-4 w-24 rounded-full" />
                    <LoadingPanel className="h-4 w-36 rounded-full" />
                  </div>
                  <LoadingPanel className="h-5 w-5 rounded-full" />
                </div>

                <div className="grid gap-4">
                  <LoadingPanel className="h-28 rounded-3xl" />
                  <LoadingPanel className="h-28 rounded-3xl" />
                  <LoadingPanel className="h-28 rounded-3xl" />
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <LoadingPanel className="h-85 rounded-[30px]" />
              <LoadingPanel className="h-80 rounded-[30px]" />
              <LoadingPanel className="h-65 rounded-[30px]" />
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}