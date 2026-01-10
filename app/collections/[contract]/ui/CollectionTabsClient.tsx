"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ItemsTab from "./ItemsTab";
import ActivityTab from "./ActivityTab";

type HeaderDTO = {
  contract: string;
  rarityEnabled?: boolean | null;
};

type TabKey = "items" | "activity";

function tabFrom(sp: URLSearchParams): TabKey {
  const t = (sp.get("tab") || "items").toLowerCase();
  return t === "activity" ? "activity" : "items";
}

export default function CollectionTabsClient({ header }: { header: HeaderDTO }) {
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
          aria-label="Collection tabs"
          className="inline-flex rounded-full border border-border bg-card p-1"
        >
          <Tab active={tab === "items"} onClick={() => setTab("items")}>
            Items
          </Tab>
          <Tab active={tab === "activity"} onClick={() => setTab("activity")}>
            Activity
          </Tab>
        </div>
      </div>

      {tab === "items" ? (
        <ItemsTab contract={header.contract} rarityEnabled={!!header.rarityEnabled} />
      ) : null}

      {tab === "activity" ? <ActivityTab contract={header.contract} /> : null}
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
