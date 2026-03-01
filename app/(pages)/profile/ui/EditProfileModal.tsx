"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProfileEditable = {
  username: string;
  bio?: string | null;

  website?: string | null;
  x?: string | null;
  instagram?: string | null;
  telegram?: string | null;

  profileAvatar?: string | null;
  profileBanner?: string | null;
};

type PatchResp = {
  success?: boolean;
  error?: string;
};

type UploadResp = {
  success?: boolean;
  error?: string;
  data?: {
    secure_url?: string;
  };
};

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3MB

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function trimOrNull(v: string): string | null {
  const s = v.trim();
  return s ? s : null;
}

function normalizeWebsite(raw: string): string | null {
  const val = raw.trim();
  if (!val) return null;
  if (/^https?:\/\//i.test(val)) return val;
  return `https://${val}`;
}

function validateImage(file: File): string | null {
  if (!file.type?.startsWith("image/")) return "Please choose an image file (including GIF).";
  if (file.size > MAX_FILE_BYTES) return "Image is larger than 3MB. Please upload up to 3MB.";
  return null;
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows,
  inputRef,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>

      {rows ? (
        <textarea
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-2 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
        />
      ) : (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
        />
      )}

      {hint ? <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div> : null}
    </label>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-foreground/15 border-t-foreground" />
  );
}

