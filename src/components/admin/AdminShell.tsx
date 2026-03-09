// src/components/admin/AdminShell.tsx
import type { ReactNode } from "react";
import AdminTabs from "@/src/components/admin/AdminTabs";

export default function AdminShell({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.06),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(120,120,120,0.05),transparent_24%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_20%)]" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-400 flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-30 mb-6">
          <div className="rounded-[28px] border border-border bg-background/78 p-3 shadow-[0_8px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
                  Panth.art Admin
                </div>
                <div className="mt-1 truncate text-base font-semibold md:text-lg">
                  {slug}
                </div>
              </div>

              <div className="flex justify-start lg:justify-end">
                <AdminTabs slug={slug} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}