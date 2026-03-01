// app/profile/[address]/ui/widgets/ProfileNftCard.tsx
import Image from "next/image";
import Link from "next/link";

export type ProfileNftItem = {
  id: string;
  contract: string;
  tokenId: string;
  name?: string | null;
  imageUrl?: string | null;

  isListed?: boolean;
  listPriceEtn?: number | null;

  isAuction?: boolean;
  auctionBidEtn?: number | null;
};

function ipfsToHttp(url?: string | null) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.replace("ipfs://", "")}`;
  return u;
}

function detectMedia(u?: string | null) {
  const s = (u ?? "").toLowerCase();
  if (!s) return "unknown";
  if (s.endsWith(".mp4") || s.includes(".mp4?")) return "video";
  if (s.endsWith(".webm") || s.includes(".webm?")) return "video";
  return "image";
}

function fmt2(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v);
}

export default function ProfileNftCard({ item }: { item: ProfileNftItem }) {
  const name = item.name ?? `#${item.tokenId}`;
  const img = ipfsToHttp(item.imageUrl);
  const media = detectMedia(img);

  const href = `/collections/${item.contract}/${item.tokenId}`;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-[0_18px_60px_rgba(0,0,0,0.12)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {img && media === "image" ? (
          <Image
            src={img}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(77,238,84,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)]" />
        )}

        {media === "video" ? (
          <div className="absolute left-3 top-3 rounded-full border border-black/10 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur dark:border-white/10 dark:bg-white/10">
            Video
          </div>
        ) : null}

        {item.isListed ? (
          <div className="absolute right-3 top-3 rounded-full border border-black/10 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur dark:border-white/10 dark:bg-white/10">
            Listed
          </div>
        ) : null}

        {item.isAuction ? (
          <div className="absolute right-3 bottom-3 rounded-full border border-black/10 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur dark:border-white/10 dark:bg-white/10">
            Auction
          </div>
        ) : null}
      </div>

      <div className="p-3">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">#{item.tokenId}</span>

          {item.isListed && item.listPriceEtn != null ? (
            <span className="font-medium text-foreground">{fmt2(item.listPriceEtn)} ETN</span>
          ) : item.isAuction && item.auctionBidEtn != null ? (
            <span className="font-medium text-foreground">{fmt2(item.auctionBidEtn)} ETN</span>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>
    </Link>
  );
}
