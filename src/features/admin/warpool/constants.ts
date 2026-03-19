// src/features/admin/warpool/constants.ts

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
  return new Intl.NumberFormat("en-US").format(Number(value));
}

export function formatTokenAmount(value: string | number | bigint | null | undefined) {
  if (value === null || value === undefined) return "—";

  const raw = typeof value === "string" ? value : String(value);

  if (!/^\d+$/.test(raw)) return raw;

  const rawBigInt = BigInt(raw);
  const decimals = BigInt(18);
  const divisor = BigInt(10) ** decimals;

  const whole = rawBigInt / divisor;
  const fraction = rawBigInt % divisor;

  if (fraction === BigInt(0)) {
    return `${new Intl.NumberFormat("en-US").format(Number(whole))} DCNT`;
  }

  const fractionStr = fraction
    .toString()
    .padStart(Number(decimals), "0")
    .slice(0, 4)
    .replace(/0+$/, "");

  return `${new Intl.NumberFormat("en-US").format(Number(whole))}${
    fractionStr ? `.${fractionStr}` : ""
  } DCNT`;
}

export function formatDurationSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function parseTokenDecimalToRaw(value: string, decimals = 18): string {
  const trimmed = value.trim();
  if (!trimmed) return "0";
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return "0";

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const paddedFraction = `${fractionPart}${"0".repeat(decimals)}`.slice(0, decimals);
  const normalized = `${wholePart}${paddedFraction}`.replace(/^0+/, "") || "0";
  return normalized;
}