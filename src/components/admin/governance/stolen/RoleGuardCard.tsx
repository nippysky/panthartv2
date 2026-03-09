/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { ethers } from "ethers";

import AddressChip from "@/src/ui/AddressChip";
import { useStolenRegistryAdmin } from "@/src/lib/hooks/useStolenRegistryAdmin";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { STOLEN_REGISTRY_ABI } from "@/src/lib/abis/marketplace-core/stolenRegistryABI";

const MULTISIG = process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS as `0x${string}`;

export default function RoleGuardCard({
  allowedWallets,
}: {
  allowedWallets: string[];
}) {
  const reg = useStolenRegistryAdmin();
  const [hasReporter, setHasReporter] = React.useState<boolean | null>(null);
  const [hasClearer, setHasClearer] = React.useState<boolean | null>(null);
  const [busyRole, setBusyRole] = React.useState<
    "REPORTER_ROLE" | "CLEARER_ROLE" | null
  >(null);

  React.useEffect(() => {
    (async () => {
      if (!reg.address || !MULTISIG || !reg.REPORTER_ROLE || !reg.CLEARER_ROLE) {
        setHasReporter(null);
        setHasClearer(null);
        return;
      }

      setHasReporter(await reg.hasRole(reg.REPORTER_ROLE, MULTISIG));
      setHasClearer(await reg.hasRole(reg.CLEARER_ROLE, MULTISIG));
    })();
  }, [reg.address, reg.REPORTER_ROLE, reg.CLEARER_ROLE, reg.hasRole, reg]);

  const grant = async (role: "REPORTER_ROLE" | "CLEARER_ROLE") => {
    try {
      if (!reg.address) throw new Error("Registry address missing.");

      setBusyRole(role);

      const { signer, chainId } = await getBrowserSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
        throw new Error("This wallet is not in the allowed admin list.");
      }

      if (chainId !== 52014) {
        throw new Error("Wrong network. Switch to Chain ID 52014.");
      }

      const roleId = role === "REPORTER_ROLE" ? reg.REPORTER_ROLE : reg.CLEARER_ROLE;
      if (!roleId) throw new Error("Role id not loaded yet.");

      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData("grantRole", [roleId, MULTISIG]);

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);
      const tx = await multisig.submitAndConfirm(
        "0x0000000000000000000000000000000000000000",
        reg.address,
        BigInt(0),
        data
      );

      toast.message(`Granting ${role} to multisig...`);
      await tx.wait();
      toast.success(`${role} granted successfully.`);
      reg.refresh();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusyRole(null);
    }
  };

  return (
    <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 md:p-6">
      <div className="mb-5">
        <div className="text-sm font-semibold text-foreground">
          Role Guard (Multisig)
        </div>
        <p className="mt-1 text-sm leading-6 text-muted">
          Ensure the multisig holds the required registry roles for reporting and
          clearing actions.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[20px] border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Registry
          </div>
          <div className="mt-2">
            <AddressChip address={(reg.address || "") as string} showCopy />
          </div>
        </div>

        <div className="rounded-[20px] border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Multisig
          </div>
          <div className="mt-2">
            <AddressChip address={MULTISIG} showCopy />
          </div>
        </div>

        <div className="rounded-[20px] border border-border bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Network
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            Chain ID {reg.chainId ?? "-"}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-[20px] border border-border bg-card p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">REPORTER_ROLE</div>
              <div className="mt-1 text-xs leading-5 text-muted">
                Can flag items and collections as stolen.
              </div>
            </div>

            <button
              type="button"
              onClick={() => grant("REPORTER_ROLE")}
              disabled={(hasReporter ?? true) || !reg.address || busyRole !== null}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
              title={hasReporter ? "Multisig already has this role" : "Grant role"}
            >
              {busyRole === "REPORTER_ROLE"
                ? "Granting..."
                : hasReporter
                  ? "Granted"
                  : "Grant"}
            </button>
          </div>
        </div>

        <div className="rounded-[20px] border border-border bg-card p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">CLEARER_ROLE</div>
              <div className="mt-1 text-xs leading-5 text-muted">
                Can clear previously flagged items and collections.
              </div>
            </div>

            <button
              type="button"
              onClick={() => grant("CLEARER_ROLE")}
              disabled={(hasClearer ?? true) || !reg.address || busyRole !== null}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
              title={hasClearer ? "Multisig already has this role" : "Grant role"}
            >
              {busyRole === "CLEARER_ROLE"
                ? "Granting..."
                : hasClearer
                  ? "Granted"
                  : "Grant"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}