// Click-through lists for the recruitment dashboard: every number maps to the applications behind it.
import { dayKey } from "@/lib/time";
import { PIPELINE, STAGES, done, isActive, isStalled, pct, scoresOf, type AppRow, type JobRow, type Stage } from "@/lib/recruitment-stats";

export const DRILL_KINDS = ["all", "active", "stalled", "stage", "job", "pipeline", "docs", "nodocs", "exam", "bucket", "psych", "trait", "day", "source", "lang"] as const;
export type DrillKind = (typeof DRILL_KINDS)[number];
export type Drill = { kind: DrillKind; value?: string; stage?: string };
export type DrillRow = { app: AppRow; note?: string };

import { STAGE_LABEL } from "@/lib/stages";

export function parseDrill(q: { kind?: string; value?: string; stage?: string }): Drill {
  const kind = (DRILL_KINDS as readonly string[]).includes(q.kind ?? "") ? (q.kind as DrillKind) : "all";
  return { kind, value: q.value || undefined, stage: q.stage || undefined };
}

// Query string for a click-through link. `range` keeps the dashboard's period.
export const drillQuery = (range: string, kind: DrillKind, value?: string, stage?: string) => {
  const p = new URLSearchParams({ kind, range });
  if (value !== undefined) p.set("value", value);
  if (stage) p.set("stage", stage);
  return p.toString();
};
export const drillHref = (range: string, kind: DrillKind, value?: string, stage?: string) => `/recruitment/dashboard/detail?${drillQuery(range, kind, value, stage)}`;

const personOnce = (rows: DrillRow[]) => {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.app.personKey) ? false : (seen.add(r.app.personKey), true)));
};

export function drillApps(apps: AppRow[], d: Drill, tz: string, now = new Date()): DrillRow[] {
  const v = d.value ?? "";
  const rows = (list: AppRow[], note?: (a: AppRow) => string | undefined): DrillRow[] => list.map((app) => ({ app, note: note?.(app) }));
  let out: DrillRow[];
  switch (d.kind) {
    case "active": out = rows(apps.filter(isActive)); break;
    case "stalled": out = rows(apps.filter((a) => isStalled(a, now)), (a) => `${Math.floor((now.getTime() - a.createdAt.getTime()) / 86_400_000)} days at Applied`); break;
    case "stage": out = rows(apps.filter((a) => a.stage === v)); break;
    case "job": out = rows(apps.filter((a) => a.jobId === v && (!d.stage || (d.stage === "ACTIVE" ? isActive(a) : a.stage === d.stage)))); break;
    case "pipeline": out = rows(apps.filter(PIPELINE[Number(v)]?.test ?? (() => false))); break;
    case "docs": out = rows(apps.filter((a) => a.docsDone)); break;
    case "nodocs": out = rows(apps.filter((a) => !a.docsDone), (a) => (a.hasResume ? "Resume only" : a.hasId ? "ID only" : "Nothing uploaded")); break;
    case "exam": out = rows(apps.filter((a) => a.attempts.some((t) => t.examId === v && t.submittedAt)), (a) => `${pct(a.attempts.find((t) => t.examId === v)!)}%`); break;
    case "bucket": {
      const b = Number(v);
      out = rows(apps.filter((a) => { const t = done(a, "KNOWLEDGE"); return !!t && Math.min(9, Math.floor(pct(t) / 10)) === b; }), (a) => `${pct(done(a, "KNOWLEDGE")!)}%`);
      break;
    }
    case "psych": out = personOnce(rows(apps.filter((a) => done(a, "PSYCHOLOGICAL")), (a) => `${pct(done(a, "PSYCHOLOGICAL")!)}%`)); break;
    case "trait":
      out = personOnce(rows(apps.filter((a) => done(a, "PSYCHOLOGICAL")?.breakdown?.[v]), (a) => { const t = done(a, "PSYCHOLOGICAL")!.breakdown![v]; return `${t.max ? Math.round((t.score / t.max) * 100) : 0}%`; }));
      break;
    case "day": out = rows(apps.filter((a) => dayKey(a.createdAt, tz) === v)); break;
    case "source": out = rows(apps.filter((a) => (a.source ?? "Added by HR") === v)); break;
    case "lang": out = rows(apps.filter((a) => a.attempts.some((t) => t.submittedAt && (t.lang === "tl" ? "tl" : "en") === v)), () => (v === "tl" ? "Tagalog" : "English")); break;
    default: out = rows(apps);
  }
  const num = (r: DrillRow) => (r.note && /^\d+%$/.test(r.note) ? parseInt(r.note) : null);
  return out.sort((a, b) => (num(b) ?? -1) - (num(a) ?? -1) || b.app.createdAt.getTime() - a.app.createdAt.getTime());
}

