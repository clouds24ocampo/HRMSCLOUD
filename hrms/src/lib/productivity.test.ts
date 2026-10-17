import { describe, expect, it } from "vitest";
import { buildDtr, type Punch, type ShiftTimes, type StampInfo } from "./dtr";
import { aggregateByDay, aggregateByMonth, aggregateByWeek, summarizeProductivity } from "./productivity";
import { zonedTimeToUtc } from "./time";

const TZ = "Asia/Manila";
const at = (day: string, hm: string, s = "00") =>
  new Date(zonedTimeToUtc(day, Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)), TZ).getTime() + Number(s) * 1000);

const dayShift: ShiftTimes = { startTime: "08:00", endTime: "17:00", breakMinutes: 60 };
const MEAL: StampInfo = { id: "meal", name: "Meal", paid: false, allowedMinutes: 60, category: "BREAK" };
const BREAK: StampInfo = { id: "brk", name: "Break 1", paid: true, allowedMinutes: 15, category: "BREAK" };
const ISSUE: StampInfo = { id: "issue", name: "System Issue", paid: true, allowedMinutes: null, page: "ISSUE", category: "ISSUE" };

const p = (type: Punch["type"], d: string, hm: string, s = "00", stamp?: StampInfo): Punch => ({
  type,
  at: at(d, hm, s),
  stamp,
});

describe("productivity and seconds tracking", () => {
  it("records exact seconds for punches, pauses, and work time", () => {
    // 08:00:15 In
    // 10:00:00 - 10:15:30 Break 1 (15m 30s)
    // 12:00:00 - 13:00:00 Meal (60m)
    // 14:00:00 - 14:45:20 System Issue (45m 20s)
    // 17:01:45 Out
    const punches: Punch[] = [
      p("IN", "2026-10-05", "08:00", "15"),
      p("PAUSE_START", "2026-10-05", "10:00", "00", BREAK),
      p("PAUSE_END", "2026-10-05", "10:15", "30", BREAK),
      p("PAUSE_START", "2026-10-05", "12:00", "00", MEAL),
      p("PAUSE_END", "2026-10-05", "13:00", "00", MEAL),
      p("PAUSE_START", "2026-10-05", "14:00", "00", ISSUE),
      p("PAUSE_END", "2026-10-05", "14:45", "20", ISSUE),
      p("OUT", "2026-10-05", "17:01", "45"),
    ];

    const rows = buildDtr({
      days: ["2026-10-05"],
      punches,
      schedule: new Map([["2026-10-05", dayShift]]),
      leaveDays: new Set(),
      today: "2026-10-10",
      tz: TZ,
      graceMinutes: 10,
    });

    expect(rows).toHaveLength(1);
    const r = rows[0];

    // Total gross logged: 08:00:15 to 17:01:45 = 9h 1m 30s = 32490 seconds
    expect(r.grossSeconds).toBe(32490);

    // Break 1 = 930s (15m 30s)
    // Meal = 3600s (60m)
    // System Issue = 2720s (45m 20s)
    expect(r.issueSeconds).toBe(2720);
    expect(r.breakSeconds).toBe(930 + 3600);

    // Productive work = gross logged - breaks - issues
    // 32490 - 4530 - 2720 = 25240s
    expect(r.productiveSeconds).toBe(25240);
    expect(r.productiveMinutes).toBe(Math.floor(25240 / 60));

    // Pauses breakdown has exact seconds
    const brkPause = r.pauses.find((x) => x.name === "Break 1");
    expect(brkPause?.seconds).toBe(930);
    expect(brkPause?.category).toBe("BREAK");

    const issuePause = r.pauses.find((x) => x.name === "System Issue");
    expect(issuePause?.seconds).toBe(2720);
    expect(issuePause?.category).toBe("ISSUE");

    // Productivity rate % = productive / (productive + issue)
    // 25240 / (25240 + 2720) = 25240 / 27960 = 90.27...% -> 90.3%
    expect(r.productivityRate).toBe(90.3);
  });

  it("automatically aggregates productivity by day, week, and month", () => {
    // 3 days across 2 weeks in October 2026
    const punches: Punch[] = [
      // Day 1: 2026-10-05 (Monday, Week 1)
      p("IN", "2026-10-05", "08:00"),
      p("OUT", "2026-10-05", "16:00"), // 8h = 28800s productive, 0 issue

      // Day 2: 2026-10-06 (Tuesday, Week 1) - with 1h issue
      p("IN", "2026-10-06", "08:00"),
      p("PAUSE_START", "2026-10-06", "10:00", "00", ISSUE),
      p("PAUSE_END", "2026-10-06", "11:00", "00", ISSUE),
      p("OUT", "2026-10-06", "16:00"), // 7h productive = 25200s, 1h issue = 3600s

      // Day 3: 2026-10-12 (Monday, Week 2)
      p("IN", "2026-10-12", "08:00"),
      p("OUT", "2026-10-12", "16:00"), // 8h = 28800s productive, 0 issue
    ];

    const days = ["2026-10-05", "2026-10-06", "2026-10-12"];
    const rows = buildDtr({
      days,
      punches,
      schedule: new Map(days.map((d) => [d, dayShift])),
      leaveDays: new Set(),
      today: "2026-10-20",
      tz: TZ,
      graceMinutes: 10,
    });

    // 1. Overall Summary
    const summary = summarizeProductivity(rows);
    expect(summary.totalDays).toBe(3);
    expect(summary.presentDays).toBe(3);
    expect(summary.productiveSeconds).toBe(28800 + 25200 + 28800);
    expect(summary.issueSeconds).toBe(3600);
    // Productivity rate = (28800 + 25200 + 28800) / (28800 + 25200 + 28800 + 3600) = 82800 / 86400 = 95.8%
    expect(summary.productivityRate).toBe(95.8);

    // 2. Day aggregation
    const dayStats = aggregateByDay(rows);
    expect(dayStats).toHaveLength(3);
    expect(dayStats[0].productiveSeconds).toBe(28800);
    expect(dayStats[0].issueSeconds).toBe(0);
    expect(dayStats[0].productivityRate).toBe(100);

    expect(dayStats[1].productiveSeconds).toBe(25200);
    expect(dayStats[1].issueSeconds).toBe(3600);
    expect(dayStats[1].productivityRate).toBe(87.5); // 25200 / 28800 = 87.5%

    // 3. Week aggregation
    const weeks = aggregateByWeek(rows);
    expect(weeks).toHaveLength(2);
    // Week 1 has 2 days
    expect(weeks[0].days).toHaveLength(2);
    expect(weeks[0].summary.issueSeconds).toBe(3600);
    expect(weeks[0].summary.productiveSeconds).toBe(54000);
    // Week 2 has 1 day
    expect(weeks[1].days).toHaveLength(1);
    expect(weeks[1].summary.issueSeconds).toBe(0);
    expect(weeks[1].summary.productivityRate).toBe(100);

    // 4. Month aggregation
    const months = aggregateByMonth(rows);
    expect(months).toHaveLength(1);
    expect(months[0].key).toBe("2026-10");
    expect(months[0].summary.presentDays).toBe(3);
    expect(months[0].summary.issueSeconds).toBe(3600);
    expect(months[0].summary.productivityRate).toBe(95.8);
  });
});
