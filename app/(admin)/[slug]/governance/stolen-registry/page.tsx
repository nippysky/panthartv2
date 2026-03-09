import GovernanceSectionHeader from "@/src/components/admin/governance/GovernanceSectionHeader";
import RegistryAdminPanel from "@/src/components/admin/governance/stolen/RegistryAdminPanel";

// app/(admin)/[slug]/governance/stolen-registry/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


type Ctx = { params: Promise<{ slug: string }> };

export default async function StolenRegistryPage(ctx: Ctx) {
  await ctx.params;

  const allowedWallets = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <GovernanceSectionHeader
        title="Stolen Registry"
        description="Manage registry operations, reported queues, pause state, role checks, and related multisig activity from a cleaner moderation-oriented workflow."
      />
      <RegistryAdminPanel allowedWallets={allowedWallets} />
    </div>
  );
}