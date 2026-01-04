// app/api/drop/postdeploy/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { NFT_FACTORY_ABI } from "@/lib/abis/NFTFactoryABI";
import prisma, { prismaReady } from "@/lib/db";
import {
  ContractType,
  DraftStatus,
  MetadataOption,
} from "@/lib/generated/prisma";
import { notifyDeployed } from "@/lib/telegram";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type DeployPayload = {
  metadataOption: "UPLOAD" | "EXTERNAL";
  baseURI: string;
  name: string;
  symbol: string;
  description: string;
  totalSupply: number;
  publicPriceWei: string; // stringified wei
  maxPerWallet: number;
  maxPerTx: number;
  publicStartISO: string;
  royaltyPercent: number;
  royaltyRecipient: string;
  logoUrl?: string;
  coverUrl?: string;
  presale?: {
    startISO: string;
    endISO: string;
    priceWei: string; // stringified wei
    maxSupply: number;
    merkleRoot: string; // 0x...
    allowlistCount?: number;
    allowlistCommit?: string; // sha256
    draftId?: string;
  };
};

const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS!;
const RPC_URL = process.env.RPC_URL!;

/* -------------------------------------------------------------------------- */
/*                                 Utilities                                  */
/* -------------------------------------------------------------------------- */

/** Case-insensitive 0x address equality using EIP-55 normalization. */
function sameAddress(a?: string | null, b?: string | null): boolean {
  try {
    if (!a || !b) return false;
    return ethers.getAddress(a) === ethers.getAddress(b);
  } catch {
    return false;
  }
}

/** Promise-based delay (ms). */
function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/** Robustly coerce any Prisma Decimal / string / bigint-ish wei to a plain BigInt wei. */
function toWeiBigInt(x: unknown): bigint {
  // Prisma Decimal may have .toFixed; strings can be sci-notation
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(Math.trunc(x)); // numbers here should already be integer scale
  if (x && typeof (x as any).toFixed === "function") {
    // Prisma Decimal → integer string (no sci-notation)
    const s = (x as any).toFixed(0);
    return BigInt(s);
  }
  const s = String(x ?? "").trim();
  if (!s) return 0n;
  // already integer?
  if (/^[+-]?\d+$/.test(s)) return BigInt(s);
  // scientific notation: 1.234e+21 → expand
  const m = s.match(/^([+-]?\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (m) {
    const sign = m[1].startsWith("-") ? "-" : "";
    const intPart = m[1].replace(/^[+-]/, "");
    const frac = m[2] || "";
    const exp = parseInt(m[3], 10);
    if (exp >= 0) {
      const digits = intPart + frac;
      const zeros = exp - frac.length;
      const body =
        zeros >= 0 ? digits + "0".repeat(zeros) : digits.slice(0, digits.length + zeros);
      return BigInt((sign ? "-" : "") + (body.replace(/^0+(?=\d)/, "") || "0"));
    } else {
      // negative exponent: fractional < 1 wei → 0
      return 0n;
    }
  }
  // last-ditch: strip non-digits (keep leading - if present)
  return BigInt(s.replace(/[^\d-]/g, "") || "0");
}

/**
 * Insert whitelist rows in chunks, OUTSIDE any interactive transaction.
 * - Uses createMany with skipDuplicates for idempotency.
 * - Retries each chunk a few times with exponential backoff to smooth transient DB pressure.
 */
async function insertWhitelistRows(
  presaleId: string,
  rawAddresses: string[],
  chunkSize = 1000
) {
  if (!rawAddresses.length) return;

  // Prepare rows (preserve original casing; DB should use CITEXT for uniq)
  const rows = rawAddresses.map((addr) => ({
    presaleId,
    address: addr,
  }));

  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize);

    let attempt = 0;
    while (true) {
      try {
        await prisma.presaleWhitelistAddress.createMany({
          data: batch,
          skipDuplicates: true,
        });
        break;
      } catch (e: any) {
        attempt++;
        if (attempt >= 3) {
          e.message = `[whitelist] createMany failed for rows ${i}-${i + batch.length - 1}: ${
            e.message || e
          }`;
          throw e;
        }
        // 300ms, 900ms backoff
        await delay(300 * Math.pow(3, attempt - 1));
      }
    }
  }
}

