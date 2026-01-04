// app/api/profile/[address]/owned-collections/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Returns the set of collections/contracts in which the user CURRENTLY owns at least one NFT.
 * Ownership:
 *  - ERC-721: NFT.owner.walletAddress == address (case-insensitive)
 *  - ERC-1155: balance > 0 in either `erc1155Holding` or platform `erc1155Balance`
 *
 * Label priority (for display):
 *  1) Collection (ERC721 drop)
 *  2) Single721
 *  3) Single1155   <-- ensures ERC1155 shows token contract name/symbol
 *
 * Response items: { id|null, contract, name|null, symbol|null, ownedCount }
 *   - `id` is ONLY populated for Collection rows. Singles return `id: null`.
 * Pagination: offset via base64url cursor.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { NftStatus } from "@/lib/generated/prisma";

/* ----------------------------- helpers ----------------------------- */
function encodeOffsetCursor(n: number) {
  return Buffer.from(String(n), "utf8").toString("base64url");
}
function decodeOffsetCursor(c: string | null) {
  if (!c) return 0;
  try {
    const s = Buffer.from(c, "base64url").toString("utf8");
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

type OwnedCollectionRow = {
  id: string | null;         // Collection.id if known; singles stay null
  contract: string;
  name: string | null;
  symbol: string | null;
  ownedCount: number;
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> }
) {
  await prismaReady;
  const { address } = await ctx.params;

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 50, 100));
  const offset = decodeOffsetCursor(url.searchParams.get("cursor"));
  const q = (url.searchParams.get("q") || "").trim(); // optional search

  // -------- Resolve user-owned NFT universe (ERC721 + ERC1155) --------

  // ERC1155 generic holdings (on-chain)
  const holdings = await prisma.erc1155Holding.findMany({
    where: {
      ownerAddress: { equals: address, mode: "insensitive" },
      balance: { gt: 0 },
    },
    select: { contract: true, tokenId: true },
    take: 5000,
  });
  const orHoldingPairs: Prisma.NFTWhereInput[] = holdings.map((h) => ({
    AND: [
      { contract: { equals: h.contract, mode: "insensitive" } },
      { tokenId: h.tokenId },
    ],
  }));

  // Platform Single1155 balances
  const s1155 = await prisma.erc1155Balance.findMany({
    where: {
      ownerAddress: { equals: address, mode: "insensitive" },
      balance: { gt: 0 },
    },
    select: { single1155Id: true },
    take: 5000,
  });
  const single1155Ids = s1155.map((b) => b.single1155Id);

  // Ownership scope: 721 owners OR 1155 holdings
  const ownScope: Prisma.NFTWhereInput[] = [
    { owner: { is: { walletAddress: { equals: address, mode: "insensitive" } } } },
    ...orHoldingPairs,
  ];
  if (single1155Ids.length) ownScope.push({ single1155Id: { in: single1155Ids } });

  // Pull owned NFTs (minimal fields)
  const ownedNfts = await prisma.nFT.findMany({
    where: { status: NftStatus.SUCCESS, OR: ownScope },
    select: { contract: true, collectionId: true },
    take: 20_000,
  });

  if (!ownedNfts.length) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  // Group counts by collectionId/contract
  const countByKey = new Map<string, { contract: string; collectionId: string | null; count: number }>();
  for (const n of ownedNfts) {
    const cid = n.collectionId ?? null;
    const key = cid ? `cid:${cid}` : `ct:${n.contract.toLowerCase()}`;
    const prev = countByKey.get(key);
    if (prev) prev.count += 1;
    else countByKey.set(key, { contract: n.contract, collectionId: cid, count: 1 });
  }

  // Sets to resolve metadata
  const byCollectionId = Array.from(countByKey.values())
    .filter((g) => !!g.collectionId)
    .map((g) => g.collectionId!) as string[];

  const byContract = Array.from(countByKey.values())
    .filter((g) => !g.collectionId)
    .map((g) => g.contract.toLowerCase());

  // Fetch metadata
  const [colsByIdRows, colsByContractRows, s721Rows, s1155Rows] = await Promise.all([
    byCollectionId.length
      ? prisma.collection.findMany({
          where: { id: { in: byCollectionId } },
          select: { id: true, name: true, symbol: true, contract: true },
        })
      : Promise.resolve([] as Array<{ id: string; name: string | null; symbol: string | null; contract: string }>),

    byContract.length
      ? prisma.collection.findMany({
          where: { contract: { in: byContract, mode: "insensitive" } },
          select: { id: true, name: true, symbol: true, contract: true },
        })
      : Promise.resolve([] as Array<{ id: string; name: string | null; symbol: string | null; contract: string }>),

    byContract.length
      ? prisma.single721.findMany({
          where: { contract: { in: byContract, mode: "insensitive" } },
          select: { contract: true, name: true, symbol: true },
        })
      : Promise.resolve([] as Array<{ contract: string; name: string | null; symbol: string | null }>),

    byContract.length
      ? prisma.single1155.findMany({
          where: { contract: { in: byContract, mode: "insensitive" } },
          select: { contract: true, name: true, symbol: true },
        })
      : Promise.resolve([] as Array<{ contract: string; name: string | null; symbol: string | null }>),
  ]);

  const colById = new Map(colsByIdRows.map((c) => [c.id, c]));
  const colByContract = new Map(colsByContractRows.map((c) => [c.contract.toLowerCase(), c]));
  const s721ByContract = new Map(s721Rows.map((c) => [c.contract.toLowerCase(), c]));
  const s1155ByContract = new Map(s1155Rows.map((c) => [c.contract.toLowerCase(), c]));

  // Build output rows with label priority: Collection → Single721 → Single1155
  let ownedCols: OwnedCollectionRow[] = [];
  for (const { contract, collectionId, count } of countByKey.values()) {
    if (collectionId && colById.has(collectionId)) {
      const meta = colById.get(collectionId)!;
      ownedCols.push({
        id: meta.id,                              // only for Collection
        contract: meta.contract,
        name: meta.name,
        symbol: meta.symbol,
        ownedCount: count,
      });
    } else {
      const key = contract.toLowerCase();
      const metaCol = colByContract.get(key);
      const meta721 = s721ByContract.get(key);
      const meta1155 = s1155ByContract.get(key);

      // choose first available source
      const chosen =
        metaCol ??
        (meta721 ? { id: null, contract, name: meta721.name, symbol: meta721.symbol } : null) ??
        (meta1155 ? { id: null, contract, name: meta1155.name, symbol: meta1155.symbol } : null);

      ownedCols.push({
        id: chosen && "id" in chosen ? (chosen as any).id : null, // null for singles
        contract: (chosen as any)?.contract ?? contract,
        name: (chosen as any)?.name ?? null,
        symbol: (chosen as any)?.symbol ?? null,
        ownedCount: count,
      });
    }
  }

  // Optional search across name/symbol/contract
  if (q) {
    const qq = q.toLowerCase();
    ownedCols = ownedCols.filter((c) => {
      return (
        (c.name && c.name.toLowerCase().includes(qq)) ||
        (c.symbol && c.symbol.toLowerCase().includes(qq)) ||
        c.contract.toLowerCase().includes(qq)
      );
    });
  }

  // Stable sort: name → symbol → contract; then highest ownedCount
  ownedCols.sort((a, b) => {
    const an = (a.name || a.symbol || a.contract).toLowerCase();
    const bn = (b.name || b.symbol || b.contract).toLowerCase();
    const byName = an.localeCompare(bn);
    if (byName !== 0) return byName;
    return b.ownedCount - a.ownedCount;
  });

  // Pagination (offset)
  const slice = ownedCols.slice(offset, offset + limit);
  const nextCursor =
    offset + limit < ownedCols.length ? encodeOffsetCursor(offset + limit) : null;

  return NextResponse.json(
    { items: slice, nextCursor },
    { headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=60" } }
  );
}
