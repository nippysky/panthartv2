// app/(admin)/[slug]/submissions/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { notFound } from "next/navigation";
import CollectionSubmissionsTable from "@/src/components/admin/CollectionSubmissionsTable";

type PageContext = { params: Promise<{ slug: string }> };

/**
 * Unguessable segment check.
 * Only render if the secret segment matches ADMIN_SLUG.
 */
export default async function AdminSubmissionsPage(ctx: PageContext) {
  const { slug } = await ctx.params;

  const adminSlug = process.env.ADMIN_SLUG || "";
  if (!adminSlug || slug !== adminSlug) {
    notFound();
  }

  const allowedWallets = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-350 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_22%)]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              Panth.art Admin
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Collection Submissions
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              Review pending collection submissions in a cleaner moderation
              workspace with better hierarchy, calmer actions, and a more refined
              approval flow.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-117.5">
            <div className="rounded-[22px] border border-border bg-background/80 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                Scope
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                Pending review queue
              </div>
            </div>

            <div className="rounded-[22px] border border-border bg-background/80 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                Goal
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                Faster moderation
              </div>
            </div>

            <div className="rounded-[22px] border border-border bg-background/80 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                Style
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                Apple-premium minimal
              </div>
            </div>
          </div>
        </div>
      </section>

      <CollectionSubmissionsTable allowedWallets={allowedWallets} />
    </div>
  );
}