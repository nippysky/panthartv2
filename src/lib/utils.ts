/* eslint-disable @typescript-eslint/no-explicit-any */

// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  value: number | null | undefined,
  { min = 0, max = 2, locale = undefined }: { min?: number; max?: number; locale?: string } = {}
): string {
  if (value == null || !Number.isFinite(value)) return "0";
  const abs = Math.abs(value);

  const nf = new Intl.NumberFormat(locale, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });

  if (abs >= 1_000_000_000) return nf.format(value / 1_000_000_000) + "B";
  if (abs >= 1_000_000) return nf.format(value / 1_000_000) + "M";
  if (abs >= 1_000) return nf.format(value / 1_000) + "k";
  return nf.format(value);
}

export function shortenAddress(address: string, startLength = 4, endLength = 4): string {
  if (!address) return "";

  if (address.length <= startLength + endLength) {
    return address;
  }

  const start = address.slice(0, startLength);
  const end = address.slice(-endLength);

  return `${start}...${end}`;
}

/** Expand a numeric string in scientific notation to a plain integer string. */
export function expandENotation(s: string): string {
  s = s.trim().toLowerCase();
  if (!s.includes("e")) return s;

  const m = /^([0-9]+)(?:\.([0-9]+))?e([+-]?[0-9]+)$/.exec(s);
  if (!m) throw new Error(`Cannot expand e-notation: ${s}`);

  const [, intPart, fracPartRaw = "", expRaw] = m;
  const exp = parseInt(expRaw, 10);
  const digits = intPart + fracPartRaw;
  const fracLen = fracPartRaw.length;

  if (exp >= 0) {
    const zeros = exp - fracLen;
    if (zeros >= 0) return digits + "0".repeat(zeros);
    const split = digits.length + zeros;
    const whole = digits.slice(0, split);
    return whole || "0";
  } else {
    const shift = -exp;
    if (shift >= intPart.length + fracLen) return "0";
    const split = intPart.length - shift;
    const whole = intPart.slice(0, split) + intPart.slice(split) + fracPartRaw;
    return whole.replace(/^0+/, "") || "0";
  }
}

/** Convert input to bigint without ever using the float path. */
export function toBigIntSafe(value: unknown): bigint {
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid number");
    return BigInt(expandENotation(String(value)));
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (/^[0-9]+$/.test(s)) return BigInt(s);
    if (/^[0-9]+(\.[0-9]+)?e[+-]?[0-9]+$/i.test(s)) return BigInt(expandENotation(s));
    if (/^0x[0-9a-f]+$/i.test(s)) return BigInt(s);
    throw new Error(`Cannot convert string to bigint: "${value}"`);
  }

  if (value && typeof value === "object" && "hex" in (value as any)) {
    return BigInt((value as any).hex);
  }

  throw new Error(`Unsupported bigint input: ${String(value)}`);
}

/** Format ETN from wei (18 decimals) precisely; returns a human string. */
export function formatEtnFromWei(
  amount: bigint | string | number,
  decimals = 18,
  maxFractionDigits = 4
): string {
  const wei = toBigIntSafe(amount);
  const neg = wei < BigInt(0);
  const abs = neg ? -wei : wei;

  const base = BigInt(10) ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;

  if (frac === BigInt(0)) return (neg ? "-" : "") + whole.toString();

  let fracStr = frac.toString().padStart(decimals, "0");
  if (maxFractionDigits < decimals) fracStr = fracStr.slice(0, maxFractionDigits);
  fracStr = fracStr.replace(/0+$/, "");

  return (neg ? "-" : "") + whole.toString() + (fracStr ? "." + fracStr : "");
}