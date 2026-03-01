/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { AuctionStatus, ListingStatus, Prisma } from "@/src/lib/generated/prisma/client";

function safeStr(u?: any): string | null {
  if (u == null) return null;
  const s = String(u).trim();
  return s || null;
}

function normalizeUrl(u?: string | null): string | null {
  const s = safeStr(u);
  if (!s) return null;
  if (s.startsWith("ipfs://")) return s; // keep ipfs:// for frontend to resolve
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function normAddr(a?: string | null) {
  return String(a ?? "").trim().toLowerCase();
}

type ProfileHeaderDTO = {
  id: string;
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

async function buildHeader(address: string): Promise<ProfileHeaderDTO | null> {
  const user = await prisma.user.findFirst({
    where: { walletAddress: { equals: address, mode: "insensitive" } },
    select: {
      id: true,
      walletAddress: true,
      username: true,
      bio: true,
      profileAvatar: true,
      profileBanner: true,
      website: true,
      x: true,
      instagram: true,
      telegram: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const now = new Date();

  const [collectedCount, createdCount, listedCount, auctionsCount] = await Promise.all([
    prisma.nFT.count({
      where: { owner: { walletAddress: { equals: user.walletAddress, mode: "insensitive" } } },
    }),
    prisma.collection.count({
      where: { creator: { walletAddress: { equals: user.walletAddress, mode: "insensitive" } } },
    }),
    prisma.marketplaceListing.count({
      where: {
        status: ListingStatus.ACTIVE,
        sellerAddress: { equals: user.walletAddress, mode: "insensitive" },
        startTime: { lte: now },
        OR: [{ endTime: null }, { endTime: { gt: now } }],
      },
    }),
    prisma.auction.count({
      where: {
        status: AuctionStatus.ACTIVE,
        sellerAddress: { equals: user.walletAddress, mode: "insensitive" },
        startTime: { lte: now },
        endTime: { gt: now },
      },
    }),
  ]);

  return {
    id: user.id,
    walletAddress: user.walletAddress,

    username: user.username,
    bio: user.bio ?? null,

    // keep raw in DB, but UI can resolve via ipfsToHttp
    profileAvatar: user.profileAvatar ?? null,
    profileBanner: user.profileBanner ?? null,

    website: user.website ?? null,
    x: user.x ?? null,
    instagram: user.instagram ?? null,
    telegram: user.telegram ?? null,

    collectedCount,
    createdCount,
    listedCount,
    auctionsCount,

    joinedAt: user.createdAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ address: string }> }
) {
  await prismaReady;

  const { address } = await ctx.params;
  const header = await buildHeader(address);

  if (!header) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const resp = NextResponse.json(header, { status: 200 });
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> }
) {
  await prismaReady;

  const { address } = await ctx.params;

  try {
    const user = await prisma.user.findFirst({
      where: { walletAddress: { equals: address, mode: "insensitive" } },
      select: { id: true, walletAddress: true },
    });

    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ownerHeader = req.headers.get("x-owner-wallet");
    if (!ownerHeader) return NextResponse.json({ error: "Missing x-owner-wallet" }, { status: 401 });
    if (normAddr(ownerHeader) !== normAddr(user.walletAddress)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const data: Prisma.UserUpdateInput = {};

    if ("username" in body) {
      const u = safeStr((body as any).username);
      if (u) data.username = u.slice(0, 40);
    }

    if ("bio" in body) {
      const bio = safeStr((body as any).bio);
      if (bio !== null) data.bio = bio;
    }

    if ("website" in body) {
      const website = normalizeUrl((body as any).website);
      if (website !== null) data.website = website;
    }
    if ("x" in body) {
      const x = normalizeUrl((body as any).x);
      if (x !== null) data.x = x;
    }
    if ("instagram" in body) {
      const instagram = normalizeUrl((body as any).instagram);
      if (instagram !== null) data.instagram = instagram;
    }
    if ("telegram" in body) {
      const telegram = normalizeUrl((body as any).telegram);
      if (telegram !== null) data.telegram = telegram;
    }

    if ("profileAvatar" in body) {
      const avatar = safeStr((body as any).profileAvatar);
      if (avatar !== null) data.profileAvatar = avatar;
    }
    if ("profileBanner" in body) {
      const banner = safeStr((body as any).profileBanner);
      if (banner !== null) data.profileBanner = banner;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    await prisma.user.update({ where: { id: user.id }, data });

    const header = await buildHeader(user.walletAddress);
    return NextResponse.json({ success: true, header }, { status: 200 });
  } catch (err: any) {
    console.error("[PATCH /api/profile/[address]]", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
