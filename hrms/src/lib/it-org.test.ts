import { describe, expect, it } from "vitest";
import { IT_DEPARTMENTS, IT_POSITIONS, missingItOrg } from "./it-org-data";
import { KNOWLEDGE_BANK } from "./exam-bank";
import { departmentSuggestionsFor, positionSuggestionsFor } from "./defaults";

describe("IT corporation structure", () => {
  const depts = new Set(IT_DEPARTMENTS.map((d) => d.name));
  it("has unique department names and parents that exist, with no loops", () => {
    expect(depts.size).toBe(IT_DEPARTMENTS.length);
    for (const d of IT_DEPARTMENTS) {
      if (!d.parent) continue;
      expect(depts.has(d.parent), `${d.name} -> ${d.parent}`).toBe(true);
      expect(IT_DEPARTMENTS.find((x) => x.name === d.parent)!.parent, `${d.parent} must be a top-level department`).toBeUndefined();
    }
  });
  it("has unique position titles, each in a real department", () => {
    expect(new Set(IT_POSITIONS.map((p) => p.title.toLowerCase())).size).toBe(IT_POSITIONS.length);
    for (const p of IT_POSITIONS) expect(depts.has(p.department), p.title).toBe(true);
  });
  it("gives every department one head, and heads always have a department", () => {
    for (const d of IT_DEPARTMENTS) {
      const heads = IT_POSITIONS.filter((p) => p.department === d.name && (p.level === "DEPT_HEAD" || p.level === "EXECUTIVE"));
      if (!["Executive Office", "Training"].includes(d.name)) expect(heads.length, d.name).toBeGreaterThanOrEqual(1);
    }
    for (const p of IT_POSITIONS.filter((x) => x.level === "DEPT_HEAD" || x.level === "ASSISTANT_HEAD")) expect(p.department, p.title).toBeTruthy();
  });
  it("covers every job opening we post", () => {
    const titles = new Set(IT_POSITIONS.map((p) => p.title));
    for (const job of Object.keys(KNOWLEDGE_BANK)) expect(titles.has(job), job).toBe(true);
  });
  it("counts what is missing", () => {
    expect(missingItOrg([], [])).toEqual({ departments: IT_DEPARTMENTS.length, positions: IT_POSITIONS.length });
    expect(missingItOrg(IT_DEPARTMENTS.map((d) => d.name.toUpperCase()), IT_POSITIONS.map((p) => p.title))).toEqual({ departments: 0, positions: 0 });
  });
  it("is what IT software companies are offered, other industries keep theirs", () => {
    expect(departmentSuggestionsFor("bpo-it", "it-software")).toContain("Cybersecurity");
    expect(positionSuggestionsFor("bpo-it", "it-software").length).toBe(IT_POSITIONS.length);
    expect(departmentSuggestionsFor("bpo-it", "bpo")).not.toContain("Cybersecurity");
  });
});
