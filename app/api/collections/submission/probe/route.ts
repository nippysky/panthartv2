/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

/* ---------------- chain config ---------------- */
const RPC_URL =
  process.env.RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://rpc.ankr.com/electroneum";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || 52014);

/* ---------------- ABIs ---------------- */
const ERC165_ABI = [
  "function supportsInterface(bytes4 interfaceId) external view returns (bool)",
];

const ERC721_META_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

const ERC721_SUPPLY_ABI = ["function totalSupply() view returns (uint256)"];
const OWNABLE_ABI = ["function owner() view returns (address)"];

const ACCESSCONTROL_ABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
];

const READ_ABI = [
  ...ERC165_ABI,
  ...ERC721_META_ABI,
  ...ERC721_SUPPLY_ABI,
  ...OWNABLE_ABI,
  ...ACCESSCONTROL_ABI,
];

const IFACE_ERC721 = "0x80ac58cd";
const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/* ---------------- provider ---------------- */
const provider = new ethers.JsonRpcProvider(RPC_URL);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const contract = (url.searchParams.get("contract") || "").trim();
    const account = (url.searchParams.get("account") || "").trim();

    if (!contract) {
      return NextResponse.json({ ok: false, error: "Missing contract" }, { status: 400 });
    }
    if (!ethers.isAddress(contract)) {
      return NextResponse.json({ ok: false, error: "Invalid contract address" }, { status: 400 });
    }

    // sanity: chain id check (helps catch misconfigured RPC)
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== CHAIN_ID) {
      return NextResponse.json(
        { ok: false, error: "Server RPC is on the wrong chain" },
        { status: 500 }
      );
    }

    const c = new ethers.Contract(contract, READ_ABI, provider);

    let isErc721 = true;
    try {
      isErc721 = await c.supportsInterface(IFACE_ERC721);
    } catch {
      // Some contracts omit ERC165; we keep UX friendly and allow fallback
      isErc721 = true;
    }

    let name: string | null = null;
    let symbol: string | null = null;
    let supply: string | null = null;

    try { name = await c.name(); } catch {}
    try { symbol = await c.symbol(); } catch {}
    try {
      const ts: bigint = await c.totalSupply();
      supply = ts?.toString?.() ?? null;
    } catch {
      supply = null;
    }

    // owner: try Ownable.owner(); fallback to AccessControl DEFAULT_ADMIN_ROLE(account)
    let ownerAddress: string | null = null;

    try {
      const own = await c.owner();
      if (own && ethers.isAddress(own)) ownerAddress = ethers.getAddress(own);
    } catch {}

    if (!ownerAddress && account && ethers.isAddress(account)) {
      try {
        const has = await c.hasRole(DEFAULT_ADMIN_ROLE, account);
        if (has) ownerAddress = ethers.getAddress(account);
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      isErc721,
      name,
      symbol,
      supply,
      ownerAddress,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Probe failed" },
      { status: 500 }
    );
  }
}
