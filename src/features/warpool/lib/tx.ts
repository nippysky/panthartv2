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

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
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

export function getWarpoolDcntToken() {
  return requireAddress(
    process.env.NEXT_PUBLIC_WARPOOL_DCNT_TOKEN,
    "NEXT_PUBLIC_WARPOOL_DCNT_TOKEN"
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

  args.onStatus?.("Checking NFT approval...");

  const approved = await contract.getApproved(BigInt(args.tokenId));
  if (String(approved).toLowerCase() === args.operator.toLowerCase()) {
    return;
  }

  const approvedForAll = await contract.isApprovedForAll(
    args.ownerAddress,
    args.operator
  );

  if (approvedForAll) {
    return;
  }

  args.onStatus?.("Requesting NFT approval...");
  const tx = await contract.approve(args.operator, BigInt(args.tokenId));
  await tx.wait();

  args.onStatus?.("NFT approval confirmed.");
}

export async function ensureErc20Approval(args: {
  signer: ethers.Signer;
  ownerAddress: string;
  token: string;
  spender: string;
  requiredAmountRaw: bigint;
  onStatus?: (label: string) => void;
}) {
  if (args.requiredAmountRaw <= BigInt(0)) return;

  const contract = new ethers.Contract(args.token, ERC20_ABI, args.signer);

  args.onStatus?.("Checking DCNT allowance...");

  const allowance = await contract.allowance(args.ownerAddress, args.spender);
  if (BigInt(allowance.toString()) >= args.requiredAmountRaw) {
    return;
  }

  args.onStatus?.("Requesting DCNT approval...");
  const tx = await contract.approve(args.spender, args.requiredAmountRaw);
  await tx.wait();

  args.onStatus?.("DCNT approval confirmed.");
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
    BigInt(args.relicTokenId ?? "0"),
    BigInt(args.reservationIdOnChain ?? "0")
  );

  const receipt = await tx.wait();

  return {
    txHash: receipt?.hash ?? tx.hash,
  };
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

  const result = await lens.getActiveReservationForUser(
    BigInt(args.poolIdOnChain),
    args.walletAddress
  );

  const value = BigInt(result.toString());
  return value > BigInt(0) ? value.toString() : null;
}