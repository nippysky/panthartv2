// app/(admin)/[slug]/governance/settings/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";
import GovernanceSectionHeader from "@/src/components/admin/governance/GovernanceSectionHeader";
import AddressChip from "@/src/ui/AddressChip";

export default async function SettingsPage() {
  const EXPLORER =
    process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
    process.env.NEXT_PUBLIC_BLOCK_EXPLORER ||
    "";

  const env = {
    NEXT_PUBLIC_MULTI_SIG_ADDRESS:
      process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS || "",
    NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS:
      process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS || "",
    NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS:
      process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || "",
    NEXT_PUBLIC_STOLEN_REGISTRY_ADDRESS:
      process.env.NEXT_PUBLIC_STOLEN_REGISTRY_ADDRESS || "",
    NEXT_PUBLIC_BLOCK_EXPLORER: EXPLORER || "",
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || "",
  };

  const addressKeys = new Set([
    "NEXT_PUBLIC_MULTI_SIG_ADDRESS",
    "NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS",
    "NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS",
    "NEXT_PUBLIC_STOLEN_REGISTRY_ADDRESS",
  ]);

  const ChipLink = ({ address }: { address: string }) => {
    if (!address) return <span className="text-muted">—</span>;
    const href = EXPLORER ? `${EXPLORER}/address/${address}` : "";
    return href ? (
      <Link href={href} target="_blank" className="inline-flex">
        <AddressChip address={address} showCopy />
      </Link>
    ) : (
      <AddressChip address={address} showCopy />
    );
  };

  return (
    <div className="space-y-6">
      <GovernanceSectionHeader
        title="Settings"
        description="Review environment-driven governance configuration and contract references used by the admin control panel."
      />

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Object.entries(env).map(([k, v]) => (
            <div
              key={k}
              className="rounded-[20px] border border-border bg-background p-4"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                {k}
              </div>

              <div className="mt-3">
                {addressKeys.has(k) ? (
                  <ChipLink address={v} />
                ) : k === "NEXT_PUBLIC_BLOCK_EXPLORER" && v ? (
                  <Link
                    href={v}
                    target="_blank"
                    className="break-all text-sm font-medium text-foreground underline underline-offset-4"
                  >
                    {v}
                  </Link>
                ) : (
                  <div className="break-all font-mono text-xs text-foreground">
                    {v || "—"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}