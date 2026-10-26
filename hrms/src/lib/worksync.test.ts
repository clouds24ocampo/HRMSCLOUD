import { describe, expect, it } from "vitest";
import { accessLevel, avatarColor, dueState, barSpan, cardProgress, donutGradient, matchesFilters, monthGrid, parseFilters, listForCategory, positionBetween, shiftMonth, summarize, TEMPLATES, timelineRange, type CardFacts } from "./worksync";

const now = Date.parse("2026-10-18T08:00:00Z");
const card = (o: Partial<CardFacts>): CardFacts => ({ category: "TODO", dueDay: null, updatedAt: new Date(now), checkDone: 0, checkTotal: 0, ...o });

describe("progress", () => {
  it("a done card is 100%, others follow their checklist", () => {
    expect(cardProgress({ category: "DONE", checkDone: 0, checkTotal: 3 })).toBe(100);
    expect(cardProgress({ category: "DOING", checkDone: 1, checkTotal: 3 })).toBe(33);
    expect(cardProgress({ category: "DOING", checkDone: 0, checkTotal: 0 })).toBe(0);
  });
  it("project percent, counts, overdue and stuck match a hand count", () => {
    const s = summarize([
      card({ category: "DONE" }),
      card({ category: "DOING", checkDone: 1, checkTotal: 2, dueDay: "2026-10-10" }), // overdue, 50%
      card({ category: "BLOCKED", updatedAt: new Date(now - 4 * 86_400_000) }), // stuck
      card({ category: "TODO", dueDay: "2026-10-18" }), // due today is not overdue
    ], "2026-10-18", now);
    expect(s).toEqual({ total: 4, by: { TODO: 1, DOING: 1, BLOCKED: 1, DONE: 1 }, overdue: 1, stuck: 1, percent: 38 }); // (100+50+0+0)/4 = 37.5
  });
  it("a done card is never overdue or stuck", () => {
    const s = summarize([card({ category: "DONE", dueDay: "2020-01-01", updatedAt: new Date(0) })], "2026-10-18", now);
    expect([s.overdue, s.stuck, s.percent]).toEqual([0, 0, 100]);
  });
  it("an empty board is 0%", () => expect(summarize([], "2026-10-18").percent).toBe(0));
});

describe("access", () => {
  it("HR manages everything, even without membership", () => expect(accessLevel(true, null, false)).toBe("MANAGE"));
  it("follows the project role", () => {
    expect(accessLevel(false, "LEAD", false)).toBe("MANAGE");
    expect(accessLevel(false, "MEMBER", false)).toBe("EDIT");
    expect(accessLevel(false, "VIEWER", false)).toBe("VIEW");
  });
  it("a manager above a member only looks; a stranger sees nothing", () => {
    expect(accessLevel(false, null, true)).toBe("VIEW");
    expect(accessLevel(false, null, false)).toBeNull();
  });
});

describe("ordering and templates", () => {
  it("places a card between neighbours, or at the ends", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(null, 1000)).toBe(0);
    expect(positionBetween(3000, null)).toBe(4000);
    expect(positionBetween(null, null)).toBe(1000);
  });
  it("every template has a done list and a blocked list", () => {
    for (const t of Object.values(TEMPLATES)) {
      expect(t.some((l) => l.category === "DONE")).toBe(true);
      expect(t.some((l) => l.category === "BLOCKED")).toBe(true);
    }
  });
});

describe("filters", () => {
  const c = { title: "SSO login", description: "Azure AD tenant", priority: "HIGH", assigneeIds: ["a"], labelIds: ["bug"] };
  it("matches text in title or description, case-insensitive", () => {
    expect(matchesFilters(c, parseFilters({ q: "azure" }), "me")).toBe(true);
    expect(matchesFilters(c, parseFilters({ q: "invoice" }), "me")).toBe(false);
  });
  it("filters by person, 'me', 'none', label and priority together", () => {
    expect(matchesFilters(c, parseFilters({ who: "a" }), "x")).toBe(true);
    expect(matchesFilters(c, parseFilters({ who: "b" }), "x")).toBe(false);
    expect(matchesFilters(c, parseFilters({ who: "me" }), "a")).toBe(true);
    expect(matchesFilters(c, parseFilters({ who: "none" }), "a")).toBe(false);
    expect(matchesFilters({ ...c, assigneeIds: [] }, parseFilters({ who: "none" }), "a")).toBe(true);
    expect(matchesFilters(c, parseFilters({ label: "bug", pri: "HIGH" }), "a")).toBe(true);
    expect(matchesFilters(c, parseFilters({ label: "bug", pri: "LOW" }), "a")).toBe(false);
  });
  it("ignores an invalid priority", () => expect(parseFilters({ pri: "EVIL" }).pri).toBe(""));
});

