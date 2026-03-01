// app/(pages)/profile/ui/ProfileHeader.tsx
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import CopyButton from "./CopyButton";

type ProfileHeaderDTO = {
  walletAddress: string;

  username: string;
  bio?: string | null;

  profileAvatar?: string | null;
  profileBanner?: string | null;

  website?: string | null;
  x?: string | null;
  instagram?: string | null;
  telegram?: string | null;

  collectedCount?: number | null;
  createdCount?: number | null;
  listedCount?: number | null;
  auctionsCount?: number | null;

  joinedAt?: string | null;
};

function safeUrl(u?: string | null) {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function ipfsToHttp(url?: string | null) {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.replace("ipfs://", "")}`;
  return u;
}

function shortAddr(a: string) {
  if (!a) return "";
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function compact(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: v < 10 ? 2 : 1,
  }).format(v);
}

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function SocialPill({ href, label }: { href?: string | null; label: string }) {
  const u = safeUrl(href);
  if (!u) return null;
  return (
    <a
      href={u}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
    >
      {label}
    </a>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold tracking-[-0.01em]">{value}</div>
    </div>
  );
}

export default function ProfileHeader({
  header,
  actionsSlot,
  statsSlot, // ✅ NEW (your red-marked area)
}: {
  header: ProfileHeaderDTO;
  actionsSlot?: ReactNode;
  statsSlot?: ReactNode;
}) {
  const username = header.username || "Profile";
  const bio = (header.bio ?? "").trim();
  const showToggle = bio.length > 220;

  const banner = ipfsToHttp(header.profileBanner);
  const avatar = ipfsToHttp(header.profileAvatar);

  const links = [
    header.website ? { k: "website", label: "Website", href: header.website } : null,
    header.x ? { k: "x", label: "X", href: header.x } : null,
    header.telegram ? { k: "telegram", label: "Telegram", href: header.telegram } : null,
    header.instagram ? { k: "instagram", label: "Instagram", href: header.instagram } : null,
  ].filter(Boolean) as Array<{ k: string; label: string; href: string }>;

  const joined = fmtDate(header.joinedAt);

  return (
    <div className="relative">
      <div className="relative h-44 w-full overflow-hidden sm:h-60 md:h-72">
        {banner ? (
          <Image src={banner} alt={username} fill priority className="object-cover" sizes="100vw" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(77,238,84,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent)]" />
        )}

        <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/25 to-background" />
        <div className="absolute inset-0 [background:radial-gradient(900px_circle_at_30%_18%,rgba(77,238,84,0.12),transparent_55%)]" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="-mt-9 rounded-[28px] border border-border bg-card/75 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:-mt-12 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span className="opacity-60">/</span>
            <span className="text-foreground/90">Profile</span>
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-background sm:h-16 sm:w-16 md:h-20 md:w-20">
                {avatar ? (
                  <Image src={avatar} alt={username} fill className="object-cover" sizes="80px" priority />
                ) : (
                  <div className="absolute inset-0 bg-muted" />
                )}
              </div>

              <div className="min-w-0">
                <h1 className="text-[20px] font-semibold tracking-[-0.02em] sm:text-[24px] md:text-[28px] wrap-break-word">
                  {username}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs">
                    {shortAddr(header.walletAddress)}
                  </span>
                  <CopyButton value={header.walletAddress} />
                  {joined ? (
                    <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs">
                      Joined {joined}
                    </span>
                  ) : null}
                </div>

                {bio ? (
                  <div className="mt-3 max-w-2xl">
                    {showToggle ? (
                      <details className="group">
                        <p className="text-sm leading-relaxed text-muted-foreground wrap-break-word line-clamp-4 group-open:line-clamp-none">
                          {bio}
                        </p>
                        <summary className="mt-2 cursor-pointer list-none text-sm font-semibold text-foreground/90 hover:opacity-90">
                          <span className="group-open:hidden">Read more</span>
                          <span className="hidden group-open:inline">Read less</span>
                        </summary>
                      </details>
                    ) : (
                      <p className="text-sm leading-relaxed text-muted-foreground wrap-break-word">{bio}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">—</p>
                )}

                {links.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {links.slice(0, 5).map((l) => (
                      <SocialPill key={l.k} href={l.href} label={l.label} />
                    ))}
                  </div>
                ) : null}

                {/* Existing: Edit Profile (etc.) stays here */}
                {actionsSlot ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">{actionsSlot}</div>
                ) : null}
              </div>
            </div>

            {/* ✅ Right side: stats + (NEW) slot under stats (red-marked area) */}
            <div className="md:w-110">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Collected" value={header.collectedCount != null ? compact(header.collectedCount) : "—"} />
                <Stat label="Created" value={header.createdCount != null ? compact(header.createdCount) : "—"} />
                <Stat label="Listed" value={header.listedCount != null ? compact(header.listedCount) : "—"} />
                <Stat label="Auctions" value={header.auctionsCount != null ? compact(header.auctionsCount) : "—"} />
              </div>

              {statsSlot ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 justify-start md:justify-end">
                  {statsSlot}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