/** Minimal validation of required payload pieces before touching chain/DB. */
function validatePayload(p: DeployPayload) {
  if (!p) throw new Error("Missing payload");
  if (!p.name?.trim() || !p.symbol?.trim()) throw new Error("Name/symbol required");
  if (!p.baseURI?.trim()) throw new Error("Base URI required");
  if (!p.royaltyRecipient || !ethers.isAddress(p.royaltyRecipient))
    throw new Error("Invalid royalty recipient");
  if (!(Number.isInteger(p.totalSupply) && p.totalSupply > 0))
    throw new Error("Invalid totalSupply");
  if (!p.publicStartISO) throw new Error("publicStartISO required");
  if (!p.publicPriceWei || toWeiBigInt(p.publicPriceWei) <= 0n)
    throw new Error("Invalid publicPriceWei");
  if (!(Number.isInteger(p.maxPerWallet) && p.maxPerWallet > 0))
    throw new Error("Invalid maxPerWallet");
  if (!(Number.isInteger(p.maxPerTx) && p.maxPerTx > 0))
    throw new Error("Invalid maxPerTx");

  if (p.presale) {
    if (!p.presale.merkleRoot || !/^0x[0-9a-fA-F]{64}$/.test(p.presale.merkleRoot))
      throw new Error("Invalid presale merkleRoot");
    if (!p.presale.startISO || !p.presale.endISO) throw new Error("Presale window required");
    if (!(Number.isInteger(p.presale.maxSupply) && p.presale.maxSupply > 0))
      throw new Error("Invalid presale maxSupply");
    if (!p.presale.priceWei || toWeiBigInt(p.presale.priceWei) <= 0n)
      throw new Error("Invalid presale priceWei");
  }
}

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  await prismaReady;

  try {
    if (!FACTORY_ADDRESS || !RPC_URL) {
      return NextResponse.json(
        { error: "Server missing FACTORY_ADDRESS/RPC_URL" },
        { status: 500 }
      );
    }

    const { txHash, payload } = (await req.json()) as {
      txHash: string;
      payload: DeployPayload;
    };

    if (!txHash || !payload) {
      return NextResponse.json({ error: "Missing txHash/payload" }, { status: 400 });
    }

    // Fast fail on obviously bad payload before any external IO.
    validatePayload(payload);

    /* --------------------------- 1) Chain lookups -------------------------- */

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Idempotency guard #1: if we've already recorded this txHash, return success
    {
      const existingByTx = await prisma.deployedContract.findUnique({
        where: { txHash }, // ensure you have a unique index on txHash
        select: { cloneAddress: true, collectionId: true, id: true, deployerAddress: true },
      }).catch(() => null);
      if (existingByTx) {
        return NextResponse.json({
          ok: true,
          cloneAddress: existingByTx.cloneAddress,
          deployer: existingByTx.deployerAddress,
          collectionId: existingByTx.collectionId,
          deployedId: existingByTx.id,
          idempotent: true,
        });
      }
    }

    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    if (!tx || !receipt || receipt.status !== 1) {
      return NextResponse.json({ error: "Transaction not found or failed" }, { status: 400 });
    }
    if (!tx.to || !sameAddress(tx.to, FACTORY_ADDRESS)) {
      return NextResponse.json({ error: "Tx not sent to factory" }, { status: 400 });
    }

    // Parse factory logs → deployer + clone address
    const iface = new ethers.Interface(NFT_FACTORY_ABI as any);
    let deployer = "";
    let cloneAddress = "";
    for (const log of receipt.logs ?? []) {
      if (!sameAddress(log.address, FACTORY_ADDRESS)) continue;
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "ERC721DropCloneCreated") {
          deployer = (parsed.args?.[0] as string) || "";
          cloneAddress = (parsed.args?.[1] as string) || "";
          break;
        }
      } catch {
        // ignore parse errors for unrelated logs
      }
    }
    if (!ethers.isAddress(cloneAddress)) {
      return NextResponse.json(
        { error: "Could not parse clone address from logs" },
        { status: 400 }
      );
    }

    // Idempotency guard #2: if we already stored that cloneAddress, return success
    {
      const existingByClone = await prisma.deployedContract.findFirst({
        where: { cloneAddress: cloneAddress },
        select: { id: true, collectionId: true, deployerAddress: true },
      }).catch(() => null);
      if (existingByClone) {
        return NextResponse.json({
          ok: true,
          cloneAddress,
          deployer: existingByClone.deployerAddress,
          collectionId: existingByClone.collectionId,
          deployedId: existingByClone.id,
          idempotent: true,
        });
      }
    }

    // Best-effort implementation address (read-only)
    let implementationAddr = "";
    try {
      const factory = new ethers.Contract(FACTORY_ADDRESS, NFT_FACTORY_ABI as any, provider);
      const impl = await factory.erc721DropImpl();
      implementationAddr = ethers.isAddress(impl) ? impl : "";
    } catch {
      implementationAddr = "";
    }

    /* --------------------------- 2) Fee snapshot --------------------------- */

    // Always read the most recent active config so it matches what /api/fees returns to the client.
    const cfg = await prisma.feeConfig.findFirst({
      where: {
        contractType: ContractType.ERC721_DROP,
        metadataOption:
          payload.metadataOption === "UPLOAD" ? MetadataOption.UPLOAD : MetadataOption.EXTERNAL,
        active: true,
      },
      orderBy: { updatedAt: "desc" }, // <— IMPORTANT: prefer most recent
    });

    const feeRecipient = cfg?.feeRecipient ?? "";
    const cfgAmountWei = toWeiBigInt(cfg?.feeAmountEtnWei ?? 0);
    const txValueWei = toWeiBigInt(tx.value?.toString() ?? "0");

    if (cfgAmountWei !== 0n && cfgAmountWei !== txValueWei) {
      // Log as integers and humanized for easier debugging
      const toEth = (w: bigint) => Number(w) / 1e18;
      console.warn(
        `[postdeploy] Fee mismatch: tx.value=${txValueWei} (${toEth(txValueWei)} ETN) vs FeeConfig=${cfgAmountWei} (${toEth(
          cfgAmountWei
        )} ETN) (option=${payload.metadataOption})`
      );
    }

    /* ------------------------ 3) Normalize inputs ------------------------- */

    const royaltyBps = Math.round((payload.royaltyPercent || 0) * 100);
    const baseUriNormalized =
      (payload.baseURI ? String(payload.baseURI).replace(/\/+$/, "") : "") || null;

    // Load draft once (outside tx) – we only *reference* its content
    const draft =
      (payload.presale?.draftId
        ? await prisma.presaleDraft.findFirst({ where: { id: payload.presale.draftId } })
        : null) ??
      (payload.presale?.allowlistCommit
        ? await prisma.presaleDraft.findFirst({
            where: { sha256Commit: payload.presale.allowlistCommit },
            orderBy: { createdAt: "desc" },
          })
        : null);

    const rawAddresses: string[] = Array.isArray(draft?.addresses)
      ? (draft!.addresses as string[])
      : [];

    // Count *unique valid* addresses for whitelistCount storage (case-insensitive)
    const uniqueForCount = (() => {
      const set = new Set<string>();
      for (const a of rawAddresses) {
        try {
          set.add(ethers.getAddress(String(a).trim()));
        } catch {
          // skip invalid
        }
      }
      return set.size;
    })();

    if (
      payload.presale &&
      typeof payload.presale.allowlistCount === "number" &&
      payload.presale.allowlistCount !== uniqueForCount
    ) {
      console.warn(
        `[postdeploy] allowlistCount mismatch: client=${payload.presale.allowlistCount} draft=${uniqueForCount}`
      );
    }

    const effectiveAllowlistCommit =
      payload.presale?.allowlistCommit ?? draft?.sha256Commit ?? null;

    /* -------------------- 4) Phase A: short transaction ------------------- */
    // Do only *dependent* writes inside an interactive transaction.
    // Extend timeout/maxWait a bit, but keep work minimal to avoid expiry.

    const txResult = await prisma.$transaction(
      async (db) => {
        // Collection
        const collection = await db.collection.create({
          data: {
            name: payload.name,
            symbol: payload.symbol,
            contract: cloneAddress, // preserve original casing
            description: payload.description || "",
            logoUrl: payload.logoUrl,
            coverUrl: payload.coverUrl,
            standard: "ERC721",
            supply: payload.totalSupply,
            baseUri: baseUriNormalized,
            ownerAddress: deployer, // preserve original casing
            creator: {
              connectOrCreate: {
                where: { walletAddress: deployer },
                create: {
                  walletAddress: deployer,
                  username: `${deployer.slice(0, 6)}…${deployer.slice(-4)}`,
                  profileAvatar: "",
                },
              },
            },
          },
        });

        // DeployedContract snapshot
        const deployed = await db.deployedContract.create({
          data: {
            contractType: ContractType.ERC721_DROP,
            cloneAddress: cloneAddress,
            implementationAddr,
            factoryAddress: FACTORY_ADDRESS,
            deployerAddress: deployer,
            txHash,
            blockNumber: Number(receipt.blockNumber || 0),

            metadataOption:
              payload.metadataOption === "UPLOAD" ? MetadataOption.UPLOAD : MetadataOption.EXTERNAL,
            feeRecipient,
            feeAmountEtnWei: txValueWei.toString(),

            royaltyRecipient: payload.royaltyRecipient,
            royaltyBps,

            baseURI: baseUriNormalized,
            maxSupply: payload.totalSupply,

            rawInit: {
              ...payload,
              _feeSnapshot: {
                recipient: feeRecipient || null,
                cfgAmountEtnWei: cfgAmountWei.toString(),
                txValueEtnWei: txValueWei.toString(),
              },
            } as any,

            collection: { connect: { id: collection.id } },
          },
        });

        // Public sale snapshot
        await db.publicSale.create({
          data: {
            collectionId: collection.id,
            startTime: new Date(payload.publicStartISO),
            priceEtnWei: payload.publicPriceWei,
            maxPerWallet: payload.maxPerWallet,
            maxPerTx: payload.maxPerTx,
          },
        });

        // Presale snapshot (NOTE: do NOT insert whitelist here)
        let presaleRowId: string | null = null;
        if (payload.presale) {
          const presaleRow = await db.presale.create({
            data: {
              collectionId: collection.id,
              startTime: new Date(payload.presale.startISO),
              endTime: new Date(payload.presale.endISO),
              priceEtnWei: payload.presale.priceWei,
              maxSupply: payload.presale.maxSupply,
              merkleRoot: payload.presale.merkleRoot,
              whitelistCount: uniqueForCount, // exact number after dedupe
              allowlistCommit: effectiveAllowlistCommit,
            },
          });
          presaleRowId = presaleRow.id;
        }

        return {
          collectionId: collection.id,
          deployedId: deployed.id,
          presaleRowId,
          draftId: draft?.id ?? null,
        };
      },
      // Keep this short; raise a bit above the default to dodge the 5s cut-off,
      // but the heavy work (whitelist) happens after.
      { timeout: 20000, maxWait: 10000 }
    );

    /* -------------------- 5) Phase B: whitelist materialize ---------------- */
    // Heavy writes OUTSIDE the interactive transaction to avoid "Transaction already closed".

    if (payload.presale && txResult.presaleRowId) {
      if (rawAddresses.length) {
        await insertWhitelistRows(txResult.presaleRowId, rawAddresses, 1000);
      } else {
        console.warn(
          `[postdeploy] No addresses to copy from draft (empty or missing). draftId=${txResult.draftId ?? "n/a"} commit=${
            effectiveAllowlistCommit ?? "n/a"
          }`
        );
      }

      // Mark draft consumed AFTER whitelist is copied (idempotent)
      if (draft && draft.status !== DraftStatus.CONSUMED) {
        try {
          await prisma.presaleDraft.update({
            where: { id: draft.id },
            data: {
              status: DraftStatus.CONSUMED,
              consumedAt: new Date(),
              consumedByPresaleId: txResult.presaleRowId,
            },
          });
        } catch (e) {
          console.warn("[postdeploy] draft consume update failed:", (e as any)?.message || e);
        }
      }
    }

    /* --------------------- 6) Post-commit side effects --------------------- */
    // Fire-and-forget notification; do not block success.
    try {
      await notifyDeployed({
        id: String(txResult.collectionId),
        name: payload.name,
        symbol: payload.symbol,
        contract: cloneAddress,
        supply: payload.totalSupply,
        deployer,
      });
    } catch (e) {
      console.warn("[postdeploy] telegram notify error:", (e as any)?.message || e);
    }

    return NextResponse.json({
      ok: true,
      cloneAddress,
      deployer,
      collectionId: txResult.collectionId,
      deployedId: txResult.deployedId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}
