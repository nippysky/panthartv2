/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { ethers } from "ethers";
import { getAddress, isAddress } from "viem";

import AddressChip from "@/src/ui/AddressChip";
import { useStolenRegistryAdmin } from "@/src/lib/hooks/useStolenRegistryAdmin";
import { getBrowserSigner, ZERO_ADDRESS } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { STOLEN_REGISTRY_ABI } from "@/src/lib/abis/marketplace-core/stolenRegistryABI";

const MULTISIG = process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS as `0x${string}`;

export default function StaffRoleManager({
  allowedWallets,
}: {
  allowedWallets: string[];
}) {
  const reg = useStolenRegistryAdmin();

  const [rawAddr, setRawAddr] = React.useState("");
  const [target, setTarget] = React.useState<`0x${string}` | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [hasReporter, setHasReporter] = React.useState<boolean | null>(null);
  const [hasClearer, setHasClearer] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isAddress(rawAddr || "")) {
      setTarget(getAddress(rawAddr) as `0x${string}`);
    } else {
      setTarget(null);
      setHasReporter(null);
      setHasClearer(null);
    }
  }, [rawAddr]);

  React.useEffect(() => {
    (async () => {
      if (!target || !reg.address || !reg.REPORTER_ROLE || !reg.CLEARER_ROLE) {
        setHasReporter(null);
        setHasClearer(null);
        return;
      }

      setChecking(true);
      try {
        const [reporter, clearer] = await Promise.all([
          reg.hasRole(reg.REPORTER_ROLE, target),
          reg.hasRole(reg.CLEARER_ROLE, target),
        ]);

        setHasReporter(!!reporter);
        setHasClearer(!!clearer);
      } catch {
        setHasReporter(null);
        setHasClearer(null);
      } finally {
        setChecking(false);
      }
    })();
  }, [target, reg.address, reg.REPORTER_ROLE, reg.CLEARER_ROLE, reg.hasRole, reg]);

  const guard = async () => {
    const { signer, chainId } = await getBrowserSigner();
    const wallet = (await signer.getAddress()).toLowerCase();

    if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
      throw new Error("This wallet is not in the allowed admin list.");
    }

    if (chainId !== 52014) {
      throw new Error("Wrong network. Switch to Chain ID 52014.");
    }

    return signer;
  };

  const propose = async (
    roleKey: "REPORTER_ROLE" | "CLEARER_ROLE",
    action: "grant" | "revoke"
  ) => {
    try {
      if (!reg.address) throw new Error("Registry address missing.");
      if (!target) throw new Error("Enter a valid staff address.");

      const roleId = roleKey === "REPORTER_ROLE" ? reg.REPORTER_ROLE : reg.CLEARER_ROLE;
      if (!roleId) throw new Error("Role id not loaded yet.");

      setBusy(`${action}-${roleKey}`);

      const signer = await guard();
      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData(
        action === "grant" ? "grantRole" : "revokeRole",
        [roleId, target]
      );

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);
      const resp = await multisig.submitAndConfirm(
        ZERO_ADDRESS,
        reg.address,
        BigInt(0),
        data
      );

      toast.message(
        `${action === "grant" ? "Granting" : "Revoking"} ${roleKey} for ${target}...`
      );
      await resp.wait();
      toast.success("Proposal submitted successfully.");

      if (reg.REPORTER_ROLE) setHasReporter(await reg.hasRole(reg.REPORTER_ROLE, target));
      if (reg.CLEARER_ROLE) setHasClearer(await reg.hasRole(reg.CLEARER_ROLE, target));
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">
          Staff Roles (Grant / Revoke)
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Assign or remove REPORTER_ROLE and CLEARER_ROLE for staff EOAs through the multisig.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Staff EOA Address
            </span>
            <input
              value={rawAddr}
              onChange={(e) => setRawAddr(e.target.value)}
              placeholder="0x..."
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
            />
          </label>

          <div className="mt-3">
            {target ? (
              <AddressChip address={target} />
            ) : (
              <span className="text-xs text-muted">Enter a valid address</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Registry
          </div>
          <div className="mt-2">
            <AddressChip address={reg.address ?? ""} showCopy />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-[20px] border border-border bg-background p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">REPORTER_ROLE</div>
              <div className="mt-1 text-xs leading-5 text-muted">
                Can flag items and collections as stolen.
              </div>
              <div className="mt-2 text-xs text-muted">
                Status:{" "}
                {checking
                  ? "Checking..."
                  : hasReporter == null
                    ? "—"
                    : hasReporter
                      ? "Granted"
                      : "Not granted"}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => propose("REPORTER_ROLE", "grant")}
                disabled={!target || hasReporter === true || busy !== null}
                className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
              >
                {busy === "grant-REPORTER_ROLE" ? "Granting..." : "Grant"}
              </button>

              <button
                type="button"
                onClick={() => propose("REPORTER_ROLE", "revoke")}
                disabled={!target || hasReporter !== true || busy !== null}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "revoke-REPORTER_ROLE" ? "Revoking..." : "Revoke"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-border bg-background p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">CLEARER_ROLE</div>
              <div className="mt-1 text-xs leading-5 text-muted">
                Can clear previously flagged items and collections.
              </div>
              <div className="mt-2 text-xs text-muted">
                Status:{" "}
                {checking
                  ? "Checking..."
                  : hasClearer == null
                    ? "—"
                    : hasClearer
                      ? "Granted"
                      : "Not granted"}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => propose("CLEARER_ROLE", "grant")}
                disabled={!target || hasClearer === true || busy !== null}
                className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
              >
                {busy === "grant-CLEARER_ROLE" ? "Granting..." : "Grant"}
              </button>

              <button
                type="button"
                onClick={() => propose("CLEARER_ROLE", "revoke")}
                disabled={!target || hasClearer !== true || busy !== null}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "revoke-CLEARER_ROLE" ? "Revoking..." : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-muted">
        Note: the multisig must hold the admin role for these role changes
        (typically <code>DEFAULT_ADMIN_ROLE</code> or each role’s admin), or the
        proposal will revert.
      </p>
    </section>
  );
}