/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { getAddress } from "viem";
import { ethers } from "ethers";

import { useMarketplaceAdmin } from "@/src/lib/hooks/useMarketplaceAdmin";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

type Props = { allowedWallets: string[] };

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export default function SetConfigForm({ allowedWallets }: Props) {
  const mp = useMarketplaceAdmin();

  const [feeBps, setFeeBps] = React.useState("");
  const [distBps, setDistBps] = React.useState("");
  const [feeRec, setFeeRec] = React.useState("");
  const [distAddr, setDistAddr] = React.useState("");
  const [stolenReg, setStolenReg] = React.useState("");
  const [snipeExt, setSnipeExt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setFeeBps(mp.feeBps.toString());
    setDistBps(mp.distributorShareBps.toString());
    setFeeRec(mp.feeRecipient ?? "");
    setDistAddr(mp.rewardsDistributor ?? "");
    setStolenReg(mp.stolenRegistry ?? "");
    setSnipeExt(mp.snipeExtension.toString());
  }, [
    mp.feeBps,
    mp.distributorShareBps,
    mp.feeRecipient,
    mp.rewardsDistributor,
    mp.stolenRegistry,
    mp.snipeExtension,
  ]);

  const onResetLocal = () => {
    setFeeBps(mp.feeBps.toString());
    setDistBps(mp.distributorShareBps.toString());
    setFeeRec(mp.feeRecipient ?? "");
    setDistAddr(mp.rewardsDistributor ?? "");
    setStolenReg(mp.stolenRegistry ?? "");
    setSnipeExt(mp.snipeExtension.toString());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!mp.address) throw new Error("Marketplace address missing.");

      setBusy(true);

      const { signer, chainId } = await getBrowserSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      if (!allowedWallets.map((x) => x.toLowerCase()).includes(wallet)) {
        throw new Error("This wallet is not in the allowed admin list.");
      }

      if (chainId !== 52014) {
        throw new Error("Wrong network. Switch to Chain ID 52014.");
      }

      const iface = new ethers.Interface(MARKETPLACE_CORE_ABI as any);
      const data = iface.encodeFunctionData("setConfig", [
        BigInt(feeBps || "0"),
        BigInt(distBps || "0"),
        getAddress(feeRec),
        getAddress(distAddr),
        getAddress(stolenReg),
        BigInt(snipeExt || "0"),
      ]);

      const multisig = new ethers.Contract(
        process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS!,
        MULTI_SIG_ABI as any,
        signer
      );

      const tx = await multisig.submitAndConfirm(
        "0x0000000000000000000000000000000000000000",
        mp.address,
        BigInt(0),
        data
      );

      toast.message("Proposing config update...");
      await tx.wait();
      toast.success("Config update proposed successfully.");
      mp.refresh();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20";

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">
          Update Marketplace Config
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Propose a new marketplace config through the multisig using the current
          loaded values as your starting point.
        </p>
      </div>

      <form className="grid grid-cols-1 gap-5 md:grid-cols-3" onSubmit={onSubmit}>
        <Field label="Fee Bps">
          <input
            className={inputClass}
            value={feeBps}
            onChange={(e) => setFeeBps(e.target.value)}
            inputMode="numeric"
          />
        </Field>

        <Field label="Distributor Share Bps">
          <input
            className={inputClass}
            value={distBps}
            onChange={(e) => setDistBps(e.target.value)}
            inputMode="numeric"
          />
        </Field>

        <Field label="Snipe Extension (seconds)">
          <input
            className={inputClass}
            value={snipeExt}
            onChange={(e) => setSnipeExt(e.target.value)}
            inputMode="numeric"
          />
        </Field>

        <div className="md:col-span-3">
          <Field label="Fee Recipient">
            <input
              className={inputClass}
              value={feeRec}
              onChange={(e) => setFeeRec(e.target.value)}
              placeholder="0x..."
            />
          </Field>
        </div>

        <div className="md:col-span-3">
          <Field label="Rewards Distributor">
            <input
              className={inputClass}
              value={distAddr}
              onChange={(e) => setDistAddr(e.target.value)}
              placeholder="0x..."
            />
          </Field>
        </div>

        <div className="md:col-span-3">
          <Field label="Stolen Registry">
            <input
              className={inputClass}
              value={stolenReg}
              onChange={(e) => setStolenReg(e.target.value)}
              placeholder="0x..."
            />
          </Field>
        </div>

        <div className="md:col-span-3 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onResetLocal}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-card"
          >
            Reset
          </button>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Submitting..." : "Propose via Multisig"}
          </button>
        </div>
      </form>
    </section>
  );
}