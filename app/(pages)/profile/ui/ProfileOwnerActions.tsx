// app/(pages)/profile/[address]/ui/ProfileOwnerActions.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import EditProfileModal from "./EditProfileModal";
import WithdrawRefundsDialog from "./WithdrawRefundsDialog";
import RewardsClaimDialog from "./RewardsClaimDialog";


type HeaderDTO = {
  walletAddress: string;
  username: string;
  bio?: string | null;
  profileAvatar?: string | null;
  profileBanner?: string | null;
  website?: string | null;
  x?: string | null;
  instagram?: string | null;
  telegram?: string | null;
};

type EthLike = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function normAddr(a?: string | null) {
  return String(a ?? "").trim().toLowerCase();
}

type Mode = "primary" | "money" | "all";

/**
 * - mode="primary": Edit Profile only (left side)
 * - mode="money": Rewards + Refunds only (right side / your red area)
 * - mode="all": everything
 */
export default function ProfileOwnerActions({
  header,
  mode = "primary",
}: {
  header: HeaderDTO;
  mode?: Mode;
}) {
  const [viewer, setViewer] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const eth = (window as unknown as { ethereum?: EthLike })?.ethereum;

    const applyAccounts = (acc: unknown) => {
      const arr = Array.isArray(acc) ? (acc as string[]) : [];
      if (!alive) return;
      setViewer(arr?.[0] ?? "");
    };

    async function loadAccounts() {
      try {
        if (!eth?.request) return;
        const acc = await eth.request({ method: "eth_accounts" });
        applyAccounts(acc);
      } catch {
        // ignore
      }
    }

    void loadAccounts();

    // Keep in sync if wallet changes
    const onAccountsChanged = (acc: unknown) => applyAccounts(acc);
    if (eth?.on) eth.on("accountsChanged", onAccountsChanged);

    return () => {
      alive = false;
      if (eth?.removeListener) eth.removeListener("accountsChanged", onAccountsChanged);
    };
  }, []);

  const isOwner = useMemo(() => {
    const v = normAddr(viewer);
    return !!v && v === normAddr(header.walletAddress);
  }, [viewer, header.walletAddress]);

  if (!isOwner) return null;

  const showPrimary = mode === "primary" || mode === "all";
  const showMoney = mode === "money" || mode === "all";

  return (
    <>
      {showMoney ? (
        <>
          <RewardsClaimDialog ownerAddress={header.walletAddress} />
          <WithdrawRefundsDialog ownerAddress={header.walletAddress} />
        </>
      ) : null}

      {showPrimary ? (
        <EditProfileModal
          profileAddress={header.walletAddress}
          viewerAddress={viewer}
          initial={header}
        />
      ) : null}
    </>
  );
}

/** Convenience export for the red-marked area (stats-side actions) */
export function ProfileOwnerMoneyActions({ header }: { header: HeaderDTO }) {
  return <ProfileOwnerActions header={header} mode="money" />;
}
