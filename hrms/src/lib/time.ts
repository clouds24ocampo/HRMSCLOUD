// Timezone helpers on top of Intl. No date library needed.
// A "day key" is "YYYY-MM-DD" in the organization's timezone. Dates in the database (@db.Date) are UTC midnight of that key.

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function parts(at: Date, tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(at)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return p;
}

// The calendar date ("YYYY-MM-DD") at instant `at` on the wall clock of timezone `tz`. Attendance days are always keyed this way.
export function dayKey(at: Date, tz: string): string {
  const p = parts(at, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// Minutes since midnight on the wall clock of `tz` at instant `at` (0 to 1439).
export function minutesOfDay(at: Date, tz: string): number {
  const p = parts(at, tz);
  return p.hour * 60 + p.minute;
}

function offsetMs(at: Date, tz: string): number {
  const p = parts(at, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at.getTime() / 1000) * 1000;
}

// The instant when the wall clock in `tz` reads dayKey + minutes (minutes may exceed 1440 for next-day times).
export function zonedTimeToUtc(key: string, minutes: number, tz: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz); // second pass settles daylight-saving edges
  return new Date(t);
}

// A day key as the UTC-midnight Date stored in @db.Date columns. Inverse of keyOfDbDate.
export const dbDate = (key: string) => new Date(`${key}T00:00:00.000Z`);
// The day key ("YYYY-MM-DD") of a @db.Date value. Inverse of dbDate.
export const keyOfDbDate = (d: Date) => d.toISOString().slice(0, 10);

// Day key `n` calendar days after `key` (negative `n` goes back). Pure date math, no timezone involved.
export function addDays(key: string, n: number): string {
  const d = dbDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOfDbDate(d);
}

// Every day key from `from` to `to` inclusive, capped at 400 days so a bad range cannot run away.
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to && out.length < 400; k = addDays(k, 1)) out.push(k);
  return out;
}

// Day of week for a day key: 0 = Sunday ... 6 = Saturday.
export const weekday = (key: string) => dbDate(key).getUTCDay(); // 0 = Sunday

// Parses "HH:MM" (24-hour) into minutes since midnight; null when the text is not a valid time.
export function parseHM(s: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Parses "HH:MM" or "HH:MM:SS" (24-hour); null when invalid. Seconds default to 0.
export function parseHMS(s: string): { minutes: number; seconds: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(s.trim());
  if (!m) return null;
  return { minutes: Number(m[1]) * 60 + Number(m[2]), seconds: m[3] ? Number(m[3]) : 0 };
}

// Like zonedTimeToUtc, with a seconds offset added on top of the minute.
export function zonedTimeToUtcWithSeconds(key: string, minutes: number, seconds: number, tz: string): Date {
  const d = zonedTimeToUtc(key, minutes, tz);
  return new Date(d.getTime() + seconds * 1000);
}

// Minutes as "2h 05m" (or "45m" under an hour).
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

// Seconds as "1h 02m 03s", dropping leading zero units. Negative input shows as 0s.
export function formatDurationPrecise(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const rem = s % 3600;
  const mins = Math.floor(rem / 60);
  const secs = rem % 60;

  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  }
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  }
  return `${secs}s`;
}

// Clock time like "9:05 AM" on the wall clock of `tz`.
export function formatTime(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
}

// Clock time with seconds, like "9:05:07 AM", on the wall clock of `tz`.
export function formatTimePrecise(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(at);
}

// A day key as readable text (default "Mon, Oct 6"). Pass Intl options to change the shape.
export function formatDay(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(dbDate(key));
}

// Monday of the week containing `key`.
export function weekStart(key: string): string {
  const wd = weekday(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

