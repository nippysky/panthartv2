// app/(pages)/profile/ui/widgets/ProfileCollectionCard.tsx
import Image from "next/image";
import Link from "next/link";

export type ProfileCollectionItem = {
  id: string;
  contract: string;
  name: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  itemsCount?: number | null;
  ownersCount?: number | null;
  floorPrice?: number | null; // native ETN
  volume?: number | null; // native ETN
};

function ipfsToHttp(url?: string | null) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.replace("ipfs://", "")}`;
  return u;
}

function compact(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

function fmt2(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
}

export default function ProfileCollectionCard({ item }: { item: ProfileCollectionItem }) {
  const cover = ipfsToHttp(item.coverUrl);
  const logo = ipfsToHttp(item.logoUrl);

  return (
    <Link
      href={`/collections/${item.contract}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-[0_18px_60px_rgba(0,0,0,0.12)]"
    >
      {/* Banner */}
      <div className="relative h-32 w-full overflow-hidden bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(77,238,84,0.10),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)]" />
        )}

        {/* Scrim: makes any banner readable in light + dark */}
        <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/10 to-black/55" />
        <div className="absolute inset-0 [background:radial-gradient(700px_circle_at_15%_10%,rgba(77,238,84,0.12),transparent_55%)]" />

        {/* Glass title bar (the key readability fix) */}
        <div className="absolute left-3 right-3 bottom-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/55 px-2.5 py-2 backdrop-blur-xl">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-border bg-background">
              {logo ? <Image src={logo} alt={item.name} fill className="object-cover" sizes="40px" /> : null}
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
              <div className="text-xs text-muted-foreground">
                {compact(item.itemsCount ?? 0)} items
                {item.ownersCount != null ? (
                  <span className="opacity-80"> • {compact(item.ownersCount)} owners</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3 text-xs">
        <div className="rounded-xl border border-border bg-background/60 p-2">
          <div className="text-muted-foreground">Floor</div>
          <div className="mt-1 font-semibold text-foreground">
            {item.floorPrice != null ? `${fmt2(item.floorPrice)} ETN` : "—"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/60 p-2">
          <div className="text-muted-foreground">Volume</div>
          <div className="mt-1 font-semibold text-foreground">
            {item.volume != null ? `${compact(item.volume)} ETN` : "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}
