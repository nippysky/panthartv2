"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";

import { useDecentWalletAccount } from "@/src/lib/decentWallet";

import AsyncState from "@/src/features/warpool/components/AsyncState";
import LoadingPanel from "@/src/features/warpool/components/LoadingPanel";
import QueueJoinCard from "@/src/features/warpool/components/QueueJoinCard";
import SectionBadge from "@/src/features/warpool/components/SectionBadge";
import { useWarpoolQueue } from "@/src/features/warpool/hook/useWarpoolQueue";

export default function WarpoolQueuePage() {
  const params = useParams<{ queueSlug: string }>();
  const queueSlug = decodeURIComponent(params.queueSlug);
  const { address } = useDecentWalletAccount();

  const { queue, eligibility, isLoading, error, refetch } = useWarpoolQueue(
    queueSlug,
    address
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <LoadingPanel className="h-10 w-24 rounded-full" />
          <div className="mt-6">
            <LoadingPanel className="h-130 rounded-[34px]" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <AsyncState
            title="Unable to load queue"
            body={error}
            onRetry={refetch}
            backHref="/comrades-warpool"
            backLabel="Back to Warpool"
          />
        </div>
      </main>
    );
  }

  if (!queue) {
    return (
      <main className="min-h-screen bg-background text-foreground page-enter">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <AsyncState
            title="Queue not found"
            body="The queue you opened is not currently available."
            backHref="/comrades-warpool"
            backLabel="Back to Warpool"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground page-enter">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/comrades-warpool"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground/78 transition hover:bg-card/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        <section className="mb-6">
          <SectionBadge icon={<Swords className="h-3.5 w-3.5 text-accent" />}>
            Queue entry
          </SectionBadge>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {queue.title}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground/64 sm:text-base">
            Smooth guided entry flow with real queue status, live countdown,
            actual seat availability, and clean step-by-step selection.
          </p>
        </section>

        <QueueJoinCard queue={queue} eligibility={eligibility} onRefresh={refetch} />
      </div>
    </main>
  );
}