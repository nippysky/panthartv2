import LoadingPanel from "@/src/features/warpool/components/LoadingPanel";

export default function ComradesWarpoolLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground page-enter">
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 -top-55 h-130 w-130 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl dark:bg-accent/8" />
          <div className="absolute left-[10%] top-[14%] h-48 w-48 rounded-full bg-accent/8 blur-3xl dark:bg-accent/6" />
          <div className="absolute right-[10%] top-[18%] h-56 w-56 rounded-full bg-foreground/5 blur-3xl dark:bg-accent/5" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="space-y-6">
              <LoadingPanel className="h-7 w-40 rounded-full" />

              <div className="space-y-4">
                <LoadingPanel className="h-14 w-[92%] rounded-3xl sm:h-16" />
                <LoadingPanel className="h-14 w-[72%] rounded-3xl sm:h-16" />
                <LoadingPanel className="h-5 w-[88%] rounded-full" />
                <LoadingPanel className="h-5 w-[78%] rounded-full" />
              </div>

              <div className="flex flex-wrap gap-3">
                <LoadingPanel className="h-12 w-36 rounded-full" />
                <LoadingPanel className="h-12 w-36 rounded-full" />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <LoadingPanel className="h-32 rounded-[26px]" />
                <LoadingPanel className="h-32 rounded-[26px]" />
                <LoadingPanel className="h-32 rounded-[26px]" />
              </div>
            </div>

            <div className="rounded-4xl border border-border bg-card/85 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)]">
              <div className="mb-5 flex items-center justify-between">
                <div className="space-y-2">
                  <LoadingPanel className="h-3 w-20 rounded-full" />
                  <LoadingPanel className="h-7 w-36 rounded-full" />
                </div>
                <LoadingPanel className="h-5 w-5 rounded-full" />
              </div>

              <div className="space-y-3">
                <LoadingPanel className="h-24 rounded-3xl" />
                <LoadingPanel className="h-24 rounded-3xl" />
                <LoadingPanel className="h-24 rounded-3xl" />
              </div>

              <LoadingPanel className="mt-4 h-5 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="space-y-2">
            <LoadingPanel className="h-3 w-24 rounded-full" />
            <LoadingPanel className="h-8 w-44 rounded-full" />
          </div>

          <LoadingPanel className="hidden h-10 w-24 rounded-full sm:block" />
        </div>

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <LoadingPanel className="h-12 w-full rounded-full" />
            <LoadingPanel className="h-12 w-full rounded-full sm:w-52" />
          </div>

          <LoadingPanel className="h-4 w-24 rounded-full" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <LoadingPanel className="h-71.5 rounded-[30px]" />
          <LoadingPanel className="h-71.5 rounded-[30px]" />
          <LoadingPanel className="h-71.5 rounded-[30px]" />
          <LoadingPanel className="h-71.5 rounded-[30px]" />
        </div>
      </section>
    </main>
  );
}