/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  Info,
  Download,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Wand2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount } from "thirdweb/react";

import DateTimePicker from "../shared/DateTimePicker";
import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";
import { Textarea } from "@/src/ui/Textarea";
import { Switch } from "@/src/ui/Switch";
import { Skeleton } from "@/src/ui/Skeleton";

import type { AllowlistState, PrepareResult } from "@/src/types/dropCollection";

/** Server still appends qualifying Comrades holders on prepare. */
const MIN_COMRADES_THRESHOLD = 100;

/** Parse raw text -> AllowlistState, checksum without lowercasing. */
function parseAddresses(raw: string): AllowlistState {
  const ordered = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const lowers = new Set<string>();
  const dupLowers = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const r of ordered) {
    if (ethers.isAddress(r)) {
      const c = ethers.getAddress(r);
      const l = c.toLowerCase();
      if (lowers.has(l)) dupLowers.add(l);
      else {
        lowers.add(l);
        valid.push(c);
      }
    } else {
      invalid.push(r);
    }
  }

  const duplicates = Array.from(dupLowers).map((l) => valid.find((v) => v.toLowerCase() === l) || l);
  const previewFirst3 = ordered.slice(0, 3);
  const previewRemain = Math.max(0, ordered.length - 3);

  return {
    raw,
    ordered,
    validChecksummed: valid,
    invalid,
    duplicates,
    previewFirst3,
    previewRemain,
  };
}

function downloadSampleCsv() {
  const sample = [
    "address",
    "0xabc0000000000000000000000000000000000001",
    "0xabc0000000000000000000000000000000000002",
    "0xdef0000000000000000000000000000000000003",
  ].join("\n");

  const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "whitelist-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function TinyError({ text }: { text?: string | null }) {
  return text ? <p className="mt-1.5 text-[11px] leading-snug text-red-500">{text}</p> : null;
}

