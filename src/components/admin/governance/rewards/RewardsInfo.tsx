/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { ethers } from "ethers";

import AddressChip from "@/src/ui/AddressChip";
import { REWARD_DISTRIBUTOR_ABI } from "@/src/lib/abis/marketplace-core/rewardDistributorABI";

const RPC = process.env.NEXT_PUBLIC_RPC_URL || "";
const DISTRIBUTOR = process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || "";

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-border bg-background p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="mt-2 text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function RewardsInfo() {
  const [signer, setSigner] = React.useState<string>("");
  const [paused, setPaused] = React.useState<boolean>(false);

  React.useEffect(() => {
    (async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const contract = new ethers.Contract(
          DISTRIBUTOR,
          REWARD_DISTRIBUTOR_ABI as any,
          provider
        );

        const [sgn, p] = await Promise.all([contract.signer(), contract.paused()]);
        setSigner(sgn as string);
        setPaused(Boolean(p));
      } catch {
        setSigner("");
        setPaused(false);
      }
    })();
  }, []);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <InfoCard label="Current Signer">
        {signer ? <AddressChip address={signer} showCopy /> : "—"}
      </InfoCard>

      <InfoCard label="Distributor">
        {DISTRIBUTOR ? <AddressChip address={DISTRIBUTOR} showCopy /> : "—"}
      </InfoCard>

      <InfoCard label="Status">
        <span
          className={[
            "inline-flex rounded-full px-3 py-1 text-xs font-medium",
            paused
              ? "border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          ].join(" ")}
        >
          {paused ? "Paused" : "Active"}
        </span>
      </InfoCard>
    </div>
  );
}