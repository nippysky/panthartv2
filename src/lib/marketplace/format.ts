import { ethers } from "ethers";

export function parseAmountToUnits(amount: string, decimals: number) {
  // amount like "1.25"
  const clean = (amount || "").trim();
  if (!clean) throw new Error("Amount required");
  return ethers.parseUnits(clean, decimals); // bigint
}

export function localYmdhmToUnixSeconds(local: string) {
  // expects "YYYY-MM-DDTHH:mm" (no timezone suffix) from your DateTimePicker
  if (!local) return 0;
  const d = new Date(local);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) throw new Error("Invalid date/time");
  return Math.floor(ms / 1000);
}
