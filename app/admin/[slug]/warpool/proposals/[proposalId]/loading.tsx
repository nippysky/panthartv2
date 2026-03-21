import WarpoolPageLoading from "@/src/features/admin/warpool/WarpoolPageLoading";

export default function Loading() {
  return (
    <WarpoolPageLoading
      eyebrow="Warpool Proposals"
      title="Loading proposals"
      description="Preparing saved Warpool proposals and multisig progress."
    />
  );
}