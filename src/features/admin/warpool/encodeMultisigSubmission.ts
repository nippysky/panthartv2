import { ethers } from "ethers";
import { MULTI_SIG_ABI } from "@/src/lib/abis/marketplace-core/multiSigABI";

export type BaseExecutableAction = {
  id: string;
  target: string;
  value: string;
  data: string;
  summary: string;
  functionName: string;
  args: unknown[];
};

export type EncodedMultisigSubmission = {
  multisigAddress: string;
  tokenAddress: string;
  to: string;
  value: string;
  data: string;
  summary: string;
  submitTransactionData: string;
  submitAndConfirmData: string;
};

export type EncodedMultisigSubmissionPlan = {
  multisigAddress: string;
  warnings: string[];
  submissions: EncodedMultisigSubmission[];
};

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return ethers.getAddress(trimmed);
}

function normalizeUintString(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) return "0";
  const str = typeof value === "string" ? value.trim() : String(value);
  if (!str) return "0";
  return str;
}

export function encodeMultisigSubmissionPlan(params: {
  multisigAddress: string;
  actions: BaseExecutableAction[];
  tokenAddress?: string | null;
}): EncodedMultisigSubmissionPlan {
  const warnings: string[] = [];

  const multisigAddress = normalizeAddress(params.multisigAddress);
  if (!multisigAddress) {
    throw new Error("Invalid multisig contract address.");
  }

  const tokenAddress = normalizeAddress(params.tokenAddress) ?? ethers.ZeroAddress;
  const iface = new ethers.Interface(MULTI_SIG_ABI);

  const submissions = params.actions.flatMap((action) => {
    const target = normalizeAddress(action.target);
    if (!target) {
      warnings.push(`Skipped action "${action.summary}" because target address is invalid.`);
      return [];
    }

    const value = normalizeUintString(action.value);

    const submitTransactionData = iface.encodeFunctionData("submitTransaction", [
      tokenAddress,
      target,
      value,
      action.data,
    ]);

    const submitAndConfirmData = iface.encodeFunctionData("submitAndConfirm", [
      tokenAddress,
      target,
      value,
      action.data,
    ]);

    return [
      {
        multisigAddress,
        tokenAddress,
        to: target,
        value,
        data: action.data,
        summary: action.summary,
        submitTransactionData,
        submitAndConfirmData,
      },
    ];
  });

  if (submissions.length === 0) {
    warnings.push("No executable actions available for multisig submission.");
  }

  return {
    multisigAddress,
    warnings,
    submissions,
  };
}