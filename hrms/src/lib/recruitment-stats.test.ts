import { describe, expect, it } from "vitest";
import { drillApps, groupByPerson } from "./recruitment-drill";
import { buildStats, type AppRow, type AttemptRow, type JobRow } from "./recruitment-stats";

const T = "Asia/Manila";
const now = new Date("2026-11-02T04:00:00Z");
const attempt = (kind: AttemptRow["kind"], score: number, max: number, extra: Partial<AttemptRow> = {}): AttemptRow => ({
  examId: `${kind}-x`, kind, examTitle: `${kind} exam`, passingPct: kind === "KNOWLEDGE" ? 60 : null,
  startedAt: new Date("2026-11-01T00:00:00Z"), submittedAt: new Date("2026-11-01T00:20:00Z"), score, maxScore: max, lang: "en", breakdown: null, ...extra,
});
const app = (id: string, person: string, jobId: string, stage: AppRow["stage"], attempts: AttemptRow[] = [], extra: Partial<AppRow> = {}): AppRow => ({
  id, name: id, jobId, jobTitle: jobId, stage, source: "Careers page", createdAt: new Date("2026-10-30T00:00:00Z"), updatedAt: new Date("2026-11-01T00:00:00Z"),
  personKey: person, docsDone: true, attempts, email: null, phone: null, applicantNo: null, hasResume: true, hasId: true, ...extra,
});
const jobs: JobRow[] = [{ id: "A", title: "Job A", openings: 2, status: "OPEN" }, { id: "B", title: "Job B", openings: 1, status: "OPEN" }, { id: "C", title: "Job C", openings: 1, status: "CLOSED" }];

describe("buildStats", () => {
  const apps = [
    app("a1", "p1", "A", "SCREENING", [attempt("KNOWLEDGE", 24, 30), attempt("PSYCHOLOGICAL", 90, 120, { breakdown: { Teamwork: { score: 10, max: 12 } } })]),
    app("a2", "p1", "B", "APPLIED", [attempt("PSYCHOLOGICAL", 90, 120, { breakdown: { Teamwork: { score: 10, max: 12 } } })]),
    app("a3", "p2", "A", "HIRED", [attempt("KNOWLEDGE", 12, 30)], { createdAt: new Date("2026-10-26T00:00:00Z") }),
    app("a4", "p3", "A", "REJECTED", [], { docsDone: false, source: null }),
  ];
  const s = buildStats(apps, jobs, now, T);

  it("counts people once and applications each", () => {
    expect(s.totals).toMatchObject({ people: 3, applications: 4, active: 2, hired: 1, rejected: 1, hireRate: 25, docsRate: 75, openPositions: 2 });
  });
  it("counts the funnel by stage", () => {
    expect(s.byStage).toEqual({ APPLIED: 1, SCREENING: 1, INTERVIEW: 0, REQUIREMENTS: 0, OFFER: 0, HIRED: 1, REJECTED: 1 });
    expect(s.pipeline.map((p) => p.n)).toEqual([4, 3, 2, 2, 1, 1]);
  });
  it("summarizes each position, including ones nobody applied to", () => {
    const a = s.positions.find((p) => p.id === "A")!;
    expect(a).toMatchObject({ applications: 3, hired: 1, rejected: 1, active: 1, filled: "1/2", avgKnowledge: 60, passRate: 50 });
    expect(s.positions.find((p) => p.id === "C")).toMatchObject({ applications: 0, avgKnowledge: null, passRate: null });
  });
  it("scores knowledge exams and buckets them", () => {
    expect(s.exams[0]).toMatchObject({ taken: 2, avg: 60, best: 80, lowest: 40, passRate: 50 });
    expect(s.distribution[8].value).toBe(1); // 80%
    expect(s.distribution[4].value).toBe(1); // 40%
  });
  it("counts the psychological exam once per person", () => {
    expect(s.psych).toMatchObject({ taken: 1, avg: 75, traits: [{ trait: "Teamwork", pct: 83 }] });
  });
  it("ranks candidates who finished both exams and are not rejected", () => {
    expect(s.leaderboard).toEqual([expect.objectContaining({ id: "a1", knowledge: 80, psychological: 75, combined: 78 })]);
  });
  it("averages days to hire, exam time and language", () => {
    expect(s.totals.avgDaysToHire).toBe(6);
    expect(s.timing).toEqual({ knowledgeMin: 20, psychologicalMin: 20 });
    expect(s.language).toEqual({ en: 4, tl: 0 });
  });
  it("makes 30 daily bars ending today", () => {
    expect(s.daily).toHaveLength(30);
    expect(s.daily.at(-1)!.label).toBe("11-02");
    expect(s.daily.reduce((n, d) => n + d.value, 0)).toBe(4);
  });
  it("handles no data at all", () => {
    const e = buildStats([], jobs, now, T);
    expect(e.totals).toMatchObject({ people: 0, applications: 0, hireRate: null, docsRate: null, avgDaysToHire: null });
    expect(e.leaderboard).toEqual([]);
    expect(e.psych.avg).toBeNull();
  });
});

describe("one row per applicant", () => {
  const apps = [
    app("a1", "p1", "A", "SCREENING", [attempt("KNOWLEDGE", 24, 30), attempt("PSYCHOLOGICAL", 90, 120)]),
    app("a2", "p1", "B", "APPLIED", [attempt("PSYCHOLOGICAL", 90, 120)]),
    app("a3", "p1", "C", "APPLIED"),
    app("a4", "p2", "A", "APPLIED"),
  ];
  it("merges a person's applications into one row with all positions and stages", () => {
    const people = groupByPerson(drillApps(apps, { kind: "all" }, T, now), apps);
    expect(people).toHaveLength(2);
    const p1 = people.find((p) => p.key === "p1")!;
    expect(p1.apps.map((x) => x.app.jobId).sort()).toEqual(["A", "B", "C"]);
    expect(p1.psychological).toBe(75);
    expect(p1.bestCombined).toBe(78);
  });
  it("keeps a person's other applications visible but marks which ones match the list", () => {
    const people = groupByPerson(drillApps(apps, { kind: "stage", value: "SCREENING" }, T, now), apps);
    expect(people).toHaveLength(1);
    expect(people[0].apps.map((x) => [x.app.id, x.match])).toEqual([["a1", true], ["a2", false], ["a3", false]]);
  });
});
