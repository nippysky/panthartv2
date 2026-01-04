// src/ui/WalletPill.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import ConnectWallet from "@/src/ui/connectWallet";
import { useDecentWalletAccount } from "@/src/lib/decentWallet";

function shorten(addr: string) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ zIndex: 100}} className="fixed inset-0">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-card shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function ToastPortal({
  show,
  message,
}: {
  show: boolean;
  message: string;
}) {
  const [portalReady, setPortalReady] = React.useState(false);

  React.useEffect(() => setPortalReady(true), []);
  if (!portalReady) return null;

  return createPortal(
    <div
    style={{ zIndex: 9999 }}
      className={[
        "pointer-events-none fixed left-1/2 bottom-6",
        "-translate-x-1/2 transition duration-200",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      ].join(" ")}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="
          rounded-full border border-border bg-card
          px-4 py-2 text-xs font-semibold text-foreground
          shadow-[0_18px_60px_rgba(0,0,0,0.22)]
        "
      >
        {message}
      </div>
    </div>,
    document.body
  );
}

export function WalletPill() {
  const dw = useDecentWalletAccount();

  // ✅ Hydration guard hooks (must be declared unconditionally)
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Toast hooks (also unconditional)
  const [toast, setToast] = React.useState<{ show: boolean; msg: string }>({
    show: false,
    msg: "",
  });
  const toastTimer = React.useRef<number | null>(null);

  const showToast = React.useCallback((msg: string) => {
    setToast({ show: true, msg });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, 1800);
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Modal state (unconditional)
  const [open, setOpen] = React.useState(false);

  // ✅ On SSR/first paint render a stable placeholder (prevents Thirdweb hydration mismatch)
  if (!mounted) {
    return (
      <>
        <div className="h-10 w-41.25 rounded-full border border-border bg-card/70" />
        <ToastPortal show={toast.show} message={toast.msg} />
      </>
    );
  }

  // ✅ If NOT inside Decent Wallet, render Thirdweb’s connect UI (client-only now)
  if (!dw.isDecentWallet) {
    return (
      <>
        <ConnectWallet />
        <ToastPortal show={toast.show} message={toast.msg} />
      </>
    );
  }

  // ✅ Inside Decent Wallet
  if (!dw.ready) {
    return (
      <>
        <div className="h-10 w-27.5 animate-pulse rounded-full border border-border bg-card" />
        <ToastPortal show={toast.show} message={toast.msg} />
      </>
    );
  }

  if (!dw.isConnected || !dw.address) {
    return (
      <>
        <button
          onClick={() => dw.connect()}
          className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-black hover:opacity-95 active:opacity-90"
        >
          Connect
        </button>
        <ToastPortal show={toast.show} message={toast.msg} />
      </>
    );
  }

  const address = dw.address;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-background/60 active:scale-[0.99]"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
        <span className="tabular-nums">{shorten(address)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-80">
          <path fill="currentColor" d="M7 10l5 5l5-5z" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">Wallet</div>
              <div className="mt-1 text-xs text-muted">
                Connected via Decent Wallet (in-app browser)
              </div>
            </div>
            <button
              className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-card"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-background p-4">
            <div className="text-xs text-muted">Address</div>
            <div className="mt-1 break-all text-sm font-semibold">{address}</div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(address);
                  showToast(ok ? "Address copied" : "Copy failed");
                }}
                className="flex-1 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-background/60"
              >
                Copy address
              </button>

              <button
                onClick={async () => {
                  await dw.disconnect();
                  setOpen(false);
                  showToast("Disconnected");
                }}
                className="flex-1 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/15"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <ToastPortal show={toast.show} message={toast.msg} />
    </>
  );
}
