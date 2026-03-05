/* eslint-disable @typescript-eslint/no-explicit-any */
// app/(pages)/collections/[contract]/[tokenId]/listings/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import { ethers } from "ethers";
import prisma from "@/src/lib/db";
import ListingsClient from "./ListingsClient";

function normAddr(a: string) {
  return ethers.getAddress(a);
}

function isDigits(x: string) {
  return /^[0-9]+$/.test(String(x || "").trim());
}

type PageProps = {
  params: Promise<{ contract: string; tokenId: string }>;
};

export default async function ListingsPage({ params }: PageProps) {
  const { contract: contractParam, tokenId: tokenIdParam } = await params;

  const contractRaw = String(contractParam || "").trim();
  const tokenIdRaw = String(tokenIdParam || "").trim();

  if (!contractRaw || !ethers.isAddress(contractRaw)) return notFound();
  if (!tokenIdRaw || !isDigits(tokenIdRaw)) return notFound();

  const contract = normAddr(contractRaw);
  const tokenId = tokenIdRaw;

  const nft = await prisma.nFT.findFirst({
    where: { contract, tokenId },
    select: {
      id: true,
      contract: true,
      tokenId: true,
      standard: true,
      name: true,
      imageUrl: true,
      collection: {
        select: { name: true, contract: true },
      },
    },
  });

  if (!nft?.id) return notFound();

  const rows = await prisma.marketplaceListing.findMany({
    where: {
      nftId: nft.id,
      status: "ACTIVE",
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true, // db id (internal)
      sellerAddress: true,
      quantity: true,
      status: true,
      startTime: true,
      endTime: true,
      txHashCreated: true,
      createdAt: true,

      priceEtnWei: true,
      priceTokenAmount: true,

      currency: {
        select: {
          kind: true,
          symbol: true,
          decimals: true,
          tokenAddress: true,
        },
      },
    },
  });

  // Prisma Decimal -> integer string safe for BigInt on client
  const toIntString = (d: any | null | undefined) => {
    if (!d) return "0";
    if (typeof d?.toFixed === "function") return d.toFixed(0);
    const s = d?.toString?.() ?? String(d);
    return String(s).split(".")[0] || "0";
  };

  const listings = rows.map((l) => ({
    // ✅ IMPORTANT: ListingsClient expects listingId (not prisma id)
    // We do NOT have on-chain listingId in DB currently. For ERC1155 buying,
    // we resolve listingId on-chain using (collection, tokenId, seller).
    listingId: null as string | null,

    // keep db id if you want for keys / debug
    dbId: l.id,

    sellerAddress: l.sellerAddress,
    quantity: l.quantity,
    status: String(l.status),

    startTime: l.startTime ? l.startTime.toISOString() : null,
    endTime: l.endTime ? l.endTime.toISOString() : null,
    createdAt: l.createdAt ? l.createdAt.toISOString() : null,
    txHashCreated: l.txHashCreated ?? null,

    priceEtnWei: toIntString(l.priceEtnWei),
    priceTokenAmount: l.priceTokenAmount ? toIntString(l.priceTokenAmount) : null,

    currency: l.currency
      ? {
          kind: String(l.currency.kind || "NATIVE"),
          symbol: l.currency.symbol ?? null,
          decimals: Number(l.currency.decimals ?? 18),
          tokenAddress: l.currency.tokenAddress ?? null,
        }
      : {
          kind: "NATIVE",
          symbol: "ETN",
          decimals: 18,
          tokenAddress: null,
        },
  }));

  return (
    <div className="pt-6">
      <ListingsClient
        nft={{
          contract: nft.contract,
          tokenId: nft.tokenId,
          standard: ((nft.standard as any) || "ERC1155") as "ERC721" | "ERC1155",
          name: nft.name || `#${nft.tokenId}`,
          collectionName: nft.collection?.name || null,
          imageUrl: nft.imageUrl || null,
        }}
        listings={listings}
      />
    </div>
  );
}