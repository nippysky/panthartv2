import GovernanceSectionHeader from "@/src/components/admin/governance/GovernanceSectionHeader";
import RewardsPanel from "@/src/components/admin/governance/rewards/RewardsPanel";

// app/(admin)/[slug]/governance/rewards/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


type Ctx = { params: Promise<{ slug: string }> };

export default async function RewardsPage(ctx: Ctx) {
  await ctx.params;

  const allowedWallets = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <GovernanceSectionHeader
        title="Rewards"
        description="Fund, rotate, pause, rescue, and govern reward distribution flows through the same multisig-first admin system."
      />
      <RewardsPanel allowedWallets={allowedWallets} />
    </div>
  );
}