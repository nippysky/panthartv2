/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";
import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";

const ERC721_ABI = [
  "function safeTransferFrom(address from,address to,uint256 tokenId)",
] as const;

function getBrowserSigner() {
  const anyWin = window as any;
  if (!anyWin.ethereum) throw new Error("No wallet found");
  const provider = new ethers.BrowserProvider(anyWin.ethereum);
  return provider.getSigner();
}

export function TransferCard({
  contract,
  tokenId,
  disabled,
}: {
  contract: string;
  tokenId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [to, setTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onTransfer() {
    setMsg(null);
    setBusy(true);
    try {
      const signer = await getBrowserSigner();
      const from = await signer.getAddress();

      const c = new ethers.Contract(contract, ERC721_ABI, signer);

      setMsg("Confirm transfer in your wallet…");
      const tx = await c.safeTransferFrom(from, ethers.getAddress(to), BigInt(tokenId));

      setMsg("Transaction sent. Waiting for confirmation…");
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== BigInt(1)) throw new Error("Transfer failed");

      // ✅ Sync owner instantly from chain into DB
      await fetch("/api/nft/sync-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract, tokenId }),
      });

      setMsg("Transfer confirmed.");
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? "Transfer failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-sm font-semibold">Transfer NFT</div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          placeholder="Recipient address (0x...)"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={disabled || busy}
        />
        <Input value={`Quantity: 1 (ERC721)`} disabled />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={onTransfer}
          loading={busy}
          disabled={disabled || !to}
          className="min-w-40"
        >
          Confirm transfer
        </Button>
        <Button variant="outline" disabled={busy}>
          Close
        </Button>
      </div>

      <div className="mt-3 text-xs text-muted">
        Transfers are disabled while a listing/auction is active (cancel first).
      </div>

      {msg ? <div className="mt-2 text-xs">{msg}</div> : null}
    </div>
  );
}
