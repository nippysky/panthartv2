"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Image from "next/image";
import { useUnifiedAccount } from "@/src/lib/useUnifiedAccount";

type CollectionHeaderLike = {
  contract: string;
  name: string;
  ownerAddress: string;

  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;

  website?: string | null;
  instagram?: string | null;
  x?: string | null;
  telegram?: string | null;
  discord?: string | null;
};

const MAX_FILE_BYTES = 3 * 1024 * 1024;

function normalizeUrl(u?: string | null) {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function useMiniToast() {
  const [t, setT] = React.useState<{ show: boolean; msg: string }>({
    show: false,
    msg: "",
  });
  const timer = React.useRef<number | null>(null);

  const show = React.useCallback((msg: string) => {
    setT({ show: true, msg });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => setT((p) => ({ ...p, show: false })),
      1800
    );
  }, []);

  React.useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const Toast = (
    <div
      className={cx(
        "pointer-events-none fixed left-1/2 bottom-6 -translate-x-1/2 transition duration-200",
        t.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
      style={{ zIndex: 9999 }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        {t.msg}
      </div>
    </div>
  );

  return { show, Toast };
}

function validateFile(file: File): string | null {
  if (!file.type?.startsWith("image/"))
    return "Please choose an image file (JPG/PNG/GIF/WebP).";
  if (file.size > MAX_FILE_BYTES)
    return "Image is larger than 3MB. Please upload up to 3MB.";
  return null;
}

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/upload-image", { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success || !json?.data?.secure_url) {
    throw new Error(json?.error || "Upload failed");
  }
  return json.data.secure_url as string;
}

/** Small helper: lock body scroll while sheet is open */
function useBodyScrollLock(locked: boolean) {
  React.useEffect(() => {
    if (!locked) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // Prevent layout shift when scrollbar disappears (desktop)
    const scrollbarW =
      window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarW > 0) {
      document.body.style.paddingRight = `${scrollbarW}px`;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [locked]);
}

function RightSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useBodyScrollLock(open);

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
    <div className="fixed inset-0" style={{ zIndex: 240 }}>
      {/* Backdrop (click to close) */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cx(
          "absolute right-0 top-0 h-full w-[92vw] max-w-140",
          "border-l border-border bg-card shadow-2xl",
          "rounded-l-3xl overflow-hidden",
          "translate-x-0 animate-[sheetIn_180ms_ease-out]"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs text-muted-foreground">
                {subtitle}
              </div>
            ) : null}
          </div>

          <button
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-semibold hover:bg-card"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-64px-76px)] overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-card/90 px-6 py-5 backdrop-blur">
          {footer}
        </div>
      </div>

      {/* Keyframes (Tailwind arbitrary animation uses this name) */}
      <style jsx>{`
        @keyframes sheetIn {
          from {
            transform: translateX(24px);
            opacity: 0.8;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default function EditCollectionSheet({
  collection,
}: {
  collection: CollectionHeaderLike;
}) {
  const acct = useUnifiedAccount();
  const { show, Toast } = useMiniToast();

  const my = (acct.address || "").toLowerCase();
  const owner = (collection.ownerAddress || "").toLowerCase();
  const isOwner = !!my && !!owner && my === owner;

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);

  const [coverUrl, setCoverUrl] = React.useState<string | null>(
    collection.coverUrl || null
  );
  const [logoUrl, setLogoUrl] = React.useState<string | null>(
    collection.logoUrl || null
  );

  const [description, setDescription] = React.useState(collection.description || "");
  const [website, setWebsite] = React.useState(collection.website || "");
  const [instagram, setInstagram] = React.useState(collection.instagram || "");
  const [x, setX] = React.useState(collection.x || "");
  const [telegram, setTelegram] = React.useState(collection.telegram || "");
  const [discord, setDiscord] = React.useState(collection.discord || "");

  // Reset fields each time we open (so the sheet always mirrors latest header)
  React.useEffect(() => {
    if (!open) return;
    setErr(null);
    setSaving(false);
    setUploadingCover(false);
    setUploadingLogo(false);

    setCoverUrl(collection.coverUrl || null);
    setLogoUrl(collection.logoUrl || null);
    setDescription(collection.description || "");
    setWebsite(collection.website || "");
    setInstagram(collection.instagram || "");
    setX(collection.x || "");
    setTelegram(collection.telegram || "");
    setDiscord(collection.discord || "");
  }, [open, collection]);

  const somethingChanged =
    (coverUrl || "") !== (collection.coverUrl || "") ||
    (logoUrl || "") !== (collection.logoUrl || "") ||
    description !== (collection.description || "") ||
    website !== (collection.website || "") ||
    instagram !== (collection.instagram || "") ||
    x !== (collection.x || "") ||
    telegram !== (collection.telegram || "") ||
    discord !== (collection.discord || "");

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f) return;

    const v = validateFile(f);
    if (v) {
      setErr(v);
      try {
        input.value = "";
      } catch {}
      return;
    }

    setErr(null);
    setUploadingCover(true);
    try {
      const url = await uploadImage(f);
      setCoverUrl(url);
      show("Cover updated");
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploadingCover(false);
      try {
        input.value = "";
      } catch {}
    }
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f) return;

    const v = validateFile(f);
    if (v) {
      setErr(v);
      try {
        input.value = "";
      } catch {}
      return;
    }

    setErr(null);
    setUploadingLogo(true);
    try {
      const url = await uploadImage(f);
      setLogoUrl(url);
      show("Logo updated");
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploadingLogo(false);
      try {
        input.value = "";
      } catch {}
    }
  }

  async function save() {
    setErr(null);

    if (!isOwner) {
      setErr("Only the collection owner can update details.");
      return;
    }
    if (!acct.address) {
      setErr("Connect your wallet first.");
      return;
    }

    const body = {
      description: description.trim(),
      website: normalizeUrl(website),
      instagram: normalizeUrl(instagram),
      x: normalizeUrl(x),
      telegram: normalizeUrl(telegram),
      discord: normalizeUrl(discord),
      logoUrl,
      coverUrl,
    };

    setSaving(true);
    try {
      const res = await fetch(
        `/api/collections/${encodeURIComponent(collection.contract)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-owner-wallet": acct.address,
          },
          body: JSON.stringify(body),
        }
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save changes");

      show("Saved");
      setOpen(false);

      // refresh server header instantly
      window.location.reload();
    } catch (e: any) {
      setErr(e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        disabled={!isOwner}
        onClick={() => setOpen(true)}
        className={cx(
          "inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground",
          "hover:bg-background/60 active:scale-[0.99]",
          !isOwner && "opacity-50 cursor-not-allowed"
        )}
      >
        Edit details
      </button>

      <RightSheet
        open={open}
        title="Edit Collection Details"
        subtitle="Update images, description and social links."
        onClose={() => setOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              disabled={saving}
              onClick={() => setOpen(false)}
              className="h-10 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-card disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              disabled={!somethingChanged || saving}
              onClick={save}
              className={cx(
                "h-10 rounded-full px-5 text-sm font-semibold",
                "bg-foreground text-background hover:opacity-95 active:opacity-90",
                (!somethingChanged || saving) && "opacity-50 cursor-not-allowed"
              )}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        {err ? (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {err}
          </div>
        ) : null}

        <div className="space-y-6">
          {/* Cover */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">
              Cover Photo
            </div>
            <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-border bg-background">
              {coverUrl ? (
                <Image src={coverUrl} alt="Cover" fill className="object-cover" />
              ) : null}
              <div className="absolute inset-0 grid place-items-center bg-black/25 text-white text-xs font-semibold">
                {uploadingCover ? "Uploading…" : "Click to upload / replace"}
              </div>
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                onChange={onCoverChange}
                disabled={saving || uploadingCover}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              Recommended ~1600×400. Max 3MB.
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Logo</div>
            <div className="flex items-center gap-4">
              <div className="relative h-22 w-22 overflow-hidden rounded-2xl border border-border bg-background">
                {logoUrl ? (
                  <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                ) : null}
                <div className="absolute inset-0 grid place-items-center bg-black/25 text-white text-[11px] font-semibold px-2 text-center">
                  {uploadingLogo ? "Uploading…" : "Click to replace"}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                  onChange={onLogoChange}
                  disabled={saving || uploadingLogo}
                />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Recommended ≥ 400×400. Max 3MB.
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">
              Description
            </div>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              placeholder="Tell collectors what makes this collection special…"
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
            />
          </div>

          {/* Socials */}
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: "Website", v: website, set: setWebsite, ph: "https://yourdomain.com" },
              { label: "X", v: x, set: setX, ph: "https://x.com/username" },
              { label: "Instagram", v: instagram, set: setInstagram, ph: "https://instagram.com/username" },
              { label: "Telegram", v: telegram, set: setTelegram, ph: "https://t.me/username" },
              { label: "Discord", v: discord, set: setDiscord, ph: "https://discord.gg/invite" },
            ].map((f) => (
              <div key={f.label} className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">
                  {f.label}
                </div>
                <input
                  value={f.v}
                  onChange={(e) => f.set(e.target.value)}
                  disabled={saving}
                  placeholder={f.ph}
                  className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
                />
              </div>
            ))}
          </div>
        </div>
      </RightSheet>

      {Toast}
    </>
  );
}
