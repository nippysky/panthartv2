import GovernanceSectionHeader from "@/src/components/admin/governance/GovernanceSectionHeader";
import MultisigAdminClient from "@/src/components/admin/governance/multisig/MultisigAdminClient";

// app/(admin)/[slug]/governance/transactions/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


type Ctx = { params: Promise<{ slug: string }> };

export default async function TransactionsPage(ctx: Ctx) {
  await ctx.params;

  const allowedWallets = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <GovernanceSectionHeader
        title="Transactions"
        description="Review multisig activity, confirm or execute ready transactions, and submit new governance actions through the safe."
      />
      <MultisigAdminClient allowedWallets={allowedWallets} />
    </div>
  );
}