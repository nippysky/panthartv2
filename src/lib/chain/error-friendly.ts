/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/chain/error-friendly.ts
import { ethers } from "ethers";

type Ctx = {
  method?: string;
  abi?: any[];                 // pass your contract ABI for custom-error decoding
  fallback?: string;           // last-resort message
};

function extractData(err: any): string | null {
  const d =
    err?.data?.data ??
    err?.data?.originalError?.data ??
    err?.error?.data ??
    err?.info?.error?.data ??
    err?.data ??
    null;
  return typeof d === "string" && d.startsWith("0x") ? d : null;
}

// Map some standard error names to friendly messages
function mapKnownErrorName(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("erc721nonexistenttoken")) return "That token doesn’t exist.";
  if (n.includes("erc721incorrectowner")) return "You’re not the owner of that token.";
  if (n.includes("erc721invalidsender") || n.includes("erc721invalidowner"))
    return "Invalid sender/owner address for this action.";
  if (n.includes("ownableunauthorizedaccount")) return "Only the contract owner can do that.";
  // ERC2981 royalty errors are unlikely during mint, but translate anyway:
  if (n.includes("erc2981invalid")) return "Invalid royalty configuration on the contract.";
  return null;
}

function decodeWithABI(data: string, abi?: any[]): string | null {
  // Try Interface.parseError first
  if (abi) {
    try {
      const iface = new ethers.Interface(abi as any);
      const decoded = iface.parseError(data);
      if (decoded) {
        const args = Array.from(decoded.args ?? []).map(String).join(", ");
        const fullName = decoded.name ? `${decoded.name}${args ? `(${args})` : ""}` : "";
        // map to friendly if we recognize the error name
        const mapped = mapKnownErrorName(decoded.name);
        return (mapped ?? fullName) || null;
      }
    } catch {}
  }
  // Try Error(string) manually
  try {
    // 0x08c379a0 = Error(string)
    if (data.startsWith("0x08c379a0") && data.length > 10) {
      const reason = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10));
      if (reason && reason[0]) return String(reason[0]);
    }
  } catch {}
  // Try Panic(uint256)
  try {
    // 0x4e487b71 = Panic(uint256)
    if (data.startsWith("0x4e487b71") && data.length >= 74) {
      const code = BigInt("0x" + data.slice(10));
      // Basic mapping of common panics
      const friendly =
        code === BigInt(0x11) ? "Arithmetic overflow/underflow inside the contract." :
        code === BigInt(0x12) ? "Division or modulo by zero inside the contract." :
        code === BigInt(0x21) ? "Array out-of-bounds inside the contract." :
        null;
      return friendly ?? `Contract panicked (0x${code.toString(16)}).`;
    }
  } catch {}
  return null;
}

/** Turn gnarly provider/wallet errors into friendly copy. */
export function getFriendlyTxError(err: any, ctx: Ctx = {}): string {
  const msg = String(err?.message ?? err ?? "");
  const code = String(err?.code ?? "");

  // user cancelled
  if (code === "ACTION_REJECTED" || /user rejected|denied/i.test(msg)) {
    return "Transaction was cancelled in your wallet.";
  }

  // wrong chain
  if (/chain|network/i.test(msg) && /mismatch|wrong|different/i.test(msg)) {
    return "You’re on the wrong network. Switch to the required chain and try again.";
  }

  // insufficient funds / gas
  if (
    code === "INSUFFICIENT_FUNDS" ||
    /insufficient funds/i.test(msg) ||
    /underpriced|fee too low/i.test(msg)
  ) {
    return "Not enough balance to cover mint cost + gas.";
  }

  // ABI mismatch / method missing
  if (/method .* does not exist|is not a function|execution reverted without data/i.test(msg)) {
    return "The contract rejected the call. Refresh and try again.";
  }

  // contract reverted – try to decode reason
  if (/revert|execution reverted|missing revert data/i.test(msg) || /-3200\d|-32603/.test(code)) {
    const data = extractData(err);
    const decoded = data ? decodeWithABI(data, ctx.abi) : null;

    if (decoded) {
      // Generic humanization passes
      const lower = decoded.toLowerCase();
      if (/not active|not started|before start/i.test(lower)) return "Sale hasn’t started yet.";
      if (/ended|after end/i.test(lower)) return "This sale window has ended.";
      if (/sold out|exceeded supply|max supply|supply/i.test(lower)) return "Sold out.";
      if (/per wallet|perwallet|max per wallet|wallet limit/i.test(lower)) return "You’ve hit the per-wallet limit.";
      if (/per tx|pertx|max per tx|amount/i.test(lower)) return "You’re over the per-transaction limit.";
      if (/whitelist|merkle|proof/i.test(lower)) return "Your wallet isn’t on the presale list.";
      return decoded; // show decoded text if nothing matched
    }

    // nothing to decode – give a helpful generic
    return ctx.method === "presaleMint"
      ? "The transaction was rejected by the contract. Might be Insufficient Funds"
      : "The transaction was rejected by the contract. Might be Insufficient Funds";
  }

  // default
  return (
    ctx.fallback ||
    "The transaction failed. Check your network, balance, and limits, then try again."
  );
}
