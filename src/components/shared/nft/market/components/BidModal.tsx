"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/src/ui/Modal";
import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";
import { marketplace } from "@/src/lib/services/marketplace";
import { errorMessage } from "../utils";
import type { AuctionActiveItem } from "../types";

export function BidModal(props: {
  open: boolean;
  onClose: () => void;

  auction: AuctionActiveItem | null;
  account: string | null;

  loading: boolean;
  setLoading: (v: boolean) => void;
  setErr: (v: string | null) => void;

  onAfterBid: () => Promise<void> | void;
}) {
  const { open, onClose, auction, account, loading, setLoading, setErr, onAfterBid } = props;

  const [bidAmount, setBidAmount] = useState("");
  const [bidMinLabel, setBidMinLabel] = useState<string | null>(null);
  const [bidSymbol, setBidSymbol] = useState<string>("ETN");

  const auctionIdStr = auction?.id ?? null;

  const loadBidMin = useCallback(async () => {
    if (!auctionIdStr) return;
    try {
      const meta = await marketplace.getBidMinimum(BigInt(auctionIdStr));
      setBidSymbol(meta.symbol);
      setBidMinLabel(`${meta.minHuman} ${meta.symbol}`);
    } catch {
      setBidMinLabel(null);
      setBidSymbol(auction?.currency?.symbol ?? "ETN");
    }
  }, [auctionIdStr, auction?.currency?.symbol]);

  useEffect(() => {
    if (!open) return;
    setBidAmount("");
    setBidMinLabel(null);
    setBidSymbol("ETN");
    void loadBidMin();
  }, [open, loadBidMin]);

  const placeBid = useCallback(async () => {
    if (!auctionIdStr) return;

    if (!account) {
      toast.error("Wallet not connected.");
      setErr("Connect your wallet to continue.");
      return;
    }

    const amtStr = (bidAmount || "").trim();
    if (!amtStr || Number(amtStr) <= 0) {
      toast.error("Enter a valid bid amount.");
      setErr("Enter a valid bid amount.");
      return;
    }

    const tId = toast.loading("Placing bid…");
    setLoading(true);
    setErr(null);

    try {
      await marketplace.placeBidByAuctionIdJustInTime({
        auctionId: BigInt(auctionIdStr),
        amountHuman: amtStr,
      });

      toast.success("Bid placed.", { id: tId });
      onClose();
      await onAfterBid();
    } catch (e: unknown) {
      const msg = errorMessage(e, "Bid failed");
      toast.error(msg, { id: tId });
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, [auctionIdStr, account, bidAmount, setLoading, setErr, onClose, onAfterBid]);

  return (
    <Modal open={open} onClose={onClose} title="Place bid" className="max-w-md" zIndex={1_000_012}>
      <div className="space-y-4">
        {bidMinLabel ? (
          <div className="text-xs text-muted-foreground">
            Minimum required: <strong>{bidMinLabel}</strong>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Enter your bid amount.</div>
        )}

        <Input
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder={`Amount (${bidSymbol})`}
          inputMode="decimal"
          disabled={loading}
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void placeBid()} loading={loading} disabled={loading}>
            Confirm bid
          </Button>
        </div>
      </div>
    </Modal>
  );
}
