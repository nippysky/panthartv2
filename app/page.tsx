// src/app/page.tsx
import TopCollectionsSection from "@/src/ui/home/TopCollectionsSection";


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
    <div className="page-enter">
      {/* Start with the marketplace leaderboard */}
      <TopCollectionsSection windowKey={windowKey} />

      <div className="h-10 sm:h-14" />
    </div>
  );
}
