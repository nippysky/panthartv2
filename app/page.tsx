// src/app/page.tsx
import LiveAuctionsSection from "@/src/ui/home/LiveAuctionSection";
import MarketHeroStrip from "@/src/ui/home/MarketHeroStrip";
import TopCollectionsSection from "@/src/ui/home/TopCollectionsSection";


import MintingNowSection from "@/src/ui/home/MintingNowSection";
import ActiveListingsSection from "@/src/ui/home/ActiveListingsSection";

type WindowKey = "24h" | "7d" | "30d";
type SearchParams = Record<string, string | string[] | undefined>;

function parseWindow(v: unknown): WindowKey {
  return v === "7d" || v === "30d" || v === "24h" ? v : "24h";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const tw = Array.isArray(sp.tw) ? sp.tw[0] : sp.tw;
  const windowKey = parseWindow(tw);

  return (
    <div className="page-enter pt-6 sm:pt-10">
      <MarketHeroStrip windowKey={windowKey} />

      <div className="h-6 sm:h-10" />
      <TopCollectionsSection windowKey={windowKey} />

      <div className="h-10 sm:h-14" />
      <MintingNowSection limit={4} />

      <div className="h-10 sm:h-14" />
      <ActiveListingsSection limit={4} />

      <div className="h-10 sm:h-14" />
      <LiveAuctionsSection windowKey={windowKey} limit={4} />

      <div className="h-10 sm:h-16" />
    </div>
  );
}