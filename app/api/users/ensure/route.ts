/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/src/lib/db";
import { isAddress } from "viem";
import { Prisma } from "@/src/lib/generated/prisma/client";

const DEFAULT_BANNER =
  "https://res.cloudinary.com/dx1bqxtys/image/upload/v1750638432/panthart/amy5m5u7nxmhlh8brv6d.png";

type Body = {
  address?: string;
};

function makeUsername(address: string) {
  if (!address) return "collector";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function makeAvatar(address: string) {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(address)}`;
}

export async function POST(req: NextRequest) {
  await prismaReady;

  let address = "";

  try {
    const body = (await req.json()) as Body;
    address = (body.address || "").trim();
  } catch {
    const url = new URL(req.url);
    address = (url.searchParams.get("address") || "").trim();
  }

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  // IMPORTANT:
  // - We do NOT lowercase.
  // - We do NOT rewrite casing.
  // - We store exactly what the wallet provided.
  // CITEXT already gives you case-insensitive uniqueness/search.
  const walletAddress = address;

  try {
    const existing = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        profileAvatar: true,
        profileBanner: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { created: false, user: existing },
        {
          headers: {
            "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
          },
        }
      );
    }

    const created = await prisma.user.create({
      data: {
        walletAddress,
        username: makeUsername(walletAddress),
        profileAvatar: makeAvatar(walletAddress),
        profileBanner: DEFAULT_BANNER,
      },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        profileAvatar: true,
        profileBanner: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      { created: true, user: created },
      { status: 201 }
    );
  } catch (error: any) {
    // Race-safe fallback:
    // if two tabs/pages hit ensure at once, unique CITEXT constraint may fire.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.user.findUnique({
        where: { walletAddress },
        select: {
          id: true,
          walletAddress: true,
          username: true,
          profileAvatar: true,
          profileBanner: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (existing) {
        return NextResponse.json(
          { created: false, user: existing },
          {
            headers: {
              "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
            },
          }
        );
      }
    }

    console.error("users/ensure POST error", error);
    return NextResponse.json(
      { error: error?.message || "Failed to ensure user" },
      { status: 500 }
    );
  }
}