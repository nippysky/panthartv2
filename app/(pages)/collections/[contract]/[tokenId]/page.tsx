/* eslint-disable @typescript-eslint/no-explicit-any */
// app/(pages)/collections/[contract]/[tokenId]/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { ipfsToHttp, detectMediaType } from "@/src/lib/media";
import NFTDetailsClient from "@/src/components/shared/nft/NFTDetailsClient";
import NFTitemsTab from "@/src/components/shared/NFTitemsTab";

type Attribute = { trait_type?: string; value?: string | number };

type TokenDetails = {
  contract: string;
  tokenId: string;
  name?: string | null;
  description?: string | null;
  image?: string | null;
  animation_url?: string | null;
  owner?: string | null; // wallet address string
  collectionName?: string | null;
  attributes?: Attribute[] | null;
};

type ApiNftResponse = {
  nft?: {
    contract?: string;
    tokenId?: string;
    name?: string | null;
    image?: string | null;
    description?: string | null;
    attributes?: any;
  };
  owner?: {
    walletAddress?: string | null;
  } | null;
  collection?: {
    name?: string | null;
  } | null;
  rawMetadata?: any;
};

type PageContext = {
  params: Promise<{ contract: string; tokenId: string }>;
};

async function getBaseUrlFromHeaders() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function pickAnimationUrl(rawMetadata: any): string | null {
  if (!rawMetadata) return null;
  return (
    rawMetadata.animation_url ??
    rawMetadata.animationUrl ??
    rawMetadata.animation ??
    null
  );
}

async function getTokenDetails(contract: string, tokenId: string): Promise<TokenDetails | null> {
  const baseUrl = await getBaseUrlFromHeaders();
  const url = `${baseUrl}/api/nft/${encodeURIComponent(contract)}/${encodeURIComponent(tokenId)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const api = (await res.json().catch(() => null)) as ApiNftResponse | null;
  if (!api?.nft) return null;

  return {
    contract,
    tokenId,
    name: api.nft.name ?? null,
    description: api.nft.description ?? null,
    image: api.nft.image ?? null,
    animation_url: pickAnimationUrl(api.rawMetadata),
    owner: api.owner?.walletAddress ?? null,
    collectionName: api.collection?.name ?? null,
    attributes: (Array.isArray(api.nft.attributes) ? api.nft.attributes : null) as
      | Attribute[]
      | null,
  };
}

export async function generateMetadata(ctx: PageContext) {
  const { contract, tokenId } = await ctx.params;
  const token = await getTokenDetails(contract, tokenId);

  const title = token?.name ? `${token.name}` : `Token #${tokenId}`;
  const description =
    token?.description?.slice(0, 160) ?? `View token #${tokenId} on Panth.art.`;

  return { title, description };
}

export default async function Page(ctx: PageContext) {
  const { contract, tokenId } = await ctx.params;

  const token = await getTokenDetails(contract, tokenId);
  if (!token) notFound();

  const rawMedia = token.animation_url || token.image || "";
  const mediaUrl = rawMedia ? (ipfsToHttp(rawMedia) ?? "") : "";
  const mediaType = rawMedia ? detectMediaType(rawMedia) : "image";

  const title = token.name || `Token #${tokenId}`;
  const collectionLabel = token.collectionName || "Collection";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-10">
      {/* top bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <Link href={`/collections/${contract}`} className="hover:underline">
              ← Back to collection
            </Link>
          </div>

          {/* ✅ removed tokenId beside name */}
          <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight truncate">
            {title}
          </h1>

          <div className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono">{contract}</span>
            <span className="mx-2 opacity-50">•</span>
            <span>{collectionLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ✅ single refresh pill (refreshes EVERYTHING via re-navigation) */}
          <Link
            href={`/collections/${contract}/${tokenId}`}
            className="text-xs rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            Refresh
          </Link>

          <Link
            href={`/collections/${contract}`}
            className="text-xs rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
          >
            View collection
          </Link>
        </div>
      </div>

      {/* main grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* left: media + details */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-black/5 dark:border-white/5">
              <div className="text-sm font-semibold">Media</div>
              <div className="text-xs text-muted-foreground mt-1">
                {mediaType === "video" ? "Video" : "Image"}
              </div>
            </div>

            <div className="relative w-full aspect-square bg-black/5 dark:bg-white/5">
              {mediaType === "video" ? (
                <video
                  src={mediaUrl || undefined}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl}
                  alt={title}
                  className="h-full w-full object-contain"
                  loading="eager"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                  No media
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
            <h2 className="font-semibold">Description</h2>
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
              {token.description || "No description provided."}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/4 p-4">
            <h2 className="font-semibold">Traits</h2>

            {token.attributes && token.attributes.length ? (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {token.attributes
                  .filter((a) => a && a.trait_type)
                  .map((a, idx) => (
                    <div
                      key={`${a.trait_type}-${String(a.value ?? "")}-${idx}`}
                      className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-2 bg-white/40 dark:bg-white/3"
                    >
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {a.trait_type}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {String(a.value ?? "—")}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No traits.</p>
            )}
          </div>
        </div>

        {/* right rail */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <NFTDetailsClient contract={contract} tokenId={tokenId} owner={token.owner ?? null} />
          </div>
        </div>
      </section>

      {/* ✅ only ONE "More from this collection", under the main content */}
      <div className="mt-10">
        <NFTitemsTab contract={contract} excludeTokenId={tokenId} title="More from this collection" />
      </div>
    </main>
  );
}
