/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";

export default function CollectionTopBar({
  header,
  stats,
  tab,
  setTab,
}: {
  header: any;
  stats: { label: string; value: any; suffix?: string }[];
  tab: "items" | "activity" | "about";
  setTab: (t: "items" | "activity" | "about") => void;
}) {
  return (
    <div className="relative">
      {/* Cover */}
      <div className="relative h-44 w-full overflow-hidden border-b md:h-56">
        {header.coverUrl ? (
          <Image
            src={header.coverUrl}
            alt={`${header.name} cover`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/10 to-background" />
      </div>

      {/* Header Card */}
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="-mt-10 rounded-2xl border bg-background/95 p-4 shadow-sm backdrop-blur md:-mt-12 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border bg-muted md:h-20 md:w-20">
                {header.logoUrl ? (
                  <Image src={header.logoUrl} alt={`${header.name} logo`} fill className="object-cover" />
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="truncate text-xl font-semibold md:text-2xl">
                  {header.name ?? "Collection"}
                </div>
                <div className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                  {header.description || "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border bg-background p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-sm font-semibold">
                    {s.value}
                    {s.suffix ? <span className="ml-1 text-[11px] text-muted-foreground">{s.suffix}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sticky-ish Tabs */}
          <div className="mt-4 flex gap-2">
            <TabButton active={tab === "items"} onClick={() => setTab("items")}>Items</TabButton>
            <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>Activity</TabButton>
            <TabButton active={tab === "about"} onClick={() => setTab("about")}>About</TabButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-2xl px-4 py-2 text-sm font-medium transition",
        active ? "bg-foreground text-background" : "border bg-background hover:bg-muted",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
