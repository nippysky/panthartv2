// src/ui/app/home/TopCollectionsSection.tsx
import * as React from "react";
import Link from "next/link";
import { Container } from "@/src/ui/Container";
import { Button } from "@/src/ui/Button";
import TopCollectionsFilters from "./TopCollectionsFilters";
import TopCollectionsGrid from "./TopCollectionsGrid";
import { Skeleton } from "../Skeleton";

type WindowKey = "24h" | "7d" | "30d";

function TopCollectionsFallback({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-border bg-card px-4 py-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-44 rounded-lg" />
              <Skeleton className="mt-2 h-3 w-56 rounded-lg" />
            </div>

            <div className="hidden sm:flex flex-col items-end gap-2">
              <Skeleton className="h-3 w-24 rounded-lg" />
              <Skeleton className="h-4 w-28 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TopCollectionsSection({
  windowKey,
}: {
  windowKey: WindowKey;
}) {
  return (
    <section className="pt-10 sm:pt-14">
      <Container>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-muted">Market</div>
            <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
              Top collections
            </h2>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <TopCollectionsFilters active={windowKey} />
            <Link href="/collections">
              <Button variant="secondary" size="sm">
                View all
              </Button>
            </Link>
          </div>
        </div>

        {/* Keyed suspense => when tw changes, fallback shows while new RSC streams */}
        <React.Suspense
          key={windowKey}
          fallback={<TopCollectionsFallback rows={5} />}
        >
          <TopCollectionsGrid windowKey={windowKey} limit={5} />
        </React.Suspense>

        <div className="mt-6 text-xs text-muted">
          <Link
            href="/collections"
            className="hover:underline underline-offset-4"
          >
            See the full leaderboard →
          </Link>
        </div>
      </Container>
    </section>
  );
}
