// Productivity & Time-Tracking engine.
// Accurately tracks seconds and minutes across Productive Work, Issue Downtime, and Breaks.
// Aggregates automatically by Days, Weeks, and Months.
import type { DtrDay, PauseSummary } from "@/lib/dtr";
import { addDays, formatDay, weekStart } from "@/lib/time";

export type ProductivitySummary = {
  grossSeconds: number;
  productiveSeconds: number;
  productiveMinutes: number;
  issueSeconds: number;
  issueMinutes: number;
  breakSeconds: number;
  breakMinutes: number;
  workedSeconds: number;
  workedMinutes: number;
  productivityRate: number; // productive / (productive + issue) * 100
  effectiveRate: number; // productive / gross * 100
  totalDays: number;
  presentDays: number;
  issues: PauseSummary[];
  breaks: PauseSummary[];
  other: PauseSummary[];
};

export type DayProductivity = {
  day: string;
  status: DtrDay["status"];
  shift: DtrDay["shift"];
  firstIn: Date | null;
  lastOut: Date | null;
  grossSeconds: number;
  productiveSeconds: number;
  issueSeconds: number;
  breakSeconds: number;
  workedSeconds: number;
  productivityRate: number;
  pauses: PauseSummary[];
};

export type PeriodProductivity = {
  key: string;
  label: string;
  from: string;
  to: string;
  summary: ProductivitySummary;
  days: DayProductivity[];
};

function combinePauses(allPauses: PauseSummary[]): {
  issues: PauseSummary[];
  breaks: PauseSummary[];
  other: PauseSummary[];
} {
  const map = new Map<string, PauseSummary>();
  for (const p of allPauses) {
    const existing = map.get(p.name);
    if (!existing) {
      map.set(p.name, { ...p });
    } else {
      existing.count += p.count;
      existing.minutes += p.minutes;
      existing.seconds += p.seconds;
      existing.overMinutes += p.overMinutes;
    }
  }

  const issues: PauseSummary[] = [];
  const breaks: PauseSummary[] = [];
  const other: PauseSummary[] = [];

  for (const p of map.values()) {
    if (p.category === "ISSUE") issues.push(p);
    else if (p.category === "BREAK") breaks.push(p);
    else other.push(p);
  }

  return { issues, breaks, other };
}

export function summarizeProductivity(rows: DtrDay[]): ProductivitySummary {
  let grossSeconds = 0;
  let productiveSeconds = 0;
  let issueSeconds = 0;
  let breakSeconds = 0;
  let workedSeconds = 0;
  let presentDays = 0;
  const rawPauses: PauseSummary[] = [];

  for (const r of rows) {
    grossSeconds += r.grossSeconds ?? 0;
    productiveSeconds += r.productiveSeconds ?? 0;
    issueSeconds += r.issueSeconds ?? 0;
    breakSeconds += r.breakSeconds ?? 0;
    workedSeconds += r.workedSeconds ?? (r.workedMinutes * 60);

    if (r.status === "PRESENT" || r.status === "INCOMPLETE") {
      presentDays++;
    }

    if (r.pauses) {
      for (const p of r.pauses) rawPauses.push(p);
    }
  }

  const activeWorkAndIssueSec = productiveSeconds + issueSeconds;
  const productivityRate =
    activeWorkAndIssueSec > 0
      ? Math.round((productiveSeconds / activeWorkAndIssueSec) * 1000) / 10
      : (grossSeconds > 0 ? 100 : 0);

  const effectiveRate =
    grossSeconds > 0
      ? Math.round((productiveSeconds / grossSeconds) * 1000) / 10
      : 0;

  const { issues, breaks, other } = combinePauses(rawPauses);

  return {
    grossSeconds,
    productiveSeconds,
    productiveMinutes: Math.floor(productiveSeconds / 60),
    issueSeconds,
    issueMinutes: Math.floor(issueSeconds / 60),
    breakSeconds,
    breakMinutes: Math.floor(breakSeconds / 60),
    workedSeconds,
    workedMinutes: Math.floor(workedSeconds / 60),
    productivityRate,
    effectiveRate,
    totalDays: rows.length,
    presentDays,
    issues,
    breaks,
    other,
  };
}

export function aggregateByDay(rows: DtrDay[]): DayProductivity[] {
  return rows.map((r) => ({
    day: r.day,
    status: r.status,
    shift: r.shift,
    firstIn: r.firstIn,
    lastOut: r.lastOut,
    grossSeconds: r.grossSeconds ?? 0,
    productiveSeconds: r.productiveSeconds ?? 0,
    issueSeconds: r.issueSeconds ?? 0,
    breakSeconds: r.breakSeconds ?? 0,
    workedSeconds: r.workedSeconds ?? (r.workedMinutes * 60),
    productivityRate: r.productivityRate ?? 0,
    pauses: r.pauses ?? [],
  }));
}

export function aggregateByWeek(rows: DtrDay[]): PeriodProductivity[] {
  const byWeek = new Map<string, DtrDay[]>();

  for (const r of rows) {
    const ws = weekStart(r.day);
    const list = byWeek.get(ws) ?? [];
    list.push(r);
    byWeek.set(ws, list);
  }

  const out: PeriodProductivity[] = [];
  const sortedKeys = [...byWeek.keys()].sort();

  for (const ws of sortedKeys) {
    const days = byWeek.get(ws)!;
    const we = addDays(ws, 6);
    const summary = summarizeProductivity(days);
    const label = `${formatDay(ws, { month: "short", day: "numeric" })} – ${formatDay(we, { month: "short", day: "numeric", year: "numeric" })}`;

    out.push({
      key: ws,
      label,
      from: ws,
      to: we,
      summary,
      days: aggregateByDay(days),
    });
  }

  return out;
}

export function aggregateByMonth(rows: DtrDay[]): PeriodProductivity[] {
  const byMonth = new Map<string, DtrDay[]>();

  for (const r of rows) {
    const m = r.day.slice(0, 7); // "YYYY-MM"
    const list = byMonth.get(m) ?? [];
    list.push(r);
    byMonth.set(m, list);
  }

  const out: PeriodProductivity[] = [];
  const sortedKeys = [...byMonth.keys()].sort();

  for (const m of sortedKeys) {
    const days = byMonth.get(m)!;
    const summary = summarizeProductivity(days);
    const [y, mon] = m.split("-");
    const dObj = new Date(Date.UTC(Number(y), Number(mon) - 1, 1));
    const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(dObj);
    const from = `${m}-01`;
    const to = days[days.length - 1]?.day ?? from;

    out.push({
      key: m,
      label,
      from,
      to,
      summary,
      days: aggregateByDay(days),
    });
  }

  return out;
}
