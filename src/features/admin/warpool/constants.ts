// src/features/admin/warpool/constants.ts

import { ethers } from "ethers";

export const WARPOOL_QUEUE_META = {
  FORGE_SAFEGUARD: {
    title: "Forge Safeguard",
    description: "Entry-level protected queue with safe fighter return flow.",
    badge: "Forge",
  },
  LEGION_SAFEGUARD: {
    title: "Legion Safeguard",
    description: "Mid-tier protected queue for larger brackets.",
    badge: "Legion",
  },
  LEGION_VAULTBOUND: {
    title: "Legion Vaultbound",
    description: "Mid-tier capture-enabled queue with stronger stakes.",
    badge: "Legion",
  },
  CROWN_VAULTBOUND: {
    title: "Crown Vaultbound",
    description: "Highest tier queue with relic mechanics and capture flow.",
    badge: "Crown",
  },
} as const;

export const WARPOOL_QUEUE_ORDER = [
  "FORGE_SAFEGUARD",
  "LEGION_SAFEGUARD",
  "LEGION_VAULTBOUND",
  "CROWN_VAULTBOUND",
] as const;

function scientificIntegerToPlain(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!/^\d+e\+\d+$/.test(trimmed)) return null;

  const [base, exponentRaw] = trimmed.split("e+");
  const exponent = Number(exponentRaw);

  if (!Number.isFinite(exponent) || exponent < 0) return null;
  return `${base}${"0".repeat(exponent)}`;
}

function normalizeIntegerString(value: string | number | bigint) {
  const raw = String(value).trim();
  if (!raw) return null;

  const scientificPlain = scientificIntegerToPlain(raw);
  const normalized = scientificPlain ?? raw;

  if (!/^\d+$/.test(normalized)) return null;
  return normalized;
}

function addThousandsSeparators(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatBps(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatBool(value: boolean) {
  return value ? "Enabled" : "Disabled";
}

export function shortenAddress(address: string | null | undefined) {
  if (!address) return "—";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatInteger(value: number | string | bigint | null | undefined) {
  if (value === null || value === undefined) return "—";

  const normalized = normalizeIntegerString(value);
  if (!normalized) return String(value);

  return addThousandsSeparators(normalized);
}

export function formatTokenAmount(
  value: string | number | bigint | null | undefined,
  decimals = 18,
  symbol = "DCNT"
) {
  if (value === null || value === undefined) return "—";

  const normalized = normalizeIntegerString(value);
  if (!normalized) return String(value);

  try {
    const decimal = ethers.formatUnits(normalized, decimals);
    const [wholeRaw, fractionRaw = ""] = decimal.split(".");
    const whole = addThousandsSeparators(wholeRaw);
    const fraction = fractionRaw.slice(0, 4).replace(/0+$/, "");

    return `${whole}${fraction ? `.${fraction}` : ""} ${symbol}`;
  } catch {
    return String(value);
  }
}

export function formatDurationSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function parseTokenDecimalToRaw(value: string, decimals = 18): string {
  const trimmed = value.trim().replace(/,/g, "");

  if (!trimmed) return "0";
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return "0";

  try {
    return ethers.parseUnits(trimmed, decimals).toString();
  } catch {
    return "0";
  }
}