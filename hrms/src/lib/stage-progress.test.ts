import { describe, expect, it } from "vitest";
import { NEXT_STAGE, progressTone, stageProgress, type StageInput } from "./stage-progress";

const now = new Date("2026-11-21T10:00:00Z");
const base: StageInput = {
  stage: "APPLIED", hasAccount: true, docsUploaded: true, exams: { required: 3, done: 3 }, interviewAt: null, now,
  requirements: { done: 12, total: 12 }, policies: { total: 4, signed: 4 }, contract: "SIGNED",
};

describe("stage progress", () => {
  it("applied: account, documents and exams count equally per item", () => {
    const p = stageProgress({ ...base, stage: "APPLIED", docsUploaded: false, exams: { required: 3, done: 1 } });
    expect(p.pct).toBe(Math.round((2 / 5) * 100)); // account + 1 exam of 5 possible points
    expect(p.missing).toEqual(["Resume and valid ID", "Exams handed in"]);
    expect(stageProgress(base).pct).toBe(100);
    expect(stageProgress(base).ready).toBe(true);
  });
  it("screening: exams and documents", () => {
    const p = stageProgress({ ...base, stage: "SCREENING", exams: { required: 3, done: 3 }, docsUploaded: true });
    expect(p).toMatchObject({ pct: 100, ready: true });
    expect(stageProgress({ ...base, stage: "SCREENING", exams: { required: 3, done: 0 } }).pct).toBe(25); // documents only: 1 of 4
  });
  it("interview: 0 before it is scheduled, 50 when scheduled, 100 once the date has passed", () => {
    expect(stageProgress({ ...base, stage: "INTERVIEW" }).pct).toBe(0);
    expect(stageProgress({ ...base, stage: "INTERVIEW", interviewAt: new Date("2026-11-25T09:00:00Z") })).toMatchObject({ pct: 50, ready: false, missing: ["Interview held"] });
    expect(stageProgress({ ...base, stage: "INTERVIEW", interviewAt: new Date("2026-11-20T09:00:00Z") })).toMatchObject({ pct: 100, ready: true });
  });
  it("requirements: documents in over documents required; no account means nothing could be uploaded", () => {
    expect(stageProgress({ ...base, stage: "REQUIREMENTS", requirements: { done: 3, total: 12 } }).pct).toBe(25);
    expect(stageProgress({ ...base, stage: "REQUIREMENTS", requirements: { done: 12, total: 12 } })).toMatchObject({ pct: 100, ready: true });
    expect(stageProgress({ ...base, stage: "REQUIREMENTS", hasAccount: false, requirements: null })).toMatchObject({ pct: 0, ready: false });
  });
  it("orientation and contract: policies, then contract sent, then signed", () => {
    expect(stageProgress({ ...base, stage: "OFFER", policies: { total: 4, signed: 2 }, contract: "NONE" }).pct).toBe(Math.round((2 / 6) * 100));
    expect(stageProgress({ ...base, stage: "OFFER", policies: { total: 4, signed: 4 }, contract: "ISSUED" })).toMatchObject({ pct: 83, ready: false, missing: ["Contract signed"] });
    expect(stageProgress({ ...base, stage: "OFFER" })).toMatchObject({ pct: 100, ready: true });
  });
  it("orientation with no policy to sign leaves only the contract", () => {
    const p = stageProgress({ ...base, stage: "OFFER", policies: { total: 0, signed: 0 }, contract: "NONE" });
    expect(p.items.map((x) => x.label)).toEqual(["Contract sent", "Contract signed"]);
    expect(p.pct).toBe(0);
  });
  it("never goes above 100 or below 0, even with extra signatures", () => {
    expect(stageProgress({ ...base, stage: "OFFER", policies: { total: 2, signed: 9 } }).pct).toBeLessThanOrEqual(100);
    expect(stageProgress({ ...base, stage: "REQUIREMENTS", requirements: { done: 99, total: 12 } }).pct).toBe(100);
  });
  it("knows the next stage and the bar colour", () => {
    expect(NEXT_STAGE.REQUIREMENTS).toBe("OFFER");
    expect(NEXT_STAGE.OFFER).toBe("HIRE");
    expect([0, 49, 50, 99, 100].map(progressTone)).toEqual(["danger", "danger", "warning", "warning", "success"]);
  });
});
