/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { ethers } from "ethers";

import { useStolenRegistryAdmin } from "@/src/lib/hooks/useStolenRegistryAdmin";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { STOLEN_REGISTRY_ABI } from "@/src/lib/abis/marketplace-core/stolenRegistryABI";

export default function PauseControls({
  allowedWallets,
}: {
  allowedWallets: string[];
}) {
  const reg = useStolenRegistryAdmin();
  const [busy, setBusy] = React.useState<"pause" | "unpause" | null>(null);

  const call = async (fn: "pause" | "unpause") => {
    try {
      if (!reg.address) throw new Error("Registry address missing.");

      setBusy(fn);

      const { signer, chainId } = await getBrowserSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
        throw new Error("This wallet is not in the allowed admin list.");
      }

      if (chainId !== 52014) {
        throw new Error("Wrong network. Switch to Chain ID 52014.");
      }

      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData(fn, []);

      const multisig = new ethers.Contract(
        process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS!,
        MULTI_SIG_ABI as any,
        signer
      );

      const tx = await multisig.submitAndConfirm(
        "0x0000000000000000000000000000000000000000",
        reg.address,
        BigInt(0),
        data
      );

      toast.message(`${fn === "pause" ? "Pausing" : "Unpausing"} registry...`);
      await tx.wait();
      toast.success(`Registry ${fn === "pause" ? "paused" : "unpaused"} successfully.`);
      reg.refresh();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">Pause Controls</h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Pause or resume stolen-registry actions through the multisig.
        </p>
      </div>

      <div className="rounded-[20px] border border-border bg-background p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Current state</div>
            <div className="mt-1 text-sm text-muted">
              {reg.paused ? "Registry is currently paused." : "Registry is currently active."}
            </div>
          </div>

          <span
            className={[
              "inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium",
              reg.paused
                ? "border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
                : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            ].join(" ")}
          >
            {reg.paused ? "Paused" : "Active"}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => call("pause")}
            disabled={reg.paused || !reg.address || busy !== null}
            className="inline-flex h-11 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-5 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
          >
            {busy === "pause" ? "Pausing..." : "Pause"}
          </button>

          <button
            type="button"
            onClick={() => call("unpause")}
            disabled={!reg.paused || !reg.address || busy !== null}
            className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
          >
            {busy === "unpause" ? "Unpausing..." : "Unpause"}
          </button>
        </div>
      </div>
    </section>
  );
}