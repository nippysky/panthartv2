import LoadingPanel from "@/src/features/warpool/components/LoadingPanel";

export default function WarpoolHistoryLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground page-enter">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <LoadingPanel className="h-10 w-24 rounded-full" />
        </div>

        <section className="rounded-[36px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)] sm:p-7">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <LoadingPanel className="h-7 w-32 rounded-full" />
              <LoadingPanel className="h-11 w-56 rounded-3xl" />
              <LoadingPanel className="h-5 w-[92%] max-w-2xl rounded-full" />
              <LoadingPanel className="h-5 w-[72%] max-w-xl rounded-full" />
            </div>

            <div className="rounded-3xl border border-border bg-background/80 px-4 py-3">
              <LoadingPanel className="h-3 w-20 rounded-full" />
              <LoadingPanel className="mt-2 h-7 w-10 rounded-full" />
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <LoadingPanel className="h-12 w-full rounded-full" />
              <LoadingPanel className="h-12 w-full rounded-full sm:w-52" />
            </div>

            <LoadingPanel className="h-4 w-24 rounded-full" />
          </div>

          <div className="grid gap-4">
            <LoadingPanel className="h-28 rounded-[28px]" />
            <LoadingPanel className="h-28 rounded-[28px]" />
            <LoadingPanel className="h-28 rounded-[28px]" />
            <LoadingPanel className="h-28 rounded-[28px]" />
            <LoadingPanel className="h-28 rounded-[28px]" />
          </div>
        </section>
      </div>
    </main>
  );
}