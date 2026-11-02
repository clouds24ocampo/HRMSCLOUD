// Recruitment analytics. Pure: takes plain rows, returns every number the dashboard shows, so it can be tested.
// One "application" = one person applying for one position. One "person" = one applicant account.
import { addDays, dayKey } from "@/lib/time";

import { STAGES, type Stage } from "@/lib/stages";
export { STAGES, type Stage };

export type AttemptRow = {
  examId: string; kind: "KNOWLEDGE" | "PSYCHOLOGICAL"; examTitle: string; passingPct: number | null;
  startedAt: Date; submittedAt: Date | null; score: number | null; maxScore: number | null; lang: string;
  breakdown: Record<string, { score: number; max: number }> | null;
};
export type AppRow = {
  id: string; name: string; jobId: string; jobTitle: string; stage: Stage; source: string | null;
  createdAt: Date; updatedAt: Date; personKey: string; docsDone: boolean; attempts: AttemptRow[];
  email: string | null; phone: string | null; applicantNo: string | null; hasResume: boolean; hasId: boolean;
};
export type JobRow = { id: string; title: string; openings: number; status: string };

export const pct = (a: AttemptRow) => (a.maxScore ? Math.round(((a.score ?? 0) / a.maxScore) * 100) : 0);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const rate = (n: number, of: number) => (of ? Math.round((n / of) * 100) : null);
export const done = (a: AppRow, kind: AttemptRow["kind"]) => a.attempts.find((t) => t.kind === kind && t.submittedAt) ?? null;

// Start of the chosen dashboard period; undefined means all time.
export const rangeStart = (range: string, now = new Date()) => (range === "all" ? undefined : new Date(now.getTime() - Number(range) * 86_400_000));

export const STALLED_DAYS = 3;
export const isActive = (a: AppRow) => a.stage !== "HIRED" && a.stage !== "REJECTED";
// Still at the first stage after STALLED_DAYS days: likely waiting on documents or exams.
export const isStalled = (a: AppRow, now: Date) => a.stage === "APPLIED" && now.getTime() - a.createdAt.getTime() > STALLED_DAYS * 86_400_000;

// How far applications get. Shared by the dashboard numbers and the click-through lists.
export const PIPELINE: { label: string; test: (a: AppRow) => boolean }[] = [
  { label: "Applied", test: () => true },
  { label: "Resume and ID uploaded", test: (a) => a.docsDone },
  { label: "Psychological exam done", test: (a) => !!done(a, "PSYCHOLOGICAL") },
  { label: "Knowledge exam done", test: (a) => !!done(a, "KNOWLEDGE") },
  { label: "Reached interview or beyond", test: (a) => ["INTERVIEW", "REQUIREMENTS", "OFFER", "HIRED"].includes(a.stage) },
  { label: "Hired", test: (a) => a.stage === "HIRED" },
];

// Scores of one application, as percents. Null when that exam is not done.
export function scoresOf(a: AppRow) {
  const k = done(a, "KNOWLEDGE"), p = done(a, "PSYCHOLOGICAL");
  return { knowledge: k ? pct(k) : null, psychological: p ? pct(p) : null, combined: k && p ? Math.round((pct(k) + pct(p)) / 2) : null };
}

