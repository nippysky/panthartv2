import GovernanceSectionHeader from "@/src/components/admin/governance/GovernanceSectionHeader";
import MarketplaceAdminPanel from "@/src/components/admin/governance/marketplace/MarketplaceAdminPanel";

// app/(admin)/[slug]/governance/marketplace/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


type Ctx = { params: Promise<{ slug: string }> };

export default async function MarketplacePage(ctx: Ctx) {
  await ctx.params;

  const allowedWallets = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <GovernanceSectionHeader
        title="Marketplace"
        description="Manage marketplace configuration, pause state, supported currencies, and related multisig actions without changing the underlying admin logic."
      />
      <MarketplaceAdminPanel allowedWallets={allowedWallets} />
    </div>
  );
}