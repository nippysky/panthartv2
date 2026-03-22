"use client";

import { ethers } from "ethers";

export type BrowserMultisigAction = {
  id: string;
  orderIndex: number;
  label: string | null;
  summary: string | null;
  target: string;
  valueWei: string;
  tokenAddress: string | null;
  dataHex: string;
  functionName: string | null;
  argsJson: unknown;
  status: "PENDING" | "SUBMITTED" | "EXECUTED" | "FAILED";
};

const MULTISIG_ABI = [
  "event SubmitTransaction(address indexed owner,uint256 indexed txIndex,address indexed to,uint256 value,address tokenAddress,bytes data)",
  "event ConfirmTransaction(address indexed owner,uint256 indexed txIndex)",
  "event ExecuteTransaction(address indexed executor,uint256 indexed txIndex)",
  "function getTransactionCount() view returns (uint256)",
  "function submitTransaction(address token,address destination,uint256 value,bytes data) returns (uint256)",
  "function submitAndConfirm(address token,address destination,uint256 value,bytes data) returns (uint256)",
  "function confirmTransaction(uint256 txIndex)",
  "function executeTransaction(uint256 txIndex)",
] as const;

const MULTISIG_IFACE = new ethers.Interface(MULTISIG_ABI);

declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider;
  }
}

function getInjectedProvider(): ethers.Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet provider found.");
  }
  return window.ethereum;
}

async function getBrowserSigner() {
  const provider = new ethers.BrowserProvider(getInjectedProvider());
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

function normalizeAddress(value: string, label: string) {
  if (!ethers.isAddress(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return ethers.getAddress(value);
}

function normalizeTokenAddress(value: string | null | undefined) {
  if (!value) return ethers.ZeroAddress;
  if (!ethers.isAddress(value)) {
    throw new Error("Invalid token address.");
  }
  return ethers.getAddress(value);
}

function normalizeValueWei(value: string | null | undefined) {
  const raw = String(value ?? "0").trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error("Invalid valueWei. Expected a base-10 integer string.");
  }
  return BigInt(raw);
}

function normalizeDataHex(value: string | null | undefined) {
  const raw = String(value ?? "0x").trim();
  if (!raw) return "0x";
  if (!ethers.isHexString(raw)) {
    throw new Error("Invalid calldata hex.");
  }
  return raw;
}

function normalizeTxIndex(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Invalid multisig transaction index.");
  }
  return value;
}

function labelForAction(action: BrowserMultisigAction) {
  return action.label || action.functionName || `action #${action.orderIndex + 1}`;
}

function parseSubmitLifecycleFromReceipt(params: {
  receipt: ethers.TransactionReceipt;
  multisigAddress: string;
  submitter: string;
}) {
  const walletAddress = ethers.getAddress(params.multisigAddress);
  const submitter = ethers.getAddress(params.submitter);

  let txIndex: number | null = null;
  let confirmedInSameTx = false;
  let executedInSameTx = false;

  for (const log of params.receipt.logs) {
    if (ethers.getAddress(log.address) !== walletAddress) continue;

    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = MULTISIG_IFACE.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
    } catch {
      continue;
    }

    if (!parsed) continue;

    if (parsed.name === "SubmitTransaction") {
      const owner = ethers.getAddress(String(parsed.args.owner));
      if (owner === submitter) {
        txIndex = Number(parsed.args.txIndex);
      }
    }

    if (parsed.name === "ConfirmTransaction") {
      const owner = ethers.getAddress(String(parsed.args.owner));
      const confirmedTxIndex = Number(parsed.args.txIndex);
      if (owner === submitter && txIndex !== null && confirmedTxIndex === txIndex) {
        confirmedInSameTx = true;
      }
    }

    if (parsed.name === "ExecuteTransaction") {
      const executor = ethers.getAddress(String(parsed.args.executor));
      if (executor === submitter && txIndex !== null) {
        executedInSameTx = true;
      }
    }
  }

  if (txIndex === null) {
    throw new Error(
      "Could not resolve submitted multisig tx index from receipt logs."
    );
  }

  return {
    txIndex,
    confirmedInSameTx,
    executedInSameTx,
  };
}

