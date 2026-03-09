/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { ethers } from "ethers";

import { useMarketplaceAdmin } from "@/src/lib/hooks/useMarketplaceAdmin";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { REWARD_DISTRIBUTOR_ABI } from "@/src/lib/abis/marketplace-core/rewardDistributorABI";

type Props = { allowedWallets: string[] };

export default function FundRewardsForm({ allowedWallets }: Props) {
  const mp = useMarketplaceAdmin();
  const [amount, setAmount] = React.useState("0.0");
  const [busy, setBusy] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!mp.REWARD_DISTRIBUTOR_ADDRESS) {
        throw new Error("Rewards Distributor address missing.");
      }

      const value = ethers.parseEther(amount || "0");
      if (value <= BigInt(0)) {
        throw new Error("Enter a positive ETN amount.");
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
      const data = iface.encodeFunctionData("depositNative", []);

      const multisig = new ethers.Contract(
        process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS!,
        MULTI_SIG_ABI as any,
        signer
      );

      const tx = await multisig.submitAndConfirm(
        "0x0000000000000000000000000000000000000000",
        mp.REWARD_DISTRIBUTOR_ADDRESS,
        value,
        data
      );

      toast.message("Funding rewards pool...");
      await tx.wait();
      toast.success("Rewards Distributor funding proposal submitted.");
      setAmount("0.0");
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSubmit}>
      <label className="block">
        <span className="text-sm font-medium text-foreground">Amount (ETN)</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.0"
          className="mt-2 h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
        />
        <div className="mt-2 text-xs leading-5 text-muted">
          Calls <code>depositNative()</code> on the rewards distributor and sends
          the specified ETN value.
        </div>
      </label>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Submitting..." : "Propose via Multisig"}
        </button>
      </div>
    </form>
  );
}