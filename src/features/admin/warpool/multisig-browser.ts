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
  status: "PENDING" | "SUBMITTED" | "EXECUTED" | "FAILED";
};

export type BrowserMultisigTxSnapshot = {
  txIndex: number;
  tokenAddress: string;
  to: string;
  value: string;
  executed: boolean;
  confirmations: number;
  data: string;
};

const MULTISIG_ABI = [
  "function getTransactionCount() view returns (uint256)",
  "function getTransaction(uint256 txIndex) view returns (address tokenAddress, address to, uint256 value, bool executed, uint256 confirmationsCount, bytes data)",
  "function isConfirmed(uint256 txIndex, address ownerAddr) view returns (bool)",
  "function required() view returns (uint256)",
  "function submitTransaction(address tokenAddress, address to, uint256 value, bytes data) returns (uint256 txIndex)",
  "function submitAndConfirm(address tokenAddress, address to, uint256 value, bytes data) returns (uint256 txIndex)",
  "function confirmTransaction(uint256 txIndex)",
  "function executeTransaction(uint256 txIndex)",
] as const;

type Eip1193Like = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

function getInjectedProvider(): Eip1193Like {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet provider found.");
  }

  return window.ethereum as unknown as Eip1193Like;
}

export async function getBrowserProvider() {
  const injected = getInjectedProvider();
  const provider = new ethers.BrowserProvider(injected as ethers.Eip1193Provider);

  await provider.send("eth_requestAccounts", []);
  return provider;
}

export async function getBrowserSigner() {
  const provider = await getBrowserProvider();
  return provider.getSigner();
}

export async function getConnectedAddress() {
  const signer = await getBrowserSigner();
  return signer.getAddress();
}

export async function getMultisigContract(multisigAddress: string) {
  if (!ethers.isAddress(multisigAddress)) {
    throw new Error("Invalid multisig address.");
  }

  const signer = await getBrowserSigner();
  return new ethers.Contract(multisigAddress, MULTISIG_ABI, signer);
}

export async function getMultisigRequired(multisigAddress: string) {
  const contract = await getMultisigContract(multisigAddress);
  const required = await contract.required();
  return Number(required);
}

export async function getMultisigTx(multisigAddress: string, txIndex: number) {
  const contract = await getMultisigContract(multisigAddress);
  const tx = await contract.getTransaction(BigInt(txIndex));

  return {
    txIndex,
    tokenAddress: String(tx.tokenAddress),
    to: String(tx.to),
    value: tx.value.toString(),
    executed: Boolean(tx.executed),
    confirmations: Number(tx.confirmationsCount),
    data: String(tx.data),
  } satisfies BrowserMultisigTxSnapshot;
}

export async function isMultisigTxConfirmedBy(
  multisigAddress: string,
  txIndex: number,
  ownerAddress: string
) {
  const contract = await getMultisigContract(multisigAddress);
  return Boolean(await contract.isConfirmed(BigInt(txIndex), ownerAddress));
}

export async function submitMultisigAction(params: {
  multisigAddress: string;
  action: BrowserMultisigAction;
  autoConfirm?: boolean;
}) {
  const { multisigAddress, action, autoConfirm = true } = params;

  if (!ethers.isAddress(action.target)) {
    throw new Error(`Invalid target address for action #${action.orderIndex + 1}.`);
  }

  const signer = await getBrowserSigner();
  const submitter = await signer.getAddress();
  const contract = new ethers.Contract(multisigAddress, MULTISIG_ABI, signer);

  const countBefore = await contract.getTransactionCount();

  const tokenAddress =
    action.tokenAddress && ethers.isAddress(action.tokenAddress)
      ? action.tokenAddress
      : ethers.ZeroAddress;

  const value = BigInt(action.valueWei || "0");
  const dataHex = action.dataHex || "0x";

  const txResponse = autoConfirm
    ? await contract.submitAndConfirm(tokenAddress, action.target, value, dataHex)
    : await contract.submitTransaction(tokenAddress, action.target, value, dataHex);

  const receipt = await txResponse.wait();
  const txIndex = Number(countBefore);

  return {
    txHash: receipt?.hash || txResponse.hash,
    txIndex,
    submitter,
  };
}

export async function confirmMultisigAction(params: {
  multisigAddress: string;
  txIndex: number;
}) {
  const { multisigAddress, txIndex } = params;

  const signer = await getBrowserSigner();
  const ownerAddress = await signer.getAddress();
  const contract = new ethers.Contract(multisigAddress, MULTISIG_ABI, signer);

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
  const { multisigAddress, txIndex } = params;

  const signer = await getBrowserSigner();
  const executor = await signer.getAddress();
  const contract = new ethers.Contract(multisigAddress, MULTISIG_ABI, signer);

  const txResponse = await contract.executeTransaction(BigInt(txIndex));
  const receipt = await txResponse.wait();

  return {
    txHash: receipt?.hash || txResponse.hash,
    executor,
  };
}

export async function submitStoredMultisigProposal(params: {
  proposalId: string;
  safeAddress: string;
  actions: BrowserMultisigAction[];
}) {
  const { actions } = params;

  if (!actions.length) {
    throw new Error("This proposal has no stored actions to submit.");
  }

  const results = [];

  for (const action of [...actions].sort((a, b) => a.orderIndex - b.orderIndex)) {
    const result = await submitMultisigAction({
      multisigAddress: params.safeAddress,
      action,
      autoConfirm: true,
    });

    results.push({
      actionId: action.id,
      txHash: result.txHash,
      txIndex: result.txIndex,
      submitter: result.submitter,
    });
  }

  return {
    proposalId: params.proposalId,
    safeAddress: params.safeAddress,
    results,
  };
}

export async function confirmStoredMultisigProposal(params: {
  proposalId: string;
  safeAddress: string;
  nonce: number;
}) {
  const result = await confirmMultisigAction({
    multisigAddress: params.safeAddress,
    txIndex: params.nonce,
  });

  return {
    proposalId: params.proposalId,
    nonce: params.nonce,
    ...result,
  };
}

export async function executeStoredMultisigProposal(params: {
  proposalId: string;
  safeAddress: string;
  nonce: number;
}) {
  const result = await executeMultisigAction({
    multisigAddress: params.safeAddress,
    txIndex: params.nonce,
  });

  return {
    proposalId: params.proposalId,
    nonce: params.nonce,
    ...result,
  };
}