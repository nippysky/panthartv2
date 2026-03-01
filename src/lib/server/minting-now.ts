/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/server/minting-now.ts
import "server-only";

import prisma, { prismaReady } from "@/src/lib/db";
import { Prisma } from "@/src/lib/generated/prisma/client";
import { ethers } from "ethers";
import { ERC721_DROP_ABI } from "@/src/lib/abis/ERC721DropABI";
import { ERC1155_SINGLE_ABI } from "@/src/lib/abis/ERC1155SingleDropABI";
import type { MintingNowItem, MediaType } from "@/src/types/minting-now";

/* Premium placeholder (Cloudinary) */
const PLACEHOLDER =
  "https://res.cloudinary.com/dx1bqxtys/image/upload/v1750638432/panthart/amy5m5u7nxmhlh8brv6d.png";

/* ----------------------- Media helpers ----------------------- */

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function mediaTypeFromUrl(url?: string | null): MediaType {
  if (!url) return "unknown";
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (VIDEO_EXT.test(path)) return "video";
    if (IMAGE_EXT.test(path)) return "image";
    return "unknown";
  } catch {
    const u = String(url).toLowerCase();
    if (VIDEO_EXT.test(u)) return "video";
    if (IMAGE_EXT.test(u)) return "image";
    return "unknown";
  }
}

function mediaTypeFromContentType(ct?: string | null): MediaType {
  const v = (ct || "").toLowerCase();
  if (v.startsWith("video/")) return "video";
  if (v.startsWith("image/")) return "image";
  return "unknown";
}

// ---- tiny TTL cache for probing ----
const PROBE_TTL_MS = 1000 * 60 * 60 * 6; // 6h
const probeCache = new Map<string, { v: MediaType; exp: number }>();

async function probeMediaType(url: string): Promise<MediaType> {
  // extension is free + reliable when present
  const byExt = mediaTypeFromUrl(url);
  if (byExt !== "unknown") return byExt;

  const now = Date.now();
  const hit = probeCache.get(url);
  if (hit && hit.exp > now) return hit.v;

  // Probe like your old /api/media-head, but server-side + cached
  let media: MediaType = "unknown";
  try {
    // HEAD first
    let r = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
    });

    let ct = r.headers.get("content-type");
    if (!r.ok || !ct) {
      // Range GET fallback
      r = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        cache: "no-store",
      });
      ct = r.headers.get("content-type");
    }

    media = mediaTypeFromContentType(ct);
  } catch {
    media = "unknown";
  }

  probeCache.set(url, { v: media, exp: now + PROBE_TTL_MS });
  return media;
}

/* ----------------------- Cursor helpers ----------------------- */
type Cursor = { t: string; k: "erc721" | "erc1155"; id: string };

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}
function decodeCursor(s: string): Cursor | null {
  try {
    const txt = Buffer.from(s, "base64url").toString("utf8");
    const j = JSON.parse(txt);
    if (!j?.t || !j?.k || !j?.id) return null;
    if (j.k !== "erc721" && j.k !== "erc1155") return null;
    return { t: String(j.t), k: j.k, id: String(j.id) };
  } catch {
    return null;
  }
}

/* ----------------------- Provider ----------------------- */
function getProvider(): ethers.AbstractProvider | null {
  const url = process.env.RPC_URL;
  try {
    return url ? new ethers.JsonRpcProvider(url) : null;
  } catch {
    return null;
  }
}

/* ----------------------- Concurrency helper ----------------------- */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length) as any;
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    () => worker()
  );
  await Promise.all(workers);
  return out;
}

/* ----------------------- On-chain reads ----------------------- */
async function getErc721Minted(
  provider: ethers.AbstractProvider | null,
  contract: string
): Promise<number | null> {
  if (!provider) return null;
  try {
    const c = new ethers.Contract(contract, ERC721_DROP_ABI, provider);
    const total: bigint = await c.totalSupply();
    const n = Number(total);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  } catch {
    return null;
  }
}

async function getErc1155Minted(
  provider: ethers.AbstractProvider | null,
  contract: string
): Promise<number | null> {
  if (!provider) return null;
  try {
    const c = new ethers.Contract(contract, ERC1155_SINGLE_ABI, provider);
    const total: bigint = await c.totalMinted();
    const n = Number(total);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  } catch {
    return null;
  }
}