export function drillTitle(d: Drill, apps: AppRow[], jobs: JobRow[]): string {
  const v = d.value ?? "";
  switch (d.kind) {
    case "active": return "Applications in progress";
    case "stalled": return "Applications stuck at Applied for more than 3 days";
    case "stage": return `Applications at ${STAGE_LABEL[v as Stage] ?? v}`;
    case "job": return `${jobs.find((j) => j.id === v)?.title ?? "Position"}: ${d.stage === "ACTIVE" ? "in progress" : STAGE_LABEL[d.stage as Stage]?.toLowerCase() ?? "all applications"}`;
    case "pipeline": return `Reached: ${PIPELINE[Number(v)]?.label ?? v}`;
    case "docs": return "Uploaded resume and valid ID";
    case "nodocs": return "Missing resume or valid ID";
    case "exam": return `Took: ${apps.flatMap((a) => a.attempts).find((t) => t.examId === v)?.examTitle ?? "exam"}`;
    case "bucket": return `Knowledge exam score ${Number(v) * 10}-${Number(v) === 9 ? 100 : Number(v) * 10 + 9}%`;
    case "psych": return "Took the psychological exam";
    case "trait": return `Psychological exam: ${v}`;
    case "day": return `Applied on ${v}`;
    case "source": return `Came from: ${v}`;
    case "lang": return `Took an exam in ${v === "tl" ? "Tagalog" : "English"}`;
    default: return "All applications";
  }
}

export type PersonApp = { app: AppRow; match: boolean; note?: string };
export type PersonRow = {
  key: string; name: string; email: string | null; phone: string | null; applicantNo: string | null;
  hasResume: boolean; hasId: boolean; firstApplied: Date; apps: PersonApp[];
  psychological: number | null; bestCombined: number | null; matches: number; note?: string;
};

// One row per applicant. Every position they applied for is listed with its stage; `match` marks the ones that belong
// to the list being shown (the others are shown for context, so one person is never split over several rows).
export function groupByPerson(rows: DrillRow[], all: AppRow[]): PersonRow[] {
  const hit = new Map<string, DrillRow[]>();
  for (const r of rows) hit.set(r.app.personKey, [...(hit.get(r.app.personKey) ?? []), r]);
  const out: PersonRow[] = [];
  for (const [key, matched] of hit) {
    const mine = all.filter((a) => a.personKey === key).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const first = mine[0] ?? matched[0].app;
    const ids = new Map(matched.map((m) => [m.app.id, m.note]));
    const sc = mine.map(scoresOf);
    out.push({
      key, name: first.name, email: first.email, phone: first.phone, applicantNo: first.applicantNo,
      hasResume: first.hasResume, hasId: first.hasId, firstApplied: first.createdAt,
      apps: mine.map((app) => ({ app, match: ids.has(app.id), note: ids.get(app.id) })),
      psychological: sc.find((x) => x.psychological !== null)?.psychological ?? null,
      bestCombined: sc.reduce<number | null>((b, x) => (x.combined !== null && (b === null || x.combined > b) ? x.combined : b), null),
      matches: matched.length,
      note: matched.map((m) => m.note).find(Boolean),
    });
  }
  const num = (p: PersonRow) => (p.note && /^\d+%$/.test(p.note) ? parseInt(p.note) : null);
  return out.sort((a, b) => (num(b) ?? -1) - (num(a) ?? -1) || Math.max(...b.apps.map((x) => x.app.createdAt.getTime())) - Math.max(...a.apps.map((x) => x.app.createdAt.getTime())));
}

export { STAGES };
