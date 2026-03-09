/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { ethers } from "ethers";
import { getAddress } from "viem";

import { useMarketplaceAdmin } from "@/src/lib/hooks/useMarketplaceAdmin";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

const MULTI_SIG_ADDRESS = (process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS ||
  "") as `0x${string}`;

type Props = { allowedWallets: string[] };

export default function RoleGuardCard({ allowedWallets }: Props) {
  const mp = useMarketplaceAdmin();
  const [isOwner, setIsOwner] = React.useState<boolean>(false);
  const [hasConfig, setHasConfig] = React.useState<boolean | null>(null);
  const [hasPauser, setHasPauser] = React.useState<boolean | null>(null);
  const [busyRole, setBusyRole] = React.useState<
    "CONFIG_ROLE" | "PAUSER_ROLE" | null
  >(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!mp.address || !mp.CONFIG_ROLE || !mp.PAUSER_ROLE) return;

        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const wallet = (await signer.getAddress()).toLowerCase();
        const allowed = allowedWallets.map((x) => x.toLowerCase()).includes(wallet);
        setIsOwner(allowed);

        const market = new ethers.Contract(
          mp.address,
          MARKETPLACE_CORE_ABI as any,
          provider
        );

        const [c, p] = await Promise.all([
          market.hasRole(mp.CONFIG_ROLE, MULTI_SIG_ADDRESS),
          market.hasRole(mp.PAUSER_ROLE, MULTI_SIG_ADDRESS),
        ]);

        if (!cancelled) {
          setHasConfig(Boolean(c));
          setHasPauser(Boolean(p));
        }
      } catch {
        if (!cancelled) {
          setHasConfig(null);
          setHasPauser(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp.address, mp.CONFIG_ROLE, mp.PAUSER_ROLE]);

  const grant = async (roleName: "CONFIG_ROLE" | "PAUSER_ROLE") => {
    try {
      if (!mp.address) throw new Error("Marketplace address missing.");

      const roleHex =
        roleName === "CONFIG_ROLE" ? mp.CONFIG_ROLE : mp.PAUSER_ROLE;

      if (!roleHex) throw new Error(`Role ${roleName} not loaded.`);

      setBusyRole(roleName);

      const { signer, chainId } = await getBrowserSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
        throw new Error("This wallet is not in the allowed admin list.");
      }

      if (chainId !== 52014) {
        throw new Error("Wrong network. Switch to Chain ID 52014.");
      }

      const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
      const data = iface.encodeFunctionData("grantRole", [
        roleHex,
        getAddress(MULTI_SIG_ADDRESS),
      ]);

      const multisig = new ethers.Contract(
        MULTI_SIG_ADDRESS,
        MULTI_SIG_ABI as any,
        signer
      );

      const tx = await multisig.submitAndConfirm(
        "0x0000000000000000000000000000000000000000",
        mp.address,
        BigInt(0),
        data
      );

      toast.message(`Granting ${roleName}...`);
      await tx.wait();
      toast.success(`${roleName} granted to the multisig.`);
      mp.refresh();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusyRole(null);
    }
  };

  const needsAny = hasConfig === false || hasPauser === false;
  if (!needsAny) return null;

  return (
    <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 md:p-6">
      <div className="mb-5">
        <div className="text-sm font-semibold text-foreground">
          Missing marketplace roles
        </div>
        <p className="mt-1 text-sm leading-6 text-muted">
          The multisig does not currently hold all recommended marketplace roles.
          Grant the missing ones below.
        </p>
      </div>

      <div className="grid gap-3">
        {hasConfig === false ? (
          <div className="rounded-[20px] border border-border bg-card p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">
                  CONFIG_ROLE
                </div>
                <div className="mt-1 text-xs leading-5 text-muted">
                  Required to call <code>setConfig</code>.
                </div>
              </div>

              <button
                type="button"
                onClick={() => grant("CONFIG_ROLE")}
                disabled={!isOwner || busyRole !== null}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyRole === "CONFIG_ROLE"
                  ? "Granting..."
                  : "Grant CONFIG_ROLE"}
              </button>
            </div>
          </div>
        ) : null}

        {hasPauser === false ? (
          <div className="rounded-[20px] border border-border bg-card p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">
                  PAUSER_ROLE
                </div>
                <div className="mt-1 text-xs leading-5 text-muted">
                  Required to call <code>pause</code> and <code>unpause</code>.
                </div>
              </div>

              <button
                type="button"
                onClick={() => grant("PAUSER_ROLE")}
                disabled={!isOwner || busyRole !== null}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyRole === "PAUSER_ROLE"
                  ? "Granting..."
                  : "Grant PAUSER_ROLE"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}