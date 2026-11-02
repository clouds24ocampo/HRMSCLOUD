import { describe, expect, it } from "vitest";
import { APPLICANT_REQUIREMENTS, buildChecklist, isApplicantRequirement } from "./requirements";
import { canUploadRequirements } from "./stages";
import { reviewAttempt } from "./exam-results";

const d = (title: string, version = 1) => ({ id: `id-${title}`, title, fileName: "x.pdf", version, createdAt: new Date("2026-11-03T00:00:00Z") });

describe("201 file checklist for applicants", () => {
  it("leaves out the contract that HR adds, and accepts only listed titles", () => {
    expect(APPLICANT_REQUIREMENTS.some((r) => r.title === "Signed Employment Contract")).toBe(false);
    expect(isApplicantRequirement("NBI Clearance")).toBe(true);
    expect(isApplicantRequirement("My own made-up document")).toBe(false);
  });
  it("counts required items done, and the sign-up resume covers the resume item", () => {
    const empty = buildChecklist([], false);
    expect(empty.done).toBe(0);
    expect(empty.complete).toBe(false);
    const withResume = buildChecklist([], true);
    expect(withResume.done).toBe(1);
    expect(withResume.items.find((i) => i.title === "Resume / Curriculum Vitae")!.auto).toBe(true);
  });
  it("is complete when every required item has a file", () => {
    const docs = APPLICANT_REQUIREMENTS.filter((r) => r.required).map((r) => d(r.title));
    const c = buildChecklist(docs, false);
    expect(c).toMatchObject({ done: c.total, complete: true });
    expect(buildChecklist(docs.slice(1), false).complete).toBe(false);
  });
});

describe("who may upload", () => {
  it("only once For requirements or Offer", () => {
    expect(canUploadRequirements(["APPLIED", "SCREENING", "INTERVIEW"])).toBe(false);
    expect(canUploadRequirements(["APPLIED", "REQUIREMENTS"])).toBe(true);
    expect(canUploadRequirements(["OFFER"])).toBe(true);
    expect(canUploadRequirements(["REJECTED"])).toBe(false);
  });
});

describe("reviewAttempt", () => {
  const q = (id: string, sort: number, opts: { text: string; points: number }[], trait: string | null = null) => ({ id, text: `Q ${id}`, trait, options: opts, sort });
  const questions = [q("b", 2, [{ text: "x", points: 0 }, { text: "y", points: 1 }]), q("a", 1, [{ text: "p", points: 1 }, { text: "q", points: 0 }])];
  it("marks right, wrong and unanswered knowledge answers in stored order", () => {
    const r = reviewAttempt("KNOWLEDGE", questions, { a: 0, b: 0 });
    expect(r.map((x) => [x.n, x.chosen, x.correct, x.right])).toEqual([[1, "p", "p", true], [2, "x", "y", false]]);
    expect(reviewAttempt("KNOWLEDGE", questions, { a: 1 }).map((x) => [x.chosen, x.right])).toEqual([["q", false], [null, false]]);
  });
  it("shows points for psychological answers and no right/wrong", () => {
    const r = reviewAttempt("PSYCHOLOGICAL", [q("a", 1, [{ text: "yes", points: 4 }, { text: "no", points: 0 }], "Teamwork")], { a: 0 });
    expect(r[0]).toMatchObject({ points: 4, max: 4, right: null, correct: null, trait: "Teamwork" });
  });
});
