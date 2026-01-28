export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ethers } from "ethers";
import prisma, { prismaReady } from "@/src/lib/db";

const ERC721_ABI = ["function ownerOf(uint256 tokenId) view returns (address)"] as const;

function normAddr(a: string) {
  return ethers.getAddress(a);
}

function defaultUsername(addr: string) {
  return `user_${addr.slice(2, 8).toLowerCase()}`;
}

// IMPORTANT: must exist in public/. Use your real default if you have one.
const DEFAULT_AVATAR = "/img/default-avatar.png";

function getRpcUrl() {
  return (
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://rpc.ankr.com/electroneum"
  );
}

export async function POST(req: Request) {
  await prismaReady;

  const body = await req.json().catch(() => null);
  const contract = body?.contract as string | undefined;
  const tokenId = body?.tokenId as string | number | undefined;

  if (!contract || tokenId === undefined || tokenId === null) {
    return NextResponse.json({ error: "Missing contract/tokenId" }, { status: 400 });
  }

  const provider = new ethers.JsonRpcProvider(getRpcUrl());
  const c = new ethers.Contract(normAddr(contract), ERC721_ABI, provider);

  let owner: string;
  try {
    owner = normAddr(await c.ownerOf(BigInt(tokenId)));
  } catch {
    return NextResponse.json({ error: "ownerOf failed (is this ERC721?)" }, { status: 400 });
  }

  // Create user if missing (schema requires username + profileAvatar)
  const user = await prisma.user.upsert({
    where: { walletAddress: owner },
    update: {},
    create: {
      walletAddress: owner,
      username: defaultUsername(owner),
      profileAvatar: DEFAULT_AVATAR,
    },
  });

  // Update NFT ownerId (uses @@unique([contract, tokenId]))
  await prisma.nFT.update({
    where: {
      contract_tokenId: {
        contract: contract.toLowerCase(),
        tokenId: String(tokenId),
      },
    },
    data: { ownerId: user.id },
  });

  const resp = NextResponse.json({ owner }, { status: 200 });
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}
