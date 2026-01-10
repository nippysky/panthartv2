// src/lib/format.ts
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);

  const fmt = (value: number, suffix: string) => {
    const v = value;
    const digits =
      v >= 100 ? 0 :
      v >= 10 ? 1 :
      2;
    const out = v.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, "$1");
    return `${out}${suffix}`;
  };

  if (abs < 1000) return String(Math.round(n * 100) / 100).replace(/\.0+$|(\.\d*[1-9])0+$/, "$1");
  if (abs < 1_000_000) return fmt(n / 1_000, "k");
  if (abs < 1_000_000_000) return fmt(n / 1_000_000, "M");
  if (abs < 1_000_000_000_000) return fmt(n / 1_000_000_000, "B");
  return fmt(n / 1_000_000_000_000, "T");
}

export function formatCompactAmount(n: number, symbol: string) {
  return `${formatCompact(n)} ${symbol}`;
}