describe("timeline", () => {
  it("draws a bar from start to due, a one-day bar for a single date, none for no dates", () => {
    expect(barSpan("2026-10-05", { startDay: "2026-10-07", dueDay: "2026-10-10" })).toEqual({ left: 2, days: 4 });
    expect(barSpan("2026-10-05", { startDay: null, dueDay: "2026-10-06" })).toEqual({ left: 1, days: 1 });
    expect(barSpan("2026-10-05", { startDay: "2026-10-12", dueDay: "2026-10-10" })).toEqual({ left: 5, days: 3 }); // reversed dates are swapped
    expect(barSpan("2026-10-05", { startDay: null, dueDay: null })).toBeNull();
  });
  it("starts on a Monday and covers every date with room to spare", () => {
    const r = timelineRange([{ startDay: "2026-10-20", dueDay: "2026-12-01" }], "2026-10-18");
    expect(r.from).toBe("2026-10-12"); // Monday on or before 15 Oct
    expect(r.days).toBeGreaterThanOrEqual(51 + 10);
    expect(timelineRange([], "2026-10-18").days).toBeGreaterThanOrEqual(28);
  });
});

describe("calendar", () => {
  it("builds whole Monday-first weeks around the month", () => {
    const w = monthGrid("2026-10"); // 1 Oct 2026 is a Thursday, 31 Oct a Saturday
    expect(w[0][0].key).toBe("2026-09-28");
    expect(w[0][3]).toEqual({ key: "2026-10-01", inMonth: true });
    expect(w[w.length - 1][6].key).toBe("2026-11-01");
    expect(w.every((x) => x.length === 7)).toBe(true);
    expect(w.flat().filter((d) => d.inMonth)).toHaveLength(31);
  });
  it("handles December and February", () => {
    expect(monthGrid("2026-12").flat().filter((d) => d.inMonth)).toHaveLength(31);
    expect(monthGrid("2028-02").flat().filter((d) => d.inMonth)).toHaveLength(29);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("charts", () => {
  it("makes a donut from slices and an empty ring from nothing", () => {
    expect(donutGradient([{ value: 1, color: "#a" }, { value: 3, color: "#b" }])).toBe("conic-gradient(#a 0.00% 25.00%, #b 25.00% 100.00%)");
    expect(donutGradient([])).toContain("#e2e8f0");
  });
});

describe("display rules", () => {
  it("colors a due date by how close it is", () => {
    expect(dueState("2026-10-10", "2026-10-18", "DOING")).toBe("overdue");
    expect(dueState("2026-10-18", "2026-10-18", "DOING")).toBe("soon");
    expect(dueState("2026-10-19", "2026-10-18", "TODO")).toBe("soon");
    expect(dueState("2026-10-25", "2026-10-18", "TODO")).toBe("later");
    expect(dueState("2026-10-01", "2026-10-18", "DONE")).toBe("done");
  });
  it("gives a person the same avatar color every time", () => {
    expect(avatarColor("Mark Ocampo")).toBe(avatarColor("Mark Ocampo"));
    expect(avatarColor("Mark Ocampo")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("listForCategory", () => {
  const lists = [{ id: "a", category: "TODO" as const }, { id: "b", category: "DONE" as const }, { id: "c", category: "DONE" as const }];
  it("picks the first list of the category, or nothing", () => {
    expect(listForCategory(lists, "DONE")?.id).toBe("b");
    expect(listForCategory(lists, "BLOCKED")).toBeUndefined();
  });
});
