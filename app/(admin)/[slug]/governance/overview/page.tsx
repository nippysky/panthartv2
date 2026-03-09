// app/(admin)/[slug]/governance/overview/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import GovernanceSectionHeader from "../_components/GovernanceSectionHeader";
import OverviewClient from "./ui/OverviewClient";

type Ctx = { params: Promise<{ slug: string }> };

export default async function OverviewPage(ctx: Ctx) {
  const { slug } = await ctx.params;

  const allowedWallets = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <GovernanceSectionHeader
        title="Overview"
        description="Monitor the multisig, recent governance activity, owner confirmations, and overall control state from one clear summary view."
      />
      <OverviewClient
        allowedWallets={allowedWallets}
        baseHref={`/${slug}/governance`}
      />
    </div>
  );
}