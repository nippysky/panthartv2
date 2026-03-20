"use client";

import { ethers } from "ethers";

const CORE_WRITE_ABI = [
  "function reserveRelicBonus(uint256 poolId, uint256 comradeTokenId, uint256 relicTokenId) external returns (uint256)",
  "function enterPool(uint256 poolId, uint256 comradeTokenId, uint256 relicTokenId, uint256 reservationId) external returns (uint256)",
] as const;

const LENS_READ_ABI = [
  "function getActiveReservationForUser(uint256 poolId, address user) view returns (uint256)",
] as const;

const ERC721_ABI = [
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
] as const;

function getInjectedEthereum() {
  if (typeof window === "undefined") return null;
  return (window as Window & { ethereum?: unknown }).ethereum ?? null;
}

function requireAddress(value: string | undefined, label: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} is not configured.`);
  }
  return trimmed;
}

export function getWarpoolCoreAddress() {
  return requireAddress(
    process.env.NEXT_PUBLIC_WARPOOL_CORE_ADDRESS,
    "NEXT_PUBLIC_WARPOOL_CORE_ADDRESS"
  );
}

export function getWarpoolLensAddress() {
  return requireAddress(
    process.env.NEXT_PUBLIC_WARPOOL_LENS_ADDRESS,
    "NEXT_PUBLIC_WARPOOL_LENS_ADDRESS"
  );
}

export function getWarpoolComradesCollection() {
  return requireAddress(
    process.env.NEXT_PUBLIC_WARPOOL_COMRADES_COLLECTION,
    "NEXT_PUBLIC_WARPOOL_COMRADES_COLLECTION"
  );
}

export function getWarpoolRelicsCollection() {
  return requireAddress(
    process.env.NEXT_PUBLIC_WARPOOL_RELICS_COLLECTION,
    "NEXT_PUBLIC_WARPOOL_RELICS_COLLECTION"
  );
}

export async function getBrowserSigner(expectedAddress?: string | null) {
  const injected = getInjectedEthereum();
  if (!injected) {
    throw new Error("No injected wallet provider found.");
  }

  const provider = new ethers.BrowserProvider(injected);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();

  if (
    expectedAddress &&
    signerAddress.toLowerCase() !== expectedAddress.toLowerCase()
  ) {
    throw new Error("Connected wallet does not match the active viewer wallet.");
  }

  return { provider, signer, signerAddress };
}

export async function ensureErc721Approval(args: {
  signer: ethers.Signer;
  ownerAddress: string;
  collection: string;
  tokenId: string;
  operator: string;
  onStatus?: (label: string) => void;
}) {
  const contract = new ethers.Contract(args.collection, ERC721_ABI, args.signer);

  args.onStatus?.(`Checking approval for token #${args.tokenId}...`);

  const approved = await contract.getApproved(BigInt(args.tokenId)).catch(() => null);
  if (
    approved &&
    String(approved).toLowerCase() === args.operator.toLowerCase()
  ) {
    return;
  }

  const approvedForAll = await contract.isApprovedForAll(
    args.ownerAddress,
    args.operator
  ).catch(() => false);

  if (approvedForAll) {
    return;
  }

  args.onStatus?.(`Approving token #${args.tokenId}...`);
  const tx = await contract.approve(args.operator, BigInt(args.tokenId));
  await tx.wait();
}

export async function getActiveReservationIdOnChain(args: {
  provider: ethers.BrowserProvider;
  poolIdOnChain: string;
  walletAddress: string;
}) {
  const lens = new ethers.Contract(
    getWarpoolLensAddress(),
    LENS_READ_ABI,
    args.provider
  );

  const id = await lens.getActiveReservationForUser(
    BigInt(args.poolIdOnChain),
    args.walletAddress
  );

  const parsed = BigInt(id.toString());
  return parsed > BigInt(0) ? parsed.toString() : null;
}

export async function reserveRelicBonusTx(args: {
  signer: ethers.Signer;
  poolIdOnChain: string;
  comradeTokenId: string;
  relicTokenId: string;
}) {
  const core = new ethers.Contract(
    getWarpoolCoreAddress(),
    CORE_WRITE_ABI,
    args.signer
  );

  const tx = await core.reserveRelicBonus(
    BigInt(args.poolIdOnChain),
    BigInt(args.comradeTokenId),
    BigInt(args.relicTokenId)
  );

  const receipt = await tx.wait();
  return {
    txHash: receipt?.hash ?? tx.hash,
  };
}

export async function enterPoolTx(args: {
  signer: ethers.Signer;
  poolIdOnChain: string;
  comradeTokenId: string;
  relicTokenId?: string | null;
  reservationIdOnChain?: string | null;
}) {
  const core = new ethers.Contract(
    getWarpoolCoreAddress(),
    CORE_WRITE_ABI,
    args.signer
  );

  const tx = await core.enterPool(
    BigInt(args.poolIdOnChain),
    BigInt(args.comradeTokenId),
    args.relicTokenId ? BigInt(args.relicTokenId) : BigInt(0),
    args.reservationIdOnChain ? BigInt(args.reservationIdOnChain) : BigInt(0)
  );

  const receipt = await tx.wait();
  return {
    txHash: receipt?.hash ?? tx.hash,
  };
}