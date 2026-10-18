// The DTR report: for each person, each day with its time in and out, breaks, issues, hours paid, tags and daily wage,
// and the person's total. Built on teamActivity(), so the wages are exactly the payroll's per-day figures.
// Wages are pay data: only HR (or the person themselves) may have them; everyone else gets the DTR without money.
import { prisma } from "@/lib/prisma";
import { teamActivity } from "@/lib/pay-breakdown";
import { rates } from "@/lib/ph/calc";
import { dbDate } from "@/lib/time";

export type ReportDay = {
  day: string; status: string; timeIn: Date | null; timeOut: Date | null;
  breakMinutes: number; issueMinutes: number; paidMinutes: number; lateMinutes: number; undertimeMinutes: number; overtimeMinutes: number;
  flags: string[]; wageCents: number | null;
};
export type ReportTotals = { daysWorked: number; absentDays: number; breakMinutes: number; issueMinutes: number; paidMinutes: number; lateMinutes: number; undertimeMinutes: number; overtimeMinutes: number; wageCents: number | null };
export type ReportPerson = { id: string; employeeNo: string; name: string; department: string | null; hourlyCents: number | null; dailyCents: number | null; days: ReportDay[]; totals: ReportTotals };
export type DtrReport = { organization: string; from: string; to: string; timezone: string; wages: boolean; people: ReportPerson[]; grandWageCents: number | null; generatedAt: Date };

type Settings = { timezone: string; graceMinutes: number; daysPerYear: number; hoursPerDay: number; otMultiplierBp: number };

export async function loadDtrReport(organizationId: string, organization: string, ids: string[], from: string, to: string, today: string, s: Settings, wages: boolean): Promise<DtrReport> {
  const last = to < today ? to : today;
  const [people, activity, comps] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true, employeeNo: true, firstName: true, lastName: true, department: { select: { name: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    teamActivity(organizationId, ids, from, to, today, s),
    wages ? prisma.compensation.findMany({ where: { organizationId, employeeId: { in: ids }, effectiveFrom: { lte: dbDate(last) } }, orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }] }) : [],
  ]);
  const out: ReportPerson[] = people.map((p) => {
    const comp = comps.filter((c) => c.employeeId === p.id).pop();
    const r = comp ? rates(comp.payType, comp.rateCents, s.daysPerYear, s.hoursPerDay) : null;
    const days: ReportDay[] = (activity.get(p.id) ?? []).map((d) => {
      const ins = d.stamps.filter((e) => e.type === "IN");
      const outs = d.stamps.filter((e) => e.type === "OUT");
      const flags: string[] = [];
      if (d.status === "ABSENT") flags.push("Absent");
      if (d.status === "LEAVE") flags.push("On leave");
      if (d.status === "INCOMPLETE") flags.push("No time out yet");
      if (d.systemTimeout) flags.push("System time-out");
      if (d.recoveredMinutes > 0) flags.push(`Recovered ${d.recoveredMinutes}m`);
      if (d.overtimeMinutes - d.approvedOtMinutes - d.recoveredMinutes > 0) flags.push("Extra time not approved");
      if (d.noLocation > 0) flags.push(`${d.noLocation} without location`);
      return {
        day: d.day, status: d.status, timeIn: ins[0]?.at ?? null, timeOut: outs.at(-1)?.at ?? null,
        breakMinutes: d.breakMinutes, issueMinutes: d.issueMinutes, paidMinutes: d.paidMinutes, lateMinutes: d.lateMinutes, undertimeMinutes: d.undertimeMinutes,
        overtimeMinutes: d.approvedOtMinutes, flags, wageCents: wages ? d.dayCents : null,
      };
    });
    const sum = (f: (d: ReportDay) => number) => days.reduce((n, d) => n + f(d), 0);
    return {
      id: p.id, employeeNo: p.employeeNo, name: `${p.lastName}, ${p.firstName}`, department: p.department?.name ?? null,
      hourlyCents: r ? r.hourly : null, dailyCents: r ? r.daily : null, days,
      totals: {
        daysWorked: days.filter((d) => d.timeIn).length, absentDays: days.filter((d) => d.status === "ABSENT").length,
        breakMinutes: sum((d) => d.breakMinutes), issueMinutes: sum((d) => d.issueMinutes), paidMinutes: sum((d) => d.paidMinutes), lateMinutes: sum((d) => d.lateMinutes),
        undertimeMinutes: sum((d) => d.undertimeMinutes), overtimeMinutes: sum((d) => d.overtimeMinutes), wageCents: wages ? sum((d) => d.wageCents ?? 0) : null,
      },
    };
  });
  return { organization, from, to, timezone: s.timezone, wages, people: out, grandWageCents: wages ? out.reduce((n, p) => n + (p.totals.wageCents ?? 0), 0) : null, generatedAt: new Date() };
}
