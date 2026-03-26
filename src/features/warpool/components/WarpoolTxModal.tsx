"use client";

type Props = {
  open: boolean;
  title: string;
  status: string;
  txHash?: string | null;
  onClose: () => void;
  busy?: boolean;
};

function stageCopy(title: string, busy: boolean) {
  const normalized = title.toLowerCase();

  if (normalized.includes("relic")) {
    return busy ? "Relic energy surging…" : "Relic awakened";
  }

  if (normalized.includes("battlefield") || normalized.includes("enter")) {
    return busy ? "Deploying to battlefield…" : "You are in the arena";
  }

  if (normalized.includes("reserve")) {
    return busy ? "Securing your combat slot…" : "Slot secured";
  }

  return busy ? "Processing combat action…" : "Action complete";
}

export default function WarpoolTxModal({
  open,
  title,
  status,
  txHash,
  onClose,
  busy = false,
}: Props) {
  if (!open) return null;

  const eyebrow = stageCopy(title, busy);

  return (
    <div className="fixed inset-0 z-120">
      {/* overlay */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={busy ? undefined : onClose}
      />

      {/* modal */}
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 sm:left-1/2 sm:w-[92vw] sm:max-w-md sm:-translate-x-1/2">
        <div className="rounded-4xl border border-border bg-card shadow-[0_40px_140px_rgba(0,0,0,0.35)]">

          {/* header */}
          <div className="border-b border-border px-6 py-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/40">
              {eyebrow}
            </p>

            <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h3>
          </div>

          {/* body */}
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={[
                  "mt-1 h-3 w-3 rounded-full",
                  busy
                    ? "animate-pulse bg-accent"
                    : "bg-emerald-400",
                ].join(" ")}
              />

              <div className="text-sm leading-6 text-foreground/85 whitespace-pre-wrap">
                {status}
              </div>
            </div>

            {/* tx hash */}
            {txHash && (
              <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/40">
                  Battle trace
                </p>

                <p className="mt-2 break-all text-xs text-foreground/60">
                  {txHash}
                </p>
              </div>
            )}
          </div>

          {/* footer */}
          <div className="px-6 pb-6">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="w-full rounded-xl border border-border bg-background py-2.5 text-sm text-foreground/80 transition hover:bg-foreground/5 disabled:opacity-40"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}