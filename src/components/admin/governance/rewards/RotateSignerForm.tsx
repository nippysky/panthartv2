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

export default function RotateSignerForm({ allowedWallets }: Props) {
  const [newSigner, setNewSigner] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!ethers.isAddress(newSigner)) {
        throw new Error("Enter a valid new signer address.");
      }

      setBusy(true);

      const { signer, chainId } = await getBrowserSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
        throw new Error("This wallet is not in the allowed admin list.");
      }

      if (chainId !== 52014) {
        throw new Error("Wrong network. Switch to Chain ID 52014.");
      }

      const iface = new ethers.Interface(REWARD_DISTRIBUTOR_ABI as any);
      const data = iface.encodeFunctionData("setSigner", [newSigner]);

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);
      const tx = await multisig.submitAndConfirm(
        "0x0000000000000000000000000000000000000000",
        DISTRIBUTOR,
        BigInt(0),
        data
      );

      toast.message("Proposing signer rotation...");
      await tx.wait();
      toast.success("Signer rotation proposed successfully.");
      setNewSigner("");
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="block">
        <span className="text-sm font-medium text-foreground">New signer address</span>
        <input
          className="mt-2 h-11 w-full rounded-[18px] border border-border bg-background px-4 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
          placeholder="0x..."
          value={newSigner}
          onChange={(e) => setNewSigner(e.target.value)}
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Submitting..." : "Propose via Multisig"}
        </button>
      </div>

      <div className="text-xs leading-5 text-muted">
        Calls <code>setSigner(newSigner)</code> on the rewards distributor.
      </div>
    </form>
  );
}