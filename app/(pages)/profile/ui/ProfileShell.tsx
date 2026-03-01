// app/(pages)/profile/[address]/ui/ProfileShell.tsx
import ProfileHeader from "../ui/ProfileHeader";
import ProfileTabsClient from "../ui/ProfileTabsClient";
import ProfileOwnerActions, { ProfileOwnerMoneyActions } from "./ProfileOwnerActions";

type ProfileHeaderDTO = {
  id: string;
  walletAddress: string;

  username: string;
  bio?: string | null;

  profileAvatar?: string | null;
  profileBanner?: string | null;

  website?: string | null;
  x?: string | null;
  instagram?: string | null;
  telegram?: string | null;

  collectedCount?: number | null;
  createdCount?: number | null;
  listedCount?: number | null;
  auctionsCount?: number | null;

  joinedAt?: string | null;
};

export default function ProfileShell({ header }: { header: ProfileHeaderDTO }) {
  return (
    <div className="min-h-screen">
      <ProfileHeader
        header={header}
        actionsSlot={<ProfileOwnerActions header={header} />}
        statsSlot={<ProfileOwnerMoneyActions header={header} />}
      />

      <div className="mx-auto w-full max-w-7xl px-4 pb-16">
        <ProfileTabsClient header={header} />
      </div>
    </div>
  );
}
