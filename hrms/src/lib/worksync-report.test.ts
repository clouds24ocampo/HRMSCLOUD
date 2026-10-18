import { describe, expect, it } from "vitest";
import { burnUp, cardContributors, cycleTime, dailySeries, formatHours, personReport, rangeOf, type RCard, type REvent } from "./worksync-report";

const TZ = "Asia/Manila";
const at = (day: string, hm = "10:00") => new Date(`${day}T${hm}:00+08:00`);
const R = { from: "2026-10-12", to: "2026-10-18" };
const card = (o: Partial<RCard>): RCard => ({ id: "c", projectId: "p", title: "t", listName: "To do", category: "TODO", createdById: "ana", createdAt: at("2026-10-12"), completedById: null, completedAt: null, dueDay: null, progress: 0, assigneeKeys: [], ...o });
const ev = (o: Partial<REvent>): REvent => ({ actorId: "ana", type: "MOVED", detail: null, createdAt: at("2026-10-13"), cardId: "c", ...o });

const cards: RCard[] = [
  card({ id: "a", createdById: "ana", createdAt: at("2026-10-12"), category: "DONE", completedById: "ben", completedAt: at("2026-10-14"), dueDay: "2026-10-15", progress: 100, assigneeKeys: ["ben"] }), // on time
  card({ id: "b", createdById: "ana", createdAt: at("2026-10-13"), category: "DONE", completedById: "ben", completedAt: at("2026-10-17"), dueDay: "2026-10-15", progress: 100, assigneeKeys: ["ben", "cy"] }), // late
  card({ id: "c", createdById: "ben", createdAt: at("2026-10-01"), category: "DOING", dueDay: "2026-10-10", progress: 50, assigneeKeys: ["cy"] }), // before the range, overdue
  card({ id: "d", createdById: "cy", createdAt: at("2026-10-16"), category: "TODO", progress: 0, assigneeKeys: [] }),
];
const events: REvent[] = [
  ev({ actorId: "ben", type: "DONE", cardId: "a", createdAt: at("2026-10-14") }),
  ev({ actorId: "ben", type: "COMMENTED", cardId: "a", createdAt: at("2026-10-14", "11:00") }),
  ev({ actorId: "ben", type: "CHECKED", detail: "done: Step 1", cardId: "b", createdAt: at("2026-10-15") }),
  ev({ actorId: "ben", type: "CHECKED", detail: "reopened: Step 1", cardId: "b", createdAt: at("2026-10-15", "12:00") }),
  ev({ actorId: "cy", type: "MOVED", cardId: "c", createdAt: at("2026-10-16") }),
  ev({ actorId: "cy", type: "EDITED", cardId: "c", createdAt: at("2026-10-16", "09:00") }),
  ev({ actorId: "cy", type: "MOVED", cardId: "c", createdAt: at("2026-10-01") }), // outside the range
];

describe("personReport", () => {
  const rows = personReport(cards, events, R, TZ, "2026-10-18");
  const by = (k: string) => rows.find((r) => r.key === k)!;
  it("counts who added and who resolved, inside the range only", () => {
    expect([by("ana").added, by("ben").added, by("cy").added]).toEqual([2, 0, 1]); // ben's card c was added before the range
    expect([by("ben").resolved, by("ben").resolvedOnTime]).toEqual([2, 1]);
    expect(by("ana").resolved).toBe(0);
  });
  it("counts what each person is working on right now, overdue and progress", () => {
    expect([by("ben").assignedDone, by("ben").assignedOpen]).toEqual([2, 0]);
    expect([by("cy").assignedOpen, by("cy").assignedDone, by("cy").overdue]).toEqual([1, 1, 1]);
    expect(by("cy").avgProgress).toBe(75); // (50 + 100) / 2
  });
  it("counts actions by kind and active days; a reopened step is not a finished step", () => {
    expect([by("ben").comments, by("ben").moves, by("ben").steps, by("ben").activeDays]).toEqual([1, 1, 1, 2]);
    expect([by("cy").moves, by("cy").edits, by("cy").activeDays]).toEqual([1, 1, 1]); // the 1 Oct move is outside
  });
  it("ranks by cards resolved", () => expect(rows[0].key).toBe("ben"));
});

describe("series", () => {
  it("daily added and resolved add up to the totals", () => {
    const s = dailySeries(cards, R, TZ);
    expect(s).toHaveLength(7);
    expect(s.reduce((n, d) => n + d.added, 0)).toBe(3);
    expect(s.reduce((n, d) => n + d.resolved, 0)).toBe(2);
    expect(s.find((d) => d.day === "2026-10-14")).toEqual({ day: "2026-10-14", added: 0, resolved: 1 });
  });
  it("burn-up is cumulative and includes work from before the range", () => {
    const b = burnUp(cards, R, TZ);
    expect(b[0]).toEqual({ day: "2026-10-12", created: 2, done: 0 }); // card c (1 Oct) and a (12 Oct)
    expect(b[6]).toEqual({ day: "2026-10-18", created: 4, done: 2 });
  });
  it("a day near midnight belongs to the company time zone, not UTC", () => {
    const late = card({ createdAt: new Date("2026-10-12T17:30:00Z") }); // 01:30 on the 13th in Manila
    expect(dailySeries([late], R, TZ).find((d) => d.day === "2026-10-13")!.added).toBe(1);
  });
});

describe("cycle time and contributors", () => {
  it("averages and takes the median hours from added to resolved", () => {
    const c = cycleTime(cards, R, TZ)!;
    expect(c.n).toBe(2);
    expect(c.avgHours).toBeCloseTo((48 + 96) / 2, 5); // 12th to 14th, 13th to 17th
    expect(c.medianHours).toBeCloseTo(72, 5);
    expect(cycleTime([], R, TZ)).toBeNull();
    expect(formatHours(0.5)).toBe("30 min");
    expect(formatHours(5)).toBe("5 h");
    expect(formatHours(72)).toBe("3 days");
  });
  it("lists everyone who touched a card with what they did", () => {
    const list = cardContributors(cards[0], events);
    const ben = list.find((x) => x.actorId === "ben")!;
    expect([ben.resolved, ben.assigned, ben.comments, ben.actions]).toEqual([true, true, 1, 2]);
    expect(list.find((x) => x.actorId === "ana")!.created).toBe(true);
  });
  it("makes a range ending today", () => expect(rangeOf("2026-10-18", 7)).toEqual(R));
});