/* ----------------------- Public API ----------------------- */
export async function getMintingNowPage({
  limit = 20,
  cursor,
}: {
  limit?: number;
  cursor: string | null;
}): Promise<{ items: MintingNowItem[]; nextCursor: string | null }> {
  await prismaReady;

  const now = new Date();
  const provider = getProvider();
  const take = Math.max(limit * 3, 60);

  const includeCollection = {
    _count: { select: { nfts: true } },
    publicSale: true,
    presale: true,
  } satisfies Prisma.CollectionInclude;

  type CollectionRow = Prisma.CollectionGetPayload<{
    include: typeof includeCollection;
  }>;

  const selectSingle1155 = {
    id: true,
    name: true,
    description: true,
    contract: true,
    imageUrl: true,
    maxSupply: true,
    mintPriceEtnWei: true,
    createdAt: true,
    indexStatus: true,
  } satisfies Prisma.Single1155Select;

  type Single1155Row = Prisma.Single1155GetPayload<{
    select: typeof selectSingle1155;
  }>;

  const [cRows, sRows] = await Promise.all([
    prisma.collection.findMany({
      where: {
        standard: "ERC721",
        supply: { not: null },
        isOrphan: false,
        publicSale: { isNot: null },
      },
      include: includeCollection,
      orderBy: [{ createdAt: "desc" }],
      take,
    }) as unknown as Promise<CollectionRow[]>,

    prisma.single1155.findMany({
      where: { indexStatus: "COMPLETED" },
      orderBy: [{ createdAt: "desc" }],
      take,
      select: selectSingle1155,
    }) as unknown as Promise<Single1155Row[]>,
  ]);

  // ERC1155 fallback minted in ONE query (no N+1)
  const mintedBySingle1155Id = new Map<string, number>();
  if (!provider && sRows.length > 0) {
    const ids = sRows.map((s) => s.id);
    const grouped = await prisma.erc1155Balance.groupBy({
      by: ["single1155Id"],
      where: { single1155Id: { in: ids } },
      _sum: { balance: true },
    });

    for (const g of grouped) {
      mintedBySingle1155Id.set(g.single1155Id, Number(g._sum.balance ?? 0));
    }
  }

  // On-chain minted in parallel
  const ERC721_RPC_CONCURRENCY = 6;
  const ERC1155_RPC_CONCURRENCY = 6;

  const minted721 = provider
    ? await mapLimit(
        cRows,
        ERC721_RPC_CONCURRENCY,
        async (c) =>
          [c.contract, await getErc721Minted(provider, c.contract)] as const
      )
    : [];

  const minted1155 = provider
    ? await mapLimit(
        sRows,
        ERC1155_RPC_CONCURRENCY,
        async (s) =>
          [s.contract, await getErc1155Minted(provider, s.contract)] as const
      )
    : [];

  const minted721ByContract = new Map(minted721);
  const minted1155ByContract = new Map(minted1155);

  // ✅ Probe media types server-side ONLY when needed (and cached)
  const PROBE_CONCURRENCY = 8;

  const collectionMedia = await mapLimit(
    cRows,
    PROBE_CONCURRENCY,
    async (c) => {
      const logoUrl = (c as any).logoUrl || PLACEHOLDER;
      const coverUrl = (c as any).coverUrl || (c as any).logoUrl || PLACEHOLDER;

      const [logoMediaType, coverMediaType] = await Promise.all([
        probeMediaType(logoUrl),
        probeMediaType(coverUrl),
      ]);

      return [c.id, { logoUrl, coverUrl, logoMediaType, coverMediaType }] as const;
    }
  );

  const single1155Media = await mapLimit(
    sRows,
    PROBE_CONCURRENCY,
    async (s) => {
      const logoUrl = s.imageUrl || PLACEHOLDER;
      const coverUrl = s.imageUrl || PLACEHOLDER;

      const [logoMediaType, coverMediaType] = await Promise.all([
        probeMediaType(logoUrl),
        probeMediaType(coverUrl),
      ]);

      return [s.id, { logoUrl, coverUrl, logoMediaType, coverMediaType }] as const;
    }
  );

  const cMediaById = new Map(collectionMedia);
  const sMediaById = new Map(single1155Media);

  type Raw = {
    createdAt: Date;
    kind: "erc721" | "erc1155";
    id: string;
    data: MintingNowItem;
  };
  const out: Raw[] = [];

  // ERC721
  for (const c of cRows) {
    const supply = c.supply ?? 0;
    if (supply <= 0 || !c.publicSale) continue;

    const mintedOnChain = minted721ByContract.get(c.contract) ?? null;
    const minted = mintedOnChain ?? (c._count.nfts ?? 0);
    if (minted >= supply) continue;

    const publicStart = c.publicSale.startTime;
    const presaleStart = c.presale?.startTime;
    const presaleEnd = c.presale?.endTime;

    const presaleActive =
      !!c.presale &&
      !!presaleStart &&
      !!presaleEnd &&
      presaleStart <= now &&
      presaleEnd > now;

    const publicActive = publicStart <= now;

    const presaleUpcoming = !!c.presale && !!presaleStart && presaleStart > now;
    const publicUpcoming = publicStart > now;

    const anyActive = presaleActive || publicActive;
    const anyUpcoming = presaleUpcoming || publicUpcoming;
    if (!anyActive && !anyUpcoming) continue;

    const status: MintingNowItem["status"] = presaleActive
      ? "presale"
      : publicActive
      ? "public"
      : "upcoming";

    const mintedPct =
      supply > 0 ? Math.min(100, Math.max(0, (minted / supply) * 100)) : 0;

    const media = cMediaById.get(c.id)!;

    const item: MintingNowItem = {
      id: c.id,
      kind: "erc721",
      name: c.name || "Collection",
      description: c.description ?? null,
      contract: c.contract,
      href: `/minting-now/${c.contract}`,

      logoUrl: media.logoUrl,
      coverUrl: media.coverUrl,
      logoMediaType: media.logoMediaType,
      coverMediaType: media.coverMediaType,

      supply,
      minted,
      mintedPct,
      status,
      publicSale: {
        startISO: c.publicSale.startTime.toISOString(),
        priceEtnWei: c.publicSale.priceEtnWei.toString(),
      },
      ...(c.presale
        ? {
            presale: {
              startISO: c.presale.startTime.toISOString(),
              endISO: c.presale.endTime.toISOString(),
              priceEtnWei: c.presale.priceEtnWei.toString(),
            },
          }
        : {}),
    };

    out.push({ createdAt: c.createdAt, kind: "erc721", id: c.id, data: item });
  }

  // ERC1155
  for (const s of sRows) {
    const supply = s.maxSupply ?? 0;
    if (supply <= 0) continue;

    const mintedOnChain = minted1155ByContract.get(s.contract) ?? null;
    const minted = mintedOnChain ?? mintedBySingle1155Id.get(s.id) ?? 0;
    if (minted >= supply) continue;

    const mintedPct = Math.min(100, Math.max(0, (minted / supply) * 100));

    const media = sMediaById.get(s.id)!;

    const item: MintingNowItem = {
      id: s.id,
      kind: "erc1155",
      name: s.name || "Drop",
      description: s.description ?? null,
      contract: s.contract,
      href: `/minting-now/erc1155/${s.contract}`,

      logoUrl: media.logoUrl,
      coverUrl: media.coverUrl,
      logoMediaType: media.logoMediaType,
      coverMediaType: media.coverMediaType,

      supply,
      minted,
      mintedPct,
      status: "public",
      publicSale: {
        startISO: s.createdAt.toISOString(),
        priceEtnWei: s.mintPriceEtnWei.toString(),
      },
    };

    out.push({ createdAt: s.createdAt, kind: "erc1155", id: s.id, data: item });
  }

  // Sort newest first
  out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Cursor filtering
  const decoded = cursor ? decodeCursor(cursor) : null;
  let filtered = out;

  if (decoded) {
    const cutoffT = new Date(decoded.t).getTime();
    filtered = out.filter((x) => {
      const t = x.createdAt.getTime();
      if (t < cutoffT) return true;
      if (t > cutoffT) return false;
      if (x.kind !== decoded.k) return x.kind < decoded.k;
      return x.id < decoded.id;
    });
  }

  const slice = filtered.slice(0, limit);

  const nextCursor =
    slice.length > 0
      ? encodeCursor({
          t: slice[slice.length - 1].createdAt.toISOString(),
          k: slice[slice.length - 1].kind,
          id: slice[slice.length - 1].id,
        })
      : null;

  return { items: slice.map((x) => x.data), nextCursor };
}