export async function submitMultisigAction(params: {
  multisigAddress: string;
  action: BrowserMultisigAction;
  autoConfirm?: boolean;
}) {
  const { multisigAddress, action, autoConfirm = true } = params;

  const safeAddress = normalizeAddress(multisigAddress, "multisig address");
  const target = normalizeAddress(
    action.target,
    `target address for ${labelForAction(action)}`
  );
  const tokenAddress = normalizeTokenAddress(action.tokenAddress);
  const value = normalizeValueWei(action.valueWei);
  const dataHex = normalizeDataHex(action.dataHex);

  const signer = await getBrowserSigner();
  const submitter = await signer.getAddress();
  const contract = new ethers.Contract(safeAddress, MULTISIG_ABI, signer);

  const txResponse = autoConfirm
    ? await contract.submitAndConfirm(tokenAddress, target, value, dataHex)
    : await contract.submitTransaction(tokenAddress, target, value, dataHex);

  const receipt = await txResponse.wait();
  if (!receipt) {
    throw new Error("Submission transaction did not produce a receipt.");
  }

  const txHash = receipt.hash || txResponse.hash;
  if (!txHash) {
    throw new Error("Submission transaction hash is missing.");
  }

  const parsed = parseSubmitLifecycleFromReceipt({
    receipt,
    multisigAddress: safeAddress,
    submitter,
  });

  return {
    txHash,
    txIndex: parsed.txIndex,
    submitter,
    confirmedInSameTx: parsed.confirmedInSameTx,
    executedInSameTx: parsed.executedInSameTx,
  };
}

export async function confirmMultisigAction(params: {
  multisigAddress: string;
  txIndex: number;
}) {
  const safeAddress = normalizeAddress(params.multisigAddress, "multisig address");
  const txIndex = normalizeTxIndex(params.txIndex);

  const signer = await getBrowserSigner();
  const ownerAddress = await signer.getAddress();
  const contract = new ethers.Contract(safeAddress, MULTISIG_ABI, signer);

  const txResponse = await contract.confirmTransaction(BigInt(txIndex));
  const receipt = await txResponse.wait();

  return {
    txHash: receipt?.hash || txResponse.hash,
    ownerAddress,
  };
}

export async function executeMultisigAction(params: {
  multisigAddress: string;
  txIndex: number;
}) {
  const safeAddress = normalizeAddress(params.multisigAddress, "multisig address");
  const txIndex = normalizeTxIndex(params.txIndex);

  const signer = await getBrowserSigner();
  const executor = await signer.getAddress();
  const contract = new ethers.Contract(safeAddress, MULTISIG_ABI, signer);

  const txResponse = await contract.executeTransaction(BigInt(txIndex));
  const receipt = await txResponse.wait();

  return {
    txHash: receipt?.hash || txResponse.hash,
    executor,
  };
}

/**
 * Compatibility wrappers retained so other code paths do not break.
 * The detail page now uses the action-level helpers above.
 */
export async function submitStoredMultisigProposal(params: {
  proposalId: string;
  safeAddress: string;
  actions: BrowserMultisigAction[];
}) {
  const results = [];
  for (const action of params.actions) {
    results.push(
      await submitMultisigAction({
        multisigAddress: params.safeAddress,
        action,
        autoConfirm: true,
      })
    );
  }
  return results;
}

export async function confirmStoredMultisigProposal(params: {
  proposalId: string;
  safeAddress: string;
  nonce: number;
}) {
  return confirmMultisigAction({
    multisigAddress: params.safeAddress,
    txIndex: params.nonce,
  });
}

export async function executeStoredMultisigProposal(params: {
  proposalId: string;
  safeAddress: string;
  nonce: number;
}) {
  return executeMultisigAction({
    multisigAddress: params.safeAddress,
    txIndex: params.nonce,
  });
}