// app/profile/[address]/ui/ProfileTabsClient.tsx
"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CollectedTab from "./tabs/CollectedTab";
import CreatedTab from "./tabs/CreatedTab";
import UserActivityTab from "./tabs/UserActivityTab";

type ProfileHeaderDTO = {
  walletAddress: string;
};

type TabKey = "collected" | "created" | "activity";

function tabFrom(sp: URLSearchParams): TabKey {
  const t = (sp.get("tab") || "collected").toLowerCase();
  if (t === "created") return "created";
  if (t === "activity") return "activity";
  return "collected";
}

export default function ProfileTabsClient({ header }: { header: ProfileHeaderDTO }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tab = useMemo(() => tabFrom(sp), [sp]);

  function setTab(next: TabKey) {
    const p = new URLSearchParams(sp.toString());
    p.set("tab", next);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Profile tabs"
          className="inline-flex rounded-full border border-border bg-card p-1"
        >
          <Tab active={tab === "collected"} onClick={() => setTab("collected")}>
            Collected
          </Tab>
          <Tab active={tab === "created"} onClick={() => setTab("created")}>
            Created
          </Tab>
          <Tab active={tab === "activity"} onClick={() => setTab("activity")}>
            Activity
          </Tab>
        </div>
      </div>

      {tab === "collected" ? <CollectedTab address={header.walletAddress} /> : null}
      {tab === "created" ? <CreatedTab address={header.walletAddress} /> : null}
      {tab === "activity" ? <UserActivityTab address={header.walletAddress} /> : null}
    </div>
  );
}

function Tab({
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
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "h-10 rounded-full px-4 text-sm font-medium transition",
        active
          ? "bg-foreground text-background shadow-[0_10px_28px_rgba(0,0,0,0.10)]"
          : "text-foreground/80 hover:bg-background/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
