/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { ethers } from "ethers";
import { toast } from "sonner";

import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { REWARD_DISTRIBUTOR_ABI } from "@/src/lib/abis/marketplace-core/rewardDistributorABI";

type Props = { allowedWallets: string[] };

const DISTRIBUTOR = process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || "";
const MULTISIG = process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS || "";
const RPC = process.env.NEXT_PUBLIC_RPC_URL || "";

export default function PauseControls({ allowedWallets }: Props) {
  const [paused, setPaused] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState<"pause" | "unpause" | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC);
      const contract = new ethers.Contract(
        DISTRIBUTOR,
        REWARD_DISTRIBUTOR_ABI as any,
        provider
      );
      setPaused(Boolean(await contract.paused()));
    } catch {
      setPaused(null);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const propose = async (fn: "pause" | "unpause") => {
    try {
      setBusy(fn);

      const { signer, chainId } = await getBrowserSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
        throw new Error("This wallet is not in the allowed admin list.");
      }

      if (chainId !== 52014) {
        throw new Error("Wrong network. Switch to Chain ID 52014.");
      }

      const iface = new ethers.Interface(REWARD_DISTRIBUTOR_ABI as any);
      const data = iface.encodeFunctionData(fn, []);

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);
      const tx = await multisig.submitAndConfirm(
        "0x0000000000000000000000000000000000000000",
        DISTRIBUTOR,
        BigInt(0),
        data
      );

      toast.message(`Proposing ${fn}...`);
      await tx.wait();
      toast.success(`${fn} proposed successfully.`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-[20px] border border-border bg-background p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">Current state</div>
          <div className="mt-1 text-sm text-muted">
            {paused == null ? "—" : paused ? "Paused" : "Active"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={() => propose("pause")}
            disabled={paused === true || busy !== null}
            className="inline-flex h-10 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
          >
            {busy === "pause" ? "Pausing..." : "Pause"}
          </button>

          <button
            type="button"
            onClick={() => propose("unpause")}
            disabled={paused === false || busy !== null}
            className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
          >
            {busy === "unpause" ? "Unpausing..." : "Unpause"}
          </button>
        </div>
      </div>
    </div>
  );
}