/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { ethers } from "ethers";
import { getAddress } from "viem";

import { useStolenRegistryAdmin } from "@/src/lib/hooks/useStolenRegistryAdmin";
import { getBrowserSigner } from "@/src/lib/evm/getSigner";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import { STOLEN_REGISTRY_ABI } from "@/src/lib/abis/marketplace-core/stolenRegistryABI";

function toReasonHash(reason: string): `0x${string}` {
  return ethers.id(reason || "").toLowerCase() as `0x${string}`;
}

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

export default function FlagClearForms({
  allowedWallets,
}: {
  allowedWallets: string[];
}) {
  const reg = useStolenRegistryAdmin();
  const [busy, setBusy] = React.useState<string | null>(null);

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

  const submitCall = async (data: string, note: string, busyKey: string) => {
    const signer = await guard();
    const multisig = new ethers.Contract(
      process.env.NEXT_PUBLIC_MULTI_SIG_ADDRESS!,
      MULTI_SIG_ABI as any,
      signer
    );

    setBusy(busyKey);

    const tx = await multisig.submitAndConfirm(
      "0x0000000000000000000000000000000000000000",
      reg.address!,
      BigInt(0),
      data
    );

    toast.message(note);
    await tx.wait();
    toast.success("Proposal submitted successfully.");
    reg.refresh();
  };

  const [itemAddr, setItemAddr] = React.useState("");
  const [itemId, setItemId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [evidence, setEvidence] = React.useState("");

  const onFlagItem = async () => {
    try {
      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData("flag", [
        getAddress(itemAddr),
        BigInt(itemId || "0"),
        toReasonHash(reason),
        evidence,
      ]);
      await submitCall(data, "Flagging item...", "flag-item");
      setReason("");
      setEvidence("");
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setBusy(null);
    }
  };

  const onClearItem = async () => {
    try {
      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData("clear", [
        getAddress(itemAddr),
        BigInt(itemId || "0"),
      ]);
      await submitCall(data, "Clearing item...", "clear-item");
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setBusy(null);
    }
  };

  const [colAddr, setColAddr] = React.useState("");
  const [colReason, setColReason] = React.useState("");
  const [colEvidence, setColEvidence] = React.useState("");

  const onFlagCollection = async () => {
    try {
      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData("flagCollection", [
        getAddress(colAddr),
        toReasonHash(colReason),
        colEvidence,
      ]);
      await submitCall(data, "Flagging collection...", "flag-collection");
      setColReason("");
      setColEvidence("");
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setBusy(null);
    }
  };

  const onClearCollection = async () => {
    try {
      const iface = new ethers.Interface(STOLEN_REGISTRY_ABI as any);
      const data = iface.encodeFunctionData("clearCollection", [getAddress(colAddr)]);
      await submitCall(data, "Clearing collection...", "clear-collection");
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setBusy(null);
    }
  };

  const inputClass =
    "h-11 w-full rounded-[18px] border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/20";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-foreground">Item Actions</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Propose item-level stolen or cleared actions for a specific token contract and ID.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="md:col-span-2">
            <Field label="Token Contract">
              <input
                value={itemAddr}
                onChange={(e) => setItemAddr(e.target.value)}
                placeholder="0x..."
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <Field label="Token ID">
              <input
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                inputMode="numeric"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Reason (free text → keccak256)">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. stolen report 123"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Evidence URL">
              <input
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </Field>
          </div>

          <div className="md:col-span-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClearItem}
              disabled={!itemAddr || !itemId || !reg.address || busy !== null}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "clear-item" ? "Submitting..." : "Propose Clear"}
            </button>

            <button
              type="button"
              onClick={onFlagItem}
              disabled={!itemAddr || !itemId || !reg.address || busy !== null}
              className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "flag-item" ? "Submitting..." : "Propose Flag"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-foreground">
            Collection Actions
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Propose collection-wide flag or clear actions for a contract.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="md:col-span-3">
            <Field label="Collection Contract">
              <input
                value={colAddr}
                onChange={(e) => setColAddr(e.target.value)}
                placeholder="0x..."
                className={inputClass}
              />
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Reason (free text → keccak256)">
              <input
                value={colReason}
                onChange={(e) => setColReason(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Evidence URL">
              <input
                value={colEvidence}
                onChange={(e) => setColEvidence(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </Field>
          </div>

          <div className="md:col-span-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClearCollection}
              disabled={!colAddr || !reg.address || busy !== null}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "clear-collection" ? "Submitting..." : "Propose Clear Collection"}
            </button>

            <button
              type="button"
              onClick={onFlagCollection}
              disabled={!colAddr || !reg.address || busy !== null}
              className="inline-flex h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "flag-collection" ? "Submitting..." : "Propose Flag Collection"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}