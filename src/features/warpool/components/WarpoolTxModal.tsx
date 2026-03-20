"use client";

type Props = {
  open: boolean;
  title: string;
  status: string;
  txHash?: string | null;
  onClose: () => void;
  busy?: boolean;
};

export default function WarpoolTxModal({
  open,
  title,
  status,
  txHash,
  onClose,
  busy = false,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[32px] border border-border bg-card p-6 shadow-[0_30px_120px_rgba(0,0,0,0.30)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
              Warpool transaction
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              {title}
            </h3>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/75 disabled:opacity-40"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-[24px] border border-border bg-background/80 p-4">
          <div className="flex items-center gap-3">
            <div
              className={[
                "h-3 w-3 rounded-full",
                busy ? "animate-pulse bg-accent" : "bg-emerald-400",
              ].join(" ")}
            />
            <div className="text-sm text-foreground/80">{status}</div>
          </div>

          {txHash ? (
            <div className="mt-4 rounded-[18px] border border-border bg-card px-3 py-2 text-xs text-foreground/55 break-all">
              {txHash}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}