export function buildStats(apps: AppRow[], jobs: JobRow[], now: Date, tz: string) {
  const people = new Set(apps.map((a) => a.personKey));
  const byStage = Object.fromEntries(STAGES.map((s) => [s, apps.filter((a) => a.stage === s).length])) as Record<Stage, number>;
  const active = apps.filter((a) => a.stage !== "HIRED" && a.stage !== "REJECTED").length;

  // Pipeline: how far applications got.
  const pipeline = PIPELINE.map((p) => ({ label: p.label, n: apps.filter(p.test).length }));

  // Per position.
  const positions = jobs.map((j) => {
    const mine = apps.filter((a) => a.jobId === j.id);
    const kn = mine.map((a) => done(a, "KNOWLEDGE")).filter((t): t is AttemptRow => !!t);
    const hired = mine.filter((a) => a.stage === "HIRED").length;
    return {
      id: j.id, title: j.title, status: j.status, openings: j.openings, applications: mine.length,
      active: mine.filter((a) => a.stage !== "HIRED" && a.stage !== "REJECTED").length,
      hired, rejected: mine.filter((a) => a.stage === "REJECTED").length, filled: `${hired}/${j.openings}`,
      avgKnowledge: avg(kn.map(pct)),
      passRate: rate(kn.filter((t) => t.passingPct != null && pct(t) >= t.passingPct).length, kn.filter((t) => t.passingPct != null).length),
    };
  }).sort((a, b) => b.applications - a.applications || a.title.localeCompare(b.title));

  // Knowledge exams, by exam.
  const knAttempts = apps.flatMap((a) => a.attempts.filter((t) => t.kind === "KNOWLEDGE" && t.submittedAt));
  const exams = [...new Map(knAttempts.map((t) => [t.examId, t.examTitle])).entries()].map(([id, title]) => {
    const rows = knAttempts.filter((t) => t.examId === id);
    const scores = rows.map(pct);
    const pass = rows.filter((t) => t.passingPct != null);
    return {
      id, title, taken: rows.length, avg: avg(scores), best: scores.length ? Math.max(...scores) : null, lowest: scores.length ? Math.min(...scores) : null,
      passRate: rate(pass.filter((t) => pct(t) >= t.passingPct!).length, pass.length),
    };
  }).sort((a, b) => b.taken - a.taken);
  const distribution = Array.from({ length: 10 }, (_, i) => ({ label: `${i * 10}-${i === 9 ? 100 : i * 10 + 9}`, value: 0 }));
  for (const t of knAttempts) distribution[Math.min(9, Math.floor(pct(t) / 10))].value++;

  // Psychological exam: one result per person (the system copies it to each of their applications).
  const psychByPerson = new Map<string, AttemptRow>();
  for (const a of apps) {
    const t = done(a, "PSYCHOLOGICAL");
    if (t && !psychByPerson.has(a.personKey)) psychByPerson.set(a.personKey, t);
  }
  const psych = [...psychByPerson.values()];
  const traitTotals = new Map<string, { score: number; max: number }>();
  for (const t of psych) for (const [trait, v] of Object.entries(t.breakdown ?? {})) {
    const c = traitTotals.get(trait) ?? { score: 0, max: 0 };
    c.score += v.score; c.max += v.max; traitTotals.set(trait, c);
  }
  const traits = [...traitTotals.entries()].map(([trait, v]) => ({ trait, pct: v.max ? Math.round((v.score / v.max) * 100) : 0 })).sort((a, b) => b.pct - a.pct);

  // Top candidates: both exams done, still in the running. Equal weight for the two exams.
  const ranking = apps
    .filter((a) => a.stage !== "REJECTED")
    .flatMap((a) => {
      const k = done(a, "KNOWLEDGE"), p = done(a, "PSYCHOLOGICAL");
      return k && p ? [{ id: a.id, name: a.name, jobId: a.jobId, jobTitle: a.jobTitle, stage: a.stage, knowledge: pct(k), psychological: pct(p), combined: Math.round((pct(k) + pct(p)) / 2) }] : [];
    })
    .sort((a, b) => b.combined - a.combined || a.name.localeCompare(b.name));
  const leaderboard = ranking.slice(0, 10);

  // Last 30 days of applications.
  const today = dayKey(now, tz);
  const perDay = new Map<string, number>();
  for (const a of apps) perDay.set(dayKey(a.createdAt, tz), (perDay.get(dayKey(a.createdAt, tz)) ?? 0) + 1);
  const daily = Array.from({ length: 30 }, (_, i) => { const k = addDays(today, i - 29); return { label: k.slice(5), key: k, value: perDay.get(k) ?? 0 }; });

  const allAttempts = apps.flatMap((a) => a.attempts.filter((t) => t.submittedAt));
  const minutes = (kind: AttemptRow["kind"]) => {
    const xs = allAttempts.filter((t) => t.kind === kind).map((t) => (t.submittedAt!.getTime() - t.startedAt.getTime()) / 60_000);
    return xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null;
  };
  const hiredApps = apps.filter((a) => a.stage === "HIRED");
  const sourceCount = new Map<string, number>();
  for (const a of apps) sourceCount.set(a.source ?? "Added by HR", (sourceCount.get(a.source ?? "Added by HR") ?? 0) + 1);

  return {
    totals: {
      people: people.size, applications: apps.length, active, hired: byStage.HIRED, rejected: byStage.REJECTED,
      hireRate: rate(byStage.HIRED, apps.length), rejectRate: rate(byStage.REJECTED, apps.length),
      docsRate: rate(apps.filter((a) => a.docsDone).length, apps.length),
      avgDaysToHire: hiredApps.length ? Math.round((hiredApps.reduce((s, a) => s + (a.updatedAt.getTime() - a.createdAt.getTime()), 0) / hiredApps.length / 86_400_000) * 10) / 10 : null,
      openPositions: jobs.filter((j) => j.status === "OPEN").length,
    },
    byStage, pipeline, positions, exams, distribution, daily, leaderboard, ranking,
    stalled: apps.filter((a) => isStalled(a, now)).length,
    psych: { taken: psych.length, avg: avg(psych.map(pct)), traits },
    timing: { knowledgeMin: minutes("KNOWLEDGE"), psychologicalMin: minutes("PSYCHOLOGICAL") },
    language: { en: allAttempts.filter((t) => t.lang !== "tl").length, tl: allAttempts.filter((t) => t.lang === "tl").length },
    sources: [...sourceCount.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
  };
}
