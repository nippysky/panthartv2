/* eslint-disable @typescript-eslint/no-explicit-any */
import { ethers } from "ethers";

export function parseIsoToMs(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toLocalYMDHM(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function addDaysLocalYmdhm(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setSeconds(0, 0);
  return toLocalYMDHM(d);
}

export function localYmdhmToUnix(local: string): number {
  if (!local) throw new Error("Invalid date/time");
  const t = new Date(local).getTime();
  if (!Number.isFinite(t)) throw new Error("Invalid date/time");
  return Math.floor(t / 1000);
}

export function errorMessage(e: unknown, fallback: string) {
  const maybe = e as { reason?: string; shortMessage?: string; message?: string };
  return maybe?.reason || maybe?.shortMessage || maybe?.message || fallback;
}

export function safeChecksum(addr?: string | null) {
  if (!addr) return null;
  try {
    return ethers.getAddress(addr);
  } catch {
    return addr;
  }
}

export function eqAddress(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  try {
    return ethers.getAddress(a) === ethers.getAddress(b);
  } catch {
    return a === b;
  }
}

export function formatCountdown(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs);
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hrs = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (days > 0) return `${days}d ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export async function confirmListingRow(params: {
  txHashCreated: string;
  contract: string;
  tokenId: string;
  account?: string | null;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch("/api/market/listing/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        txHashCreated: params.txHashCreated,
        contract: params.contract,
        tokenId: params.tokenId,
        account: params.account ?? undefined,
      }),
    });

    const json = (await res.json().catch(() => null)) as
      | {
          ok: boolean;
          listingId?: string;
          dbId?: string;
          status?: string;
          error?: string;
        }
      | null;

    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.error || "Confirm endpoint failed" };
    }

    return {
      ok: true,
      listingId: json.listingId,
      dbId: json.dbId,
      status: json.status,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.name === "AbortError" ? "Confirm timed out" : "Confirm failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
