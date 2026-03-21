// src/features/admin/warpool/multisigWrite.ts
"use client";

import { ethers } from "ethers";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";
import {
  getInjectedSigner,
  normalizeEthersError,
} from "@/src/lib/decentWalletSigner";

type BaseWriteParams = {
  multisigAddress: string;
};

type SubmitParams = BaseWriteParams & {
  tokenAddress?: string | null;
  to: string;
  value: string | number | bigint;
  data: string;
};

type TxIndexParams = BaseWriteParams & {
  txIndex: string | number | bigint;
};

export type MultisigWriteResult = {
  hash: string;
  txIndex: string | null;
  receipt: ethers.TransactionReceipt;
};

function normalizeAddress(value: string | null | undefined, fallback?: string) {
  const raw = value?.trim();
  if (!raw) {
    if (fallback) return ethers.getAddress(fallback);
    throw new Error("Address is required.");
  }
  return ethers.getAddress(raw);
}

function normalizeUint(value: string | number | bigint | null | undefined) {
  if (value === null || value === undefined || value === "") return BigInt(0);
  return BigInt(value);
}

function parseTxIndexFromReceipt(
  receipt: ethers.TransactionReceipt
): string | null {
  const iface = new ethers.Interface(MULTI_SIG_ABI);

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (!parsed) continue;

      if (parsed.name === "SubmitTransaction") {
        const txIndex = parsed.args?.txIndex;
        return txIndex !== undefined && txIndex !== null ? String(txIndex) : null;
      }
    } catch {
      // ignore non-matching logs
    }
  }

  return null;
}

async function getMultisigContract(multisigAddress: string) {
  const { signer } = await getInjectedSigner({ requestAccounts: true });
  return new ethers.Contract(
    normalizeAddress(multisigAddress),
    MULTI_SIG_ABI,
    signer
  );
}

export async function submitTransactionWrite(
  params: SubmitParams
): Promise<MultisigWriteResult> {
  try {
    const contract = await getMultisigContract(params.multisigAddress);

    const tx = await contract.submitTransaction(
      normalizeAddress(params.tokenAddress ?? null, ethers.ZeroAddress),
      normalizeAddress(params.to),
      normalizeUint(params.value),
      params.data
    );

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction was sent but no receipt was returned.");
    }

    return {
      hash: tx.hash,
      txIndex: parseTxIndexFromReceipt(receipt),
      receipt,
    };
  } catch (error) {
    throw new Error(normalizeEthersError(error));
  }
}

export async function submitAndConfirmWrite(
  params: SubmitParams
): Promise<MultisigWriteResult> {
  try {
    const contract = await getMultisigContract(params.multisigAddress);

    const tx = await contract.submitAndConfirm(
      normalizeAddress(params.tokenAddress ?? null, ethers.ZeroAddress),
      normalizeAddress(params.to),
      normalizeUint(params.value),
      params.data
    );

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction was sent but no receipt was returned.");
    }

    return {
      hash: tx.hash,
      txIndex: parseTxIndexFromReceipt(receipt),
      receipt,
    };
  } catch (error) {
    throw new Error(normalizeEthersError(error));
  }
}

export async function confirmTransactionWrite(
  params: TxIndexParams
): Promise<MultisigWriteResult> {
  try {
    const contract = await getMultisigContract(params.multisigAddress);

    const tx = await contract.confirmTransaction(normalizeUint(params.txIndex));
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Transaction was sent but no receipt was returned.");
    }

    return {
      hash: tx.hash,
      txIndex: String(params.txIndex),
      receipt,
    };
  } catch (error) {
    throw new Error(normalizeEthersError(error));
  }
}

export async function executeTransactionWrite(
  params: TxIndexParams
): Promise<MultisigWriteResult> {
  try {
    const contract = await getMultisigContract(params.multisigAddress);

    const tx = await contract.executeTransaction(normalizeUint(params.txIndex));
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error("Transaction was sent but no receipt was returned.");
    }

    return {
      hash: tx.hash,
      txIndex: String(params.txIndex),
      receipt,
    };
  } catch (error) {
    throw new Error(normalizeEthersError(error));
  }
}