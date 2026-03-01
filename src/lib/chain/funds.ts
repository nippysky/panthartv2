/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/chain/funds.ts
import { ethers } from "ethers";

type AnyProvider = ethers.Provider | ethers.AbstractProvider;

export async function ensureSufficientFunds(
  provider: AnyProvider,
  from: string,
  tx: Partial<ethers.TransactionRequest> & { to: string; value?: bigint }
) {
  const p = provider as any;

  const have: bigint = BigInt((await p.getBalance(from)).toString());

  // getFeeData may not exist on minimal providers; fall back to gasPrice if needed
  const fee =
    (await p.getFeeData?.()) ??
    ({ gasPrice: await p.getGasPrice?.() } as { maxFeePerGas?: bigint; gasPrice?: bigint });

  const maxFeePerGasRaw =
    tx.maxFeePerGas ?? fee?.maxFeePerGas ?? fee?.gasPrice ?? BigInt(0);

  const maxFeePerGas = BigInt(maxFeePerGasRaw.toString());

  let gasLimit: bigint = BigInt(0);
  try {
    const estimated = await p.estimateGas({ from, ...tx });
    gasLimit = BigInt(estimated.toString());
  } catch {
    gasLimit = BigInt(300_000); // conservative fallback
  }

  const need = (tx.value ?? BigInt(0)) + gasLimit * maxFeePerGas;
  return { ok: have >= need, have, need, gasLimit, maxFeePerGas };
}
