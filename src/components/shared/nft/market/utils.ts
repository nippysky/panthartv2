/* eslint-disable @typescript-eslint/no-explicit-any */
import { ethers } from "ethers";

/* ------------------------------------------------------------------ */
/* Dates / Time                                                        */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Errors / Address helpers                                             */
/* ------------------------------------------------------------------ */
export function errorMessage(e: unknown, fallback: string) {
  const maybe = e as {
    reason?: string;
    shortMessage?: string;
    message?: string;
    error?: { reason?: string; message?: string; data?: { message?: string } };
    info?: { error?: { message?: string } };
    data?: { message?: string };
  };

  const candidates = [
    maybe?.reason,
    maybe?.shortMessage,
    maybe?.error?.reason,
    maybe?.error?.data?.message,
    maybe?.error?.message,
    maybe?.info?.error?.message,
    maybe?.data?.message,
    maybe?.message,
  ]
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);

  const msg = candidates[0] || fallback;

  if (/missing revert data/i.test(msg)) {
    return "Transaction reverted on-chain. The listing may already be inactive, expired, sold, paused, or no longer match the expected price. Please refresh and try again.";
  }

  return msg;
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

/* ------------------------------------------------------------------ */
/* Countdown                                                            */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Post-tx DB confirmation helpers                                      */
/* ------------------------------------------------------------------ */

type ConfirmOk = {
  ok: true;
  listingId?: string;
  auctionId?: string;
  dbId?: string;
  status?: string;
};

type ConfirmFail = { ok: false; error: string };

async function postJson<T>(url: string, body: any, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => null)) as T | null;
    // If server didn't return JSON, still throw a useful error
    if (!res.ok || !json) {
      const anyJson = json as any;
      const msg =
        anyJson?.error ||
        anyJson?.message ||
        `Confirm endpoint failed (${res.status})`;
      throw new Error(msg);
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Confirm listing row in DB by txHashCreated (decodes ListingCreated from receipt).
 * Safe to call and ignore failures (UI will still work via normal polling/refresh).
 */
export async function confirmListingRow(params: {
  txHashCreated: string;
  contract: string;
  tokenId: string;
  account?: string | null;
}): Promise<ConfirmOk | ConfirmFail> {
  try {
    const json = await postJson<
      | {
          ok: boolean;
          listingId?: string;
          dbId?: string;
          status?: string;
          error?: string;
        }
      | null
    >(
      "/api/market/listing/confirm",
      {
        txHashCreated: params.txHashCreated,
        contract: params.contract,
        tokenId: params.tokenId,
        account: params.account ?? undefined,
      },
      12_000
    );

    if (!json || !json.ok) {
      return { ok: false, error: (json as any)?.error || "Confirm endpoint failed" };
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
  }
}

/**
 * Confirm auction row in DB by txHashCreated (decodes AuctionCreated from receipt).
 * Safe to call and ignore failures (UI will still work via normal polling/refresh).
 */
export async function confirmAuctionRow(params: {
  txHashCreated: string;
  contract: string;
  tokenId: string;
  account?: string | null;
}): Promise<ConfirmOk | ConfirmFail> {
  try {
    const json = await postJson<
      | {
          ok: boolean;
          auctionId?: string;
          dbId?: string;
          status?: string;
          error?: string;
        }
      | null
    >(
      "/api/market/auction/confirm",
      {
        txHashCreated: params.txHashCreated,
        contract: params.contract,
        tokenId: params.tokenId,
        account: params.account ?? undefined,
      },
      12_000
    );

    if (!json || !json.ok) {
      return { ok: false, error: (json as any)?.error || "Confirm endpoint failed" };
    }

    return {
      ok: true,
      auctionId: json.auctionId,
      dbId: json.dbId,
      status: json.status,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.name === "AbortError" ? "Confirm timed out" : "Confirm failed",
    };
  }
}
