/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { ethers } from "ethers";

import { useMarketplaceAdmin, ZERO_ADDRESS } from "@/src/lib/hooks/useMarketplaceAdmin";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { MARKETPLACE_CORE_ABI } from "@/src/lib/abis/marketplace-core/marketPlaceCoreABI";

type Props = { allowedWallets: string[] };

export default function ToggleCurrencyForm({ allowedWallets }: Props) {
  const mp = useMarketplaceAdmin();
  const [allowed, setAllowed] = React.useState<boolean>(true);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setAllowed(mp.etnAllowed);
  }, [mp.etnAllowed]);

  const onSubmit = async () => {
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
      const data = iface.encodeFunctionData("setCurrencyAllowed", [
        ZERO_ADDRESS,
        allowed,
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

      toast.message("Updating ETN currency allowlist...");
      await tx.wait();
      toast.success("ETN allowlist updated successfully.");
      mp.refresh();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">
          ETN Currency Allow
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Toggle whether native ETN payments are allowed in the marketplace.
        </p>
      </div>

      <div className="rounded-[20px] border border-border bg-background p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">
              Allow ETN payments (native)
            </div>
            <div className="mt-1 text-xs leading-5 text-muted">
              Toggles <code>setCurrencyAllowed(0x0, allowed)</code>.
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={allowed}
            onClick={() => setAllowed((v) => !v)}
            className={[
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
              allowed
                ? "border-emerald-500/20 bg-emerald-500/20"
                : "border-border bg-card",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                allowed ? "translate-x-6" : "translate-x-1",
              ].join(" ")}
            />
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Submitting..." : "Propose via Multisig"}
          </button>
        </div>
      </div>
    </section>
  );
}