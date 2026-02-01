"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/src/ui/Button";
import { Input } from "@/src/ui/Input";
import { Modal } from "@/src/ui/Modal";

type DateTimePickerProps = {
  label: string;
  value: string; // "YYYY-MM-DDTHH:mm" (interpreted as Africa/Lagos local time)
  onChange: (val: string) => void;
  disabled?: boolean;
  minNow?: boolean;
  zIndex?: number;
};

/**
 * Hydration-safe strategy:
 * - NEVER use Intl defaults (undefined locale / resolvedOptions timeZone).
 * - ALWAYS render deterministically using fixed locale + fixed timezone.
 * - We standardize everything to Africa/Lagos (UTC+01:00) as per project rule.
 */
const FIXED_LOCALE = "en-GB";
const FIXED_TZ = "Africa/Lagos";
const FIXED_OFFSET = "UTC+01:00";

/* ---------- helpers ---------- */
function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalYMDHM(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalYMDHM(s: string): Date | null {
  if (!s) return null;
  const [datePart, timePart] = s.split("T");
  if (!datePart || !timePart) return null;

  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined) return null;

  // Interpret the input as "Africa/Lagos local time".
  // Create a UTC instant corresponding to that local time by subtracting +01:00.
  // Lagos is stable (no DST).
  const utcMs =
    Date.UTC(y, m - 1, d, hh, mm, 0, 0) - 60 * 60 * 1000; // minus 1 hour
  return new Date(utcMs);
}

function clampToLead(d: Date, leadMin: number) {
  if (!leadMin) return d;

  // Use actual now (client only). This does not affect SSR output because
  // we don't render date-dependent text from this unless value exists.
  const t = new Date();
  t.setMinutes(t.getMinutes() + leadMin);
  t.setSeconds(0);
  t.setMilliseconds(0);

  return d < t ? t : d;
}

function tzLabel() {
  return { tzn: FIXED_TZ, offset: FIXED_OFFSET };
}

function formatDisplayLocal(s: string): string {
  const date = fromLocalYMDHM(s);
  const { tzn, offset } = tzLabel();
  if (!date) return `Select (${tzn}, ${offset})`;

  const fmtDate = new Intl.DateTimeFormat(FIXED_LOCALE, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: FIXED_TZ,
  }).format(date);

  const fmtTime = new Intl.DateTimeFormat(FIXED_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: FIXED_TZ,
  }).format(date);

  return `${fmtDate} • ${fmtTime} (${tzn}, ${offset})`;
}

/* ---------- component ---------- */
export default function DateTimePicker({
  label,
  value,
  onChange,
  disabled,
  minNow,
  zIndex = 1_000_002,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const lead = minNow ? 7 : 0;

  const initial = React.useMemo(() => {
    const d = value ? fromLocalYMDHM(value) : null;

    // If there's no value, pick a stable default for inputs (client will adjust later).
    // IMPORTANT: display text is constant when value is empty, so SSR won't mismatch.
    const base = d ?? new Date();
    const clamped = clampToLead(base, lead);

    clamped.setSeconds(0);
    clamped.setMilliseconds(0);
    return clamped;
  }, [value, lead]);

  const [datePart, setDatePart] = React.useState(() =>
    toLocalYMDHM(initial).slice(0, 10)
  );
  const [timePart, setTimePart] = React.useState(() =>
    toLocalYMDHM(initial).slice(11)
  );

  React.useEffect(() => {
    const d = value ? fromLocalYMDHM(value) : null;
    if (!d) return;
    const ymdhm = toLocalYMDHM(clampToLead(d, lead));
    setDatePart(ymdhm.slice(0, 10));
    setTimePart(ymdhm.slice(11));
  }, [value, lead]);

  function apply(valDate: string, valTime: string) {
    const d = fromLocalYMDHM(`${valDate}T${valTime}`);
    if (!d) return;
    onChange(toLocalYMDHM(clampToLead(d, lead)));
  }

  function setRelativeMinutes(mins: number) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + mins);
    d.setSeconds(0);
    d.setMilliseconds(0);
    const t = clampToLead(d, lead);
    const ymdhm = toLocalYMDHM(t);
    setDatePart(ymdhm.slice(0, 10));
    setTimePart(ymdhm.slice(11));
  }

  function addHours(h: number) {
    const d = fromLocalYMDHM(`${datePart}T${timePart}`) ?? new Date();
    d.setHours(d.getHours() + h);
    const t = clampToLead(d, lead);
    const ymdhm = toLocalYMDHM(t);
    setDatePart(ymdhm.slice(0, 10));
    setTimePart(ymdhm.slice(11));
  }

  function tomorrowAt(hh: number, mm = 0) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hh, mm, 0, 0);
    const t = clampToLead(d, lead);
    const ymdhm = toLocalYMDHM(t);
    setDatePart(ymdhm.slice(0, 10));
    setTimePart(ymdhm.slice(11));
  }

  function nextWeekSameTime() {
    const d = fromLocalYMDHM(`${datePart}T${timePart}`) ?? new Date();
    d.setDate(d.getDate() + 7);
    const t = clampToLead(d, lead);
    const ymdhm = toLocalYMDHM(t);
    setDatePart(ymdhm.slice(0, 10));
    setTimePart(ymdhm.slice(11));
  }

  const display = value ? formatDisplayLocal(value) : "Select date & time";
  const tz = tzLabel();

  return (
    <div className="w-full">
      <div className="mb-1 text-sm font-medium">{label}</div>

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full justify-between bg-card"
      >
        <span className="truncate text-left">{display}</span>
        <CalendarClock className="h-4 w-4 opacity-70" />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pick date & time"
        zIndex={zIndex}
        className="max-w-md"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs text-muted">Date</div>
            <Input
              type="date"
              value={datePart}
              onChange={(e) => setDatePart(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted">Time</div>
            <Input
              type="time"
              step={60}
              value={timePart}
              onChange={(e) => setTimePart(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-muted">
          Times shown in <strong>{tz.tzn}</strong> ({tz.offset})
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setRelativeMinutes(5)}>
            +5 mins
          </Button>
          <Button type="button" variant="secondary" onClick={() => addHours(1)}>
            +1 hour
          </Button>
          <Button type="button" variant="secondary" onClick={() => tomorrowAt(10, 0)}>
            Tomorrow 10:00
          </Button>
          <Button type="button" variant="secondary" onClick={nextWeekSameTime}>
            Next week
          </Button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              apply(datePart, timePart);
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </Modal>
    </div>
  );
}
