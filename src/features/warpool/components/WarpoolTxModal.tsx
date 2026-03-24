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
    <div className="fixed inset-0 z-120">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />

      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 sm:left-1/2 sm:top-1/2 sm:w-[92vw] sm:max-w-md sm:-translate-x-1/2">
        <div className="max-h-[85vh] overflow-hidden rounded-4xl border border-border bg-card shadow-[0_30px_120px_rgba(0,0,0,0.30)]">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                Warpool transaction
              </p>
              <h3 className="mt-2 wrap-break-word text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h3>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/75 disabled:opacity-40"
            >
              Close
            </button>
          </div>

          <div className="max-h-[calc(85vh-96px)] overflow-y-auto px-5 py-5 sm:px-6">
            <div className="rounded-3xl border border-border bg-background/80 p-4">
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-1 h-3 w-3 shrink-0 rounded-full",
                    busy ? "animate-pulse bg-accent" : "bg-emerald-400",
                  ].join(" ")}
                />
                <div className="min-w-0 text-sm leading-6 text-foreground/80 wrap-break-word whitespace-pre-wrap">
                  {status}
                </div>
              </div>

              {txHash ? (
                <div className="mt-4 rounded-[18px] border border-border bg-card px-3 py-3 text-xs leading-6 text-foreground/55 break-all whitespace-pre-wrap">
                  {txHash}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}