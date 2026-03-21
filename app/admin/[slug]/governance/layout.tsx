// app/(admin)/[slug]/governance/layout.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import Sidebar from "@/src/components/admin/governance/SideBar";
import WalletGate from "@/src/components/admin/governance/WalletGate";
import AddressChip from "@/src/ui/AddressChip";

type Ctx = { params: Promise<{ slug: string }> };

function AddressChipLink({
  address,
  explorerUrl,
  hrefBase = "address",
}: {
  address: string;
  explorerUrl?: string;
  hrefBase?: "address" | "token" | string;
}) {
  if (!address) return null;

  const url = explorerUrl ? `${explorerUrl}/${hrefBase}/${address}` : "";

  return url ? (
    <Link href={url} target="_blank" className="inline-flex max-w-full">
      <AddressChip address={address} showCopy />
    </Link>
  ) : (
    <AddressChip address={address} showCopy />
  );
}

export default async function GovernanceLayout(
  props: Ctx & { children: ReactNode }
) {
  const { slug } = await props.params;

  const adminSlug = process.env.ADMIN_SLUG || "";
  if (!adminSlug || slug !== adminSlug) notFound();

  const allowedWallets = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const env = {
    MULTI_SIG_ADDRESS: process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS || "",
    MARKETPLACE_CORE_ADDRESS:
      process.env.NEXT_PUBLIC_MARKETPLACE_CORE_ADDRESS || "",
    REWARD_DISTRIBUTOR_ADDRESS:
      process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || "",
    STOLEN_REGISTRY_ADDRESS:
      process.env.NEXT_PUBLIC_STOLEN_REGISTRY_ADDRESS || "",
    BLOCK_EXPLORER_URL:
      process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
      process.env.NEXT_PUBLIC_BLOCK_EXPLORER ||
      "",
  };

  return (
    <div className="mx-auto flex w-full max-w-350 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_22%)]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              Panth.art Governance
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Governance Control Panel
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">
              Manage multisig operations, marketplace configuration, rewards,
              registry controls, and system settings from one cleaner, faster,
              more cohesive admin workspace.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-140">
            <div className="rounded-[22px] border border-border bg-background/80 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                Scope
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                Multisig + contract ops
              </div>
            </div>

            <div className="rounded-[22px] border border-border bg-background/80 p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
                Access
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">
                Wallet-gated admin tools
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="grid gap-4">
            <Sidebar baseHref={`/admin/${slug}/governance`} />

            <section className="rounded-3xl border border-border bg-card p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Allowed admin wallets
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Wallets currently allowed to operate governance tools.
                </p>
              </div>

              <div className="grid gap-2">
                {allowedWallets.length ? (
                  allowedWallets.map((w) => (
                    <div key={w} className="min-w-0">
                      <AddressChipLink
                        address={w}
                        explorerUrl={env.BLOCK_EXPLORER_URL}
                      />
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border bg-background p-3 text-xs text-muted">
                    No wallets configured.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Contracts
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Quick references to the governance-related contracts.
                </p>
              </div>

              <div className="grid gap-3">
                {env.MULTI_SIG_ADDRESS ? (
                  <div className="rounded-[18px] border border-border bg-background p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">
                      Multisig
                    </div>
                    <AddressChipLink
                      address={env.MULTI_SIG_ADDRESS}
                      explorerUrl={env.BLOCK_EXPLORER_URL}
                    />
                  </div>
                ) : null}

                {env.MARKETPLACE_CORE_ADDRESS ? (
                  <div className="rounded-[18px] border border-border bg-background p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">
                      Marketplace
                    </div>
                    <AddressChipLink
                      address={env.MARKETPLACE_CORE_ADDRESS}
                      explorerUrl={env.BLOCK_EXPLORER_URL}
                    />
                  </div>
                ) : null}

                {env.REWARD_DISTRIBUTOR_ADDRESS ? (
                  <div className="rounded-[18px] border border-border bg-background p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">
                      Rewards
                    </div>
                    <AddressChipLink
                      address={env.REWARD_DISTRIBUTOR_ADDRESS}
                      explorerUrl={env.BLOCK_EXPLORER_URL}
                    />
                  </div>
                ) : null}

                {env.STOLEN_REGISTRY_ADDRESS ? (
                  <div className="rounded-[18px] border border-border bg-background p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">
                      Stolen Registry
                    </div>
                    <AddressChipLink
                      address={env.STOLEN_REGISTRY_ADDRESS}
                      explorerUrl={env.BLOCK_EXPLORER_URL}
                    />
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </aside>

        <main className="min-w-0">
          <WalletGate allowedWallets={allowedWallets}>
            {props.children}
          </WalletGate>
        </main>
      </div>
    </div>
  );
}