export default function EditProfileModal({
  profileAddress,
  viewerAddress,
  initial,
}: {
  profileAddress: string;
  viewerAddress: string;
  initial: ProfileEditable;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [err, setErr] = useState<string>("");

  const firstRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [draft, setDraft] = useState(() => ({
    username: initial.username ?? "",
    bio: initial.bio ?? "",

    website: initial.website ?? "",
    x: initial.x ?? "",
    instagram: initial.instagram ?? "",
    telegram: initial.telegram ?? "",

    profileAvatar: initial.profileAvatar ?? "",
    profileBanner: initial.profileBanner ?? "",
  }));

  function openModal() {
    setErr("");
    setSaving(false);
    setOpen(true);
    window.setTimeout(() => firstRef.current?.focus(), 60);
  }

  function closeModal() {
    setOpen(false);
  }

  // Lock body scroll while open (no setState here)
  useEffect(() => {
    if (!open) return;

    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  // Escape closes (no setState in effect body; only in callback)
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function uploadImage(file: File): Promise<string> {
    const v = validateImage(file);
    if (v) throw new Error(v);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/upload-image", { method: "POST", body: form });
    const raw = (await res.json().catch(() => null)) as unknown;

    const parsed: UploadResp = isObj(raw)
      ? {
          success: typeof raw.success === "boolean" ? raw.success : undefined,
          error: asString(raw.error) ?? undefined,
          data: isObj(raw.data) ? { secure_url: asString(raw.data.secure_url) ?? undefined } : undefined,
        }
      : {};

    if (!res.ok || !parsed.success || !parsed.data?.secure_url) {
      throw new Error(parsed.error || "Upload failed");
    }

    return parsed.data.secure_url;
  }

  async function onPickBanner(file: File) {
    setErr("");
    setUploadingBanner(true);
    try {
      const url = await uploadImage(file);
      setDraft((d) => ({ ...d, profileBanner: url }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setErr(msg);
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  }

  async function onPickAvatar(file: File) {
    setErr("");
    setUploadingAvatar(true);
    try {
      const url = await uploadImage(file);
      setDraft((d) => ({ ...d, profileAvatar: url }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setErr(msg);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  const changedPayload = useMemo(() => {
    const p: Record<string, string | null> = {};

    const setIfChanged = (
      key: string,
      nextRaw: string,
      prev: string | null | undefined,
      opts?: { allowNull?: boolean; maxLen?: number; normalize?: (v: string) => string | null }
    ) => {
      const allowNull = opts?.allowNull ?? true;
      const maxLen = opts?.maxLen;

      const normalized = opts?.normalize ? opts.normalize(nextRaw) : trimOrNull(maxLen ? nextRaw.slice(0, maxLen) : nextRaw);
      const prevNorm = prev != null ? String(prev).trim() : null;

      if (!allowNull && !normalized) return;

      if ((normalized ?? null) !== (prevNorm ?? null)) p[key] = normalized;
    };

    setIfChanged("username", draft.username, initial.username, { allowNull: false, maxLen: 40 });
    setIfChanged("bio", draft.bio, initial.bio, { allowNull: true });

    setIfChanged("website", draft.website, initial.website, { allowNull: true, normalize: (v) => normalizeWebsite(v) });
    setIfChanged("x", draft.x, initial.x, { allowNull: true });
    setIfChanged("instagram", draft.instagram, initial.instagram, { allowNull: true });
    setIfChanged("telegram", draft.telegram, initial.telegram, { allowNull: true });

    setIfChanged("profileAvatar", draft.profileAvatar, initial.profileAvatar, { allowNull: true });
    setIfChanged("profileBanner", draft.profileBanner, initial.profileBanner, { allowNull: true });

    return p;
  }, [draft, initial]);

  async function onSave() {
    setErr("");

    const username = trimOrNull(draft.username) ?? "";
    if (!username) {
      setErr("Username is required.");
      return;
    }

    if (uploadingBanner || uploadingAvatar) {
      setErr("Please wait for the upload to finish.");
      return;
    }

    if (Object.keys(changedPayload).length === 0) {
      closeModal();
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(profileAddress)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-owner-wallet": viewerAddress,
        },
        body: JSON.stringify(changedPayload),
        cache: "no-store",
      });

      const raw = (await res.json().catch(() => null)) as unknown;

      const parsed: PatchResp = isObj(raw)
        ? {
            success: typeof raw.success === "boolean" ? raw.success : undefined,
            error: asString(raw.error) ?? undefined,
          }
        : {};

      if (!res.ok) {
        setErr(parsed.error || "Failed to update profile");
        setSaving(false);
        return;
      }

      window.location.reload();
    } catch {
      setErr("Network error. Try again.");
      setSaving(false);
    }
  }

  const banner = trimOrNull(draft.profileBanner) ?? null;
  const avatar = trimOrNull(draft.profileAvatar) ?? null;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center rounded-full border border-border bg-background/70 px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
      >
        Edit profile
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-9999 isolate" role="dialog" aria-modal="true" aria-label="Edit profile">
              {/* Backdrop */}
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/55"
                onClick={closeModal}
              />

              {/* Layout: bottom-sheet on mobile, centered on desktop */}
              <div className="relative z-10000 flex min-h-full w-full items-end justify-center p-0 sm:items-center sm:p-6">
                <div
                  className={[
                    "w-full max-w-2xl overflow-hidden border border-border bg-card/92 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl",
                    "rounded-t-[28px] sm:rounded-[28px]",
                    "max-h-[calc(100vh-0.5rem)] sm:max-h-[calc(100vh-3rem)]",
                    "flex flex-col",
                  ].join(" ")}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                    <div className="text-base font-semibold">Edit profile</div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full border border-border bg-background/70 px-3 py-2 text-sm hover:bg-background"
                    >
                      Close
                    </button>
                  </div>

                  {/* Scroll body */}
                  <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    <div className="space-y-8">
                      {/* Banner Upload */}
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">Cover photo</div>

                        <div className="mt-2 relative h-36 w-full overflow-hidden rounded-2xl border border-border bg-muted">
                          {banner ? (
                            <Image
                              src={banner}
                              alt="Cover"
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 800px"
                              priority={false}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(77,238,84,0.12),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)]" />
                          )}

                          <div className="absolute inset-0 bg-black/35" />

                          <div className="absolute inset-0 flex items-center justify-center text-center px-4">
                            <div className="rounded-full border border-white/15 bg-black/25 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                              {uploadingBanner ? (
                                <span className="inline-flex items-center gap-2">
                                  <Spinner /> Uploading…
                                </span>
                              ) : banner ? (
                                "Click to replace cover photo"
                              ) : (
                                "Click to upload cover photo"
                              )}
                            </div>
                          </div>

                          <input
                            ref={bannerInputRef}
                            type="file"
                            accept="image/*"
                            disabled={saving || uploadingBanner || uploadingAvatar}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void onPickBanner(file);
                            }}
                          />
                        </div>

                        <div className="mt-2 text-[11px] text-muted-foreground">
                          Accepts JPG/PNG/GIF and other image types. <span className="font-semibold">Max 3MB.</span>
                        </div>
                      </div>

                      {/* Avatar Upload */}
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">Profile photo</div>

                        <div className="mt-3 flex items-center gap-4">
                          <div className="relative h-22 w-22 overflow-hidden rounded-2xl border border-border bg-muted sm:h-24 sm:w-24">
                            {avatar ? (
                              <Image
                                src={avatar}
                                alt="Avatar"
                                fill
                                className="object-cover"
                                sizes="96px"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(77,238,84,0.10),transparent_55%)]" />
                            )}

                            <div className="absolute inset-0 bg-black/30" />

                            <div className="absolute inset-0 flex items-center justify-center px-2 text-center">
                              <div className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur">
                                {uploadingAvatar ? (
                                  <span className="inline-flex items-center gap-2">
                                    <Spinner /> Uploading…
                                  </span>
                                ) : avatar ? (
                                  "Click to replace"
                                ) : (
                                  "Click to upload"
                                )}
                              </div>
                            </div>

                            <input
                              ref={avatarInputRef}
                              type="file"
                              accept="image/*"
                              disabled={saving || uploadingBanner || uploadingAvatar}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void onPickAvatar(file);
                              }}
                            />
                          </div>

                          <div className="text-[11px] text-muted-foreground leading-relaxed">
                            Square images look best.
                            <br />
                            <span className="font-semibold">Max 3MB.</span>
                          </div>
                        </div>
                      </div>

                      {/* Text fields */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field
                            label="Username"
                            value={draft.username}
                            onChange={(v) => setDraft((d) => ({ ...d, username: v }))}
                            placeholder="Your name"
                            hint="Keep it clean. No gimmicks."
                            inputRef={firstRef}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Field
                            label="Bio"
                            value={draft.bio}
                            onChange={(v) => setDraft((d) => ({ ...d, bio: v }))}
                            placeholder="Tell people a bit about you…"
                            rows={5}
                            hint="Markdown not supported. Keep it concise for best display."
                          />
                        </div>

                        <Field
                          label="Website"
                          hint="We’ll auto-fix missing https://"
                          value={draft.website}
                          onChange={(v) => setDraft((d) => ({ ...d, website: v }))}
                          placeholder="yourdomain.com"
                        />

                        <Field
                          label="Telegram"
                          value={draft.telegram}
                          onChange={(v) => setDraft((d) => ({ ...d, telegram: v }))}
                          placeholder="https://t.me/username"
                        />

                        <Field
                          label="X"
                          value={draft.x}
                          onChange={(v) => setDraft((d) => ({ ...d, x: v }))}
                          placeholder="https://x.com/username"
                        />

                        <Field
                          label="Instagram"
                          value={draft.instagram}
                          onChange={(v) => setDraft((d) => ({ ...d, instagram: v }))}
                          placeholder="https://instagram.com/username"
                        />
                      </div>

                      {err ? (
                        <div className="rounded-2xl border border-border bg-background/60 p-3 text-sm text-foreground">
                          <span className="text-muted-foreground">Error:</span> {err}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Sticky footer */}
                  <div className="sticky bottom-0 border-t border-border bg-card/92 px-5 py-4 backdrop-blur-xl sm:px-6">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-medium hover:bg-background"
                        disabled={saving || uploadingBanner || uploadingAvatar}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={onSave}
                        disabled={saving || uploadingBanner || uploadingAvatar}
                        className={[
                          "rounded-full px-4 py-2 text-sm font-semibold transition",
                          saving || uploadingBanner || uploadingAvatar
                            ? "bg-foreground/70 text-background"
                            : "bg-foreground text-background hover:opacity-90",
                        ].join(" ")}
                      >
                        {saving ? "Saving…" : uploadingBanner || uploadingAvatar ? "Uploading…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
