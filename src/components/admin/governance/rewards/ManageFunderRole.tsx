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

export default function ManageFunderRole({ allowedWallets }: Props) {
  const [addr, setAddr] = React.useState("");
  const [role, setRole] = React.useState<string>("0x");
  const [hasIt, setHasIt] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState<"grantRole" | "revokeRole" | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const contract = new ethers.Contract(
          DISTRIBUTOR,
          REWARD_DISTRIBUTOR_ABI as any,
          provider
        );

        const roleId = await contract.FUNDER_ROLE();
        setRole(roleId as string);

        if (ethers.isAddress(addr)) {
          setHasIt(Boolean(await contract.hasRole(roleId, addr)));
        } else {
          setHasIt(null);
        }
      } catch {
        setRole("0x");
        setHasIt(null);
      }
    })();
  }, [addr]);

  const act = async (fn: "grantRole" | "revokeRole") => {
    try {
      if (!ethers.isAddress(addr)) throw new Error("Enter a valid address.");

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
      const data = iface.encodeFunctionData(fn, [role, addr]);

      const multisig = new ethers.Contract(MULTISIG, MULTI_SIG_ABI as any, signer);
      const tx = await multisig.submitAndConfirm(
        "0x0000000000000000000000000000000000000000",
        DISTRIBUTOR,
        BigInt(0),
        data
      );

      toast.message(`Proposing ${fn === "grantRole" ? "grant" : "revoke"}...`);
      await tx.wait();
      toast.success("Role change proposed successfully.");
      setHasIt(fn === "grantRole");
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4">
      <label className="block">
        <span className="text-sm font-medium text-foreground">Address</span>
        <input
          className="mt-2 h-11 w-full rounded-[18px] border border-border bg-background px-4 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20"
          placeholder="0x..."
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
        />
      </label>

      <div className="rounded-[18px] border border-border bg-background p-4 text-xs leading-6 text-muted">
        <div>
          FUNDER_ROLE id: <code className="break-all">{role}</code>
        </div>
        {ethers.isAddress(addr) ? (
          <div className="mt-2">
            Current status:{" "}
            <strong className="text-foreground">
              {hasIt == null ? "—" : hasIt ? "has role" : "no role"}
            </strong>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => act("grantRole")}
          disabled={busy !== null}
          className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
        >
          {busy === "grantRole" ? "Granting..." : "Grant"}
        </button>

        <button
          type="button"
          onClick={() => act("revokeRole")}
          disabled={busy !== null}
          className="inline-flex h-10 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
        >
          {busy === "revokeRole" ? "Revoking..." : "Revoke"}
        </button>
      </div>
    </div>
  );
}