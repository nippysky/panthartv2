import WarpoolPageLoading from "@/src/features/admin/warpool/WarpoolPageLoading";

export default function Loading() {
  return (
    <WarpoolPageLoading
      eyebrow="Warpool Runtime"
      title="Loading runtime monitor"
      description="Preparing runtime health, recovery tools, and worker state."
    />
  );
}