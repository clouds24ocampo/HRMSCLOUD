import { describe, expect, it } from "vitest";
import { buildPipeline, templateFits, type PipelineInput } from "./hiring-pipeline";

const ready: PipelineInput = {
  hasAccount: true, exams: { required: 3, done: 3 }, stage: "OFFER", requirements: { done: 8, total: 8 }, policies: { total: 4, signed: 4 }, contract: "SIGNED",
};

describe("hiring pipeline", () => {
  it("is ready when every step before hiring is done", () => {
    const p = buildPipeline(ready);
    expect(p.ready).toBe(true);
    expect(p.missing).toEqual([]);
    expect(p.current).toBe("hired");
    expect(p.steps.map((s) => s.key)).toEqual(["account", "exams", "interview", "requirements", "orientation", "contract", "hired"]);
  });
  it("names exactly what is missing, in order", () => {
    const p = buildPipeline({ ...ready, exams: { required: 3, done: 2 }, requirements: { done: 5, total: 8 }, policies: { total: 4, signed: 1 }, contract: "ISSUED" });
    expect(p.ready).toBe(false);
    expect(p.missing).toEqual(["Exams", "Requirements (201 file)", "Orientation and policies", "Contract"]);
    expect(p.current).toBe("exams");
  });
  it("blocks someone with no account (nothing can be taken or uploaded)", () => {
    const p = buildPipeline({ ...ready, hasAccount: false, exams: { required: 0, done: 0 }, requirements: null, contract: "NONE" });
    expect(p.ready).toBe(false);
    expect(p.missing).toContain("Applicant account");
    expect(p.missing).toContain("Requirements (201 file)");
    expect(p.current).toBe("account");
  });
  it("needs the interview passed: before Requirements the stage is not past the interview", () => {
    for (const stage of ["APPLIED", "SCREENING", "INTERVIEW"]) expect(buildPipeline({ ...ready, stage }).missing).toEqual(["Interview"]);
    for (const stage of ["REQUIREMENTS", "OFFER"]) expect(buildPipeline({ ...ready, stage }).ready).toBe(true);
  });
  it("a contract that is only sent does not count; only a signed one does", () => {
    expect(buildPipeline({ ...ready, contract: "NONE" }).missing).toEqual(["Contract"]);
    expect(buildPipeline({ ...ready, contract: "ISSUED" }).missing).toEqual(["Contract"]);
    expect(buildPipeline({ ...ready, contract: "SIGNED" }).ready).toBe(true);
  });
  it("no policy to sign counts as done, and signed beyond the total does not overflow the text", () => {
    expect(buildPipeline({ ...ready, policies: { total: 0, signed: 0 } }).steps[4].done).toBe(true);
    expect(buildPipeline({ ...ready, policies: { total: 2, signed: 5 } }).steps[4].detail).toBe("2 of 2 policies signed");
  });
  it("marks Hired done once hired", () => {
    const p = buildPipeline({ ...ready, stage: "HIRED" });
    expect(p.steps[6].done).toBe(true);
    expect(p.current).toBe("hired");
  });
});

describe("contract templates by engagement", () => {
  it("employees get regular or probationary, subcontractors get consultant or project based", () => {
    expect(templateFits("EMPLOYEE", "PROBATIONARY")).toBe(true);
    expect(templateFits("EMPLOYEE", "CONSULTANT")).toBe(false);
    expect(templateFits("SUBCONTRACTOR", "PROJECT_BASED")).toBe(true);
    expect(templateFits("SUBCONTRACTOR", "REGULAR")).toBe(false);
  });
});
