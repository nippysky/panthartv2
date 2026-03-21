import LoadingPanel from "@/src/features/warpool/components/LoadingPanel";

export default function WarpoolQueueLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground page-enter">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <LoadingPanel className="h-10 w-24 rounded-full" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[34px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-4">
                <LoadingPanel className="h-7 w-32 rounded-full" />
                <LoadingPanel className="h-11 w-72 rounded-3xl" />
                <LoadingPanel className="h-5 w-[90%] rounded-full" />
                <LoadingPanel className="h-5 w-[70%] rounded-full" />
              </div>

              <div className="rounded-3xl border border-border bg-background/80 px-4 py-3">
                <LoadingPanel className="h-3 w-12 rounded-full" />
                <LoadingPanel className="mt-2 h-7 w-20 rounded-full" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <LoadingPanel className="h-24 rounded-3xl" />
              <LoadingPanel className="h-24 rounded-3xl" />
              <LoadingPanel className="h-24 rounded-3xl" />
            </div>

            <div className="mt-6 rounded-[28px] border border-border bg-background/80 p-5">
              <div className="mb-3 flex items-center justify-between">
                <LoadingPanel className="h-4 w-28 rounded-full" />
                <LoadingPanel className="h-4 w-14 rounded-full" />
              </div>
              <LoadingPanel className="h-2.5 w-full rounded-full" />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <LoadingPanel className="h-32 rounded-3xl" />
              <LoadingPanel className="h-32 rounded-3xl" />
              <LoadingPanel className="h-32 rounded-3xl" />
            </div>
          </section>

          <aside className="space-y-5">
            <LoadingPanel className="h-195 rounded-[34px]" />
            <LoadingPanel className="h-85 rounded-[30px]" />
            <LoadingPanel className="h-65 rounded-[34px]" />
          </aside>
        </div>
      </div>
    </main>
  );
}