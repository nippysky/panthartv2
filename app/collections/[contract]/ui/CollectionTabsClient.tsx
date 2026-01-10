"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ItemsTab from "./ItemsTab";
import ActivityTab from "./ActivityTab";

type HeaderDTO = {
  contract: string;
  description?: string | null;

  website?: string | null;
  instagram?: string | null;
  x?: string | null;
  discord?: string | null;
  telegram?: string | null;

  rarityEnabled?: boolean | null;
};

type TabKey = "items" | "activity" | "about";

function tabFrom(sp: URLSearchParams): TabKey {
  const t = (sp.get("tab") || "items").toLowerCase();
  return t === "activity" || t === "about" ? (t as TabKey) : "items";
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
      <div className="flex items-center gap-2">
        <Tab active={tab === "items"} onClick={() => setTab("items")}>Items</Tab>
        <Tab active={tab === "activity"} onClick={() => setTab("activity")}>Activity</Tab>
        <Tab active={tab === "about"} onClick={() => setTab("about")}>About</Tab>
      </div>

      {tab === "items" ? (
        <ItemsTab contract={header.contract} rarityEnabled={!!header.rarityEnabled} />
      ) : null}

      {tab === "activity" ? <ActivityTab contract={header.contract} /> : null}

      {tab === "about" ? <About header={header} /> : null}
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
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-foreground text-background"
          : "border border-border bg-card hover:bg-background/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function About({ header }: { header: HeaderDTO }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-medium text-muted-foreground">Description</div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
          {header.description || "—"}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-medium text-muted-foreground">Links</div>
        <div className="mt-2 grid gap-2 text-sm">
          {header.website ? (
            <a className="underline underline-offset-4" href={header.website} target="_blank" rel="noreferrer">
              Website
            </a>
          ) : null}
          {header.x ? (
            <a className="underline underline-offset-4" href={header.x} target="_blank" rel="noreferrer">
              X
            </a>
          ) : null}
          {header.discord ? (
            <a className="underline underline-offset-4" href={header.discord} target="_blank" rel="noreferrer">
              Discord
            </a>
          ) : null}
          {header.telegram ? (
            <a className="underline underline-offset-4" href={header.telegram} target="_blank" rel="noreferrer">
              Telegram
            </a>
          ) : null}
          {header.instagram ? (
            <a className="underline underline-offset-4" href={header.instagram} target="_blank" rel="noreferrer">
              Instagram
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
