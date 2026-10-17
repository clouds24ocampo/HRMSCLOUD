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

export function dayKey(at: Date, tz: string): string {
  const p = parts(at, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

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

export const dbDate = (key: string) => new Date(`${key}T00:00:00.000Z`);
export const keyOfDbDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(key: string, n: number): string {
  const d = dbDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOfDbDate(d);
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to && out.length < 400; k = addDays(k, 1)) out.push(k);
  return out;
}

export const weekday = (key: string) => dbDate(key).getUTCDay(); // 0 = Sunday

export function parseHM(s: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function parseHMS(s: string): { minutes: number; seconds: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(s.trim());
  if (!m) return null;
  return { minutes: Number(m[1]) * 60 + Number(m[2]), seconds: m[3] ? Number(m[3]) : 0 };
}

export function zonedTimeToUtcWithSeconds(key: string, minutes: number, seconds: number, tz: string): Date {
  const d = zonedTimeToUtc(key, minutes, tz);
  return new Date(d.getTime() + seconds * 1000);
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

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

export function formatTime(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
}

export function formatTimePrecise(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(at);
}

export function formatDay(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(dbDate(key));
}

// Monday of the week containing `key`.
export function weekStart(key: string): string {
  const wd = weekday(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