function InlineTip({ tip }: { tip: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full"
        onClick={() => setOpen((v) => !v)}
        aria-label="Info"
      >
        <Info className="h-4 w-4 opacity-80" />
      </Button>

      {open ? (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label="Close tip" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-50 w-80 max-w-[85vw] rounded-2xl border border-border bg-card p-3 text-sm shadow-xl">
            {tip}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 min-w-0">
      <div className="text-sm font-medium leading-5">{label}</div>
      <div className="pt-0.5">{children}</div>
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
      <TinyError text={error ?? null} />
    </div>
  );
}

type Props = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  onAllowlistChange: (state: AllowlistState) => void;
  onPrepared: (res: PrepareResult) => void;
  invalidatePrepared: () => void;
  initialRaw?: string;

  presaleStart: string;
  onChangePresaleStart: (v: string) => void;
  presaleEnd: string;
  onChangePresaleEnd: (v: string) => void;
  presalePriceEtn: string;
  onChangePresalePriceEtn: (v: string) => void;
  presaleSupplyStr: string;
  onChangePresaleSupplyStr: (v: string) => void;

  presaleFieldErrors?: {
    start?: string | null;
    end?: string | null;
    price?: string | null;
    supply?: string | null;
  };

  totalSupplyMax?: number;
};

export default function WhitelistInput({
  enabled,
  onEnabledChange,
  onAllowlistChange,
  onPrepared,
  invalidatePrepared,
  initialRaw = "",

  presaleStart,
  onChangePresaleStart,
  presaleEnd,
  onChangePresaleEnd,
  presalePriceEtn,
  onChangePresalePriceEtn,
  presaleSupplyStr,
  onChangePresaleSupplyStr,

  presaleFieldErrors,
  totalSupplyMax,
}: Props) {
  const account = useActiveAccount();
  const address = account?.address ?? "";

  const [useCsvUpload, setUseCsvUpload] = useState(false);
  const [raw, setRaw] = useState(initialRaw);
  const [state, setState] = useState<AllowlistState>(() => parseAddresses(initialRaw));

  const [busy, setBusy] = useState(false);
  const [prepareOk, setPrepareOk] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [merkleRoot, setMerkleRoot] = useState<string | undefined>(undefined);
  const [commit, setCommit] = useState<string | undefined>(undefined);
  const [appendedFromComrades, setAppendedFromComrades] = useState<number>(0);

  const csvInputId = useId();

  const [touched, setTouched] = useState<{ start?: boolean; end?: boolean; price?: boolean; supply?: boolean }>({});
  const markTouched = (k: "start" | "end" | "price" | "supply") =>
    setTouched((prev) => (prev[k] ? prev : { ...prev, [k]: true }));

  useEffect(() => {
    const s = parseAddresses(raw);
    setState(s);
    onAllowlistChange(s);

    setPrepareOk(false);
    setDraftId(undefined);
    setMerkleRoot(undefined);
    setCommit(undefined);
    setAppendedFromComrades(0);
    invalidatePrepared();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const canPrepare = useMemo(() => {
    return enabled && !busy && state.invalid.length === 0 && state.duplicates.length === 0 && state.validChecksummed.length > 0;
  }, [enabled, busy, state.invalid.length, state.duplicates.length, state.validChecksummed.length]);

  const generateMerkle = useCallback(
    async (sourceRaw?: string) => {
      if (!enabled) {
        toast.error("Enable presale first.");
        return;
      }

      const s = sourceRaw ? parseAddresses(sourceRaw) : state;

      if (s.invalid.length || s.duplicates.length || s.validChecksummed.length === 0) {
        toast.error("Fix invalid or duplicate addresses before generating Merkle root.");
        return;
      }

      try {
        setBusy(true);

        const res = await fetch("/api/presale/prepare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-address": address || "",
          },
          body: JSON.stringify({
            addressesText: s.raw,
            includeComrades: true,
            minComrades: MIN_COMRADES_THRESHOLD,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Preparation failed");

        const appended = Number.isFinite(Number(json?.counts?.appendedFromComrades))
          ? Number(json.counts.appendedFromComrades)
          : 0;

        setPrepareOk(true);
        setDraftId(json.draftId);
        setMerkleRoot(json.merkleRoot);
        setCommit(json.commit);
        setAppendedFromComrades(appended);

        onPrepared({
          ok: true,
          draftId: json.draftId,
          merkleRoot: json.merkleRoot,
          commit: json.commit,
          count: s.validChecksummed.length + appended,
        });

        toast.success("Allowlist validated.");
      } catch (e: any) {
        setPrepareOk(false);
        setDraftId(undefined);
        setMerkleRoot(undefined);
        setCommit(undefined);
        setAppendedFromComrades(0);
        onPrepared({ ok: false, error: e?.message || "Failed to generate Merkle root" });
        toast.error(e?.message || "Failed to generate Merkle root.");
      } finally {
        setBusy(false);
      }
    },
    [enabled, state, address, onPrepared]
  );

  useEffect(() => {
    if (!enabled) return;
    if (useCsvUpload) return;
    if (!canPrepare) return;

    const t = setTimeout(() => void generateMerkle(), 650);
    return () => clearTimeout(t);
  }, [enabled, useCsvUpload, canPrepare, generateMerkle]);

  const onCsvPicked = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      try {
        const text = await file.text();
        const cleaned = text.replace(/\r/g, "").trim();
        const lines = cleaned.split("\n");

        let body = cleaned;
        if (lines.length > 0 && /^address\s*$/i.test(lines[0].trim())) body = lines.slice(1).join("\n");

        setUseCsvUpload(true);
        setRaw(body);

        toast.success("CSV parsed.");

        const soon = parseAddresses(body);
        if (!soon.invalid.length && !soon.duplicates.length && soon.validChecksummed.length > 0 && enabled) {
          await generateMerkle(soon.raw);
        }
      } catch {
        toast.error("Failed to read CSV.");
      }
    },
    [enabled, generateMerkle]
  );

  return (
    <div className="rounded-3xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-7 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Presale (allowlist)</div>
          <div className="text-xs text-muted-foreground">
            Optional presale window + allowlist. Qualifying Comrades holders are appended server-side.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Enabled</span>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              onEnabledChange(v);
              if (!v) {
                setPrepareOk(false);
                setDraftId(undefined);
                setMerkleRoot(undefined);
                setCommit(undefined);
                setAppendedFromComrades(0);
                onPrepared({ ok: false });
                setTouched({});
              }
            }}
          />
        </div>
      </div>

      {!enabled ? null : (
        <>
          <div className="rounded-3xl border border-border bg-background/40 px-4 py-5 sm:px-5 sm:py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-12">
              <Field label="Presale start (Africa/Lagos)" error={touched.start ? presaleFieldErrors?.start ?? null : null}>
                <DateTimePicker
                  label=""
                  value={presaleStart}
                  onChange={(v) => {
                    onChangePresaleStart(v);
                    markTouched("start");
                  }}
                  minNow
                />
              </Field>

              <Field label="Presale end (Africa/Lagos)" error={touched.end ? presaleFieldErrors?.end ?? null : null}>
                <DateTimePicker
                  label=""
                  value={presaleEnd}
                  onChange={(v) => {
                    onChangePresaleEnd(v);
                    markTouched("end");
                  }}
                  minNow
                />
              </Field>

              <Field label="Presale price (ETN)" error={touched.price ? presaleFieldErrors?.price ?? null : null}>
                <Input
                  value={presalePriceEtn}
                  onChange={(e) => onChangePresalePriceEtn(e.target.value)}
                  onBlur={() => markTouched("price")}
                  placeholder="e.g. 10"
                />
              </Field>

              <Field label="Presale supply" error={touched.supply ? presaleFieldErrors?.supply ?? null : null}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  max={typeof totalSupplyMax === "number" && totalSupplyMax > 0 ? totalSupplyMax : undefined}
                  value={presaleSupplyStr}
                  onChange={(e) => onChangePresaleSupplyStr(e.target.value)}
                  onBlur={() => markTouched("supply")}
                />
              </Field>
            </div>
          </div>

          <div className="h-px w-full bg-border/70" />

          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">Whitelist addresses</div>
                <InlineTip
                  tip={
                    <div className="space-y-2">
                      <div className="font-medium">CSV / Text format</div>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        <li>Comma-separated or one per line</li>
                        <li>CSV header <code>address</code> is OK</li>
                        <li>No allocations — everyone uses the presale price</li>
                      </ul>
                      <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={downloadSampleCsv}>
                        <Download className="h-4 w-4" /> Sample CSV
                      </Button>
                    </div>
                  }
                />
              </div>

              <div className="text-xs text-muted-foreground">
                Valid: <span className="text-foreground">{state.validChecksummed.length}</span> · Invalid:{" "}
                <span className={state.invalid.length ? "text-red-500" : "text-foreground"}>{state.invalid.length}</span>{" "}
                · Duplicates:{" "}
                <span className={state.duplicates.length ? "text-red-500" : "text-foreground"}>{state.duplicates.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Use CSV</span>
              <Switch checked={useCsvUpload} onCheckedChange={setUseCsvUpload} />
            </div>
          </div>

          {!useCsvUpload ? (
            <Textarea
              rows={5}
              placeholder="0xabc..., 0xdef..., 0x123... (commas or new lines)"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="rounded-2xl wrap-break-word"
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-background/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Upload CSV (<code>address</code> column or plain list)
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id={csvInputId}
                    type="file"
                    accept=".csv,text/csv,.txt"
                    className="hidden"
                    onChange={(e) => void onCsvPicked(e.target.files?.[0] ?? null)}
                  />
                  <label htmlFor={csvInputId}>
                    <Button type="button" variant="secondary" className="gap-2">
                      <Upload className="h-4 w-4" /> Choose file
                    </Button>
                  </label>
                </div>
              </div>

              {raw ? (
                <div className="mt-4 rounded-2xl border border-border bg-card p-3 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Parsed preview</span>
                    <span className="text-muted-foreground">(first 3 rows)</span>
                  </div>

                  <div className="space-y-1">
                    {state.previewFirst3.map((row, i) => {
                      const valid = ethers.isAddress(row);
                      const dup = state.duplicates.some((d) => d.toLowerCase() === row.toLowerCase());
                      return (
                        <div key={`${row}-${i}`} className="flex items-center gap-2">
                          {valid && !dup ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <code className="break-all">{row}</code>
                          {dup ? <span className="text-red-500 ml-1">(duplicate)</span> : null}
                          {!valid ? <span className="text-red-500 ml-1">(invalid)</span> : null}
                        </div>
                      );
                    })}
                    {state.previewRemain > 0 ? <div className="text-muted-foreground">+{state.previewRemain} more</div> : null}
                  </div>
                </div>
              ) : null}

              <p className="text-[11px] text-muted-foreground mt-3">
                Qualifying Comrades holders (≥ {MIN_COMRADES_THRESHOLD}) are appended server-side when generating.
              </p>
            </div>
          )}

          <div className="rounded-3xl border border-border bg-background/40 px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm flex items-center gap-2 min-w-0">
              {busy ? (
                <>
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <span className="text-muted-foreground">Validating allowlist…</span>
                </>
              ) : prepareOk ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium">Allowlist processed</span>
                  {draftId ? <span className="text-xs text-muted-foreground">· draft {draftId.slice(0, 6)}…</span> : null}
                  {appendedFromComrades > 0 ? (
                    <span className="text-xs text-muted-foreground">· appended {appendedFromComrades} Comrades</span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">Generate Merkle root when your allowlist is clean.</span>
              )}
            </div>

            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={!canPrepare}
              onClick={() => void generateMerkle()}
              title={
                state.invalid.length || state.duplicates.length
                  ? "Fix invalid/duplicate addresses first"
                  : state.validChecksummed.length === 0
                    ? "Add at least one address"
                    : undefined
              }
            >
              <Wand2 className="h-4 w-4" />
              {busy ? "Generating…" : "Generate"}
            </Button>
          </div>

          {prepareOk && merkleRoot ? (
            <div className="space-y-2.5">
              <div className="text-sm font-medium">Merkle root (read-only)</div>
              <Input value={merkleRoot} readOnly className="font-mono text-xs" />
              {commit ? (
                <p className="text-[11px] text-muted-foreground">
                  Commit: <code className="break-all">{commit}</code>
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}