// Numbers for the Reports page. Everything comes from the same sources as the rest of the system (DTR engine, payslips),
// so a report can never disagree with the screen it summarizes.
import { prisma } from "@/lib/prisma";
import { loadDtr } from "@/lib/dtr-data";
import type { Actor } from "@/lib/scope";

export type AttendanceRow = {
  employeeId: string;
  employeeNo: string;
  name: string;
  department: string;
  scheduled: number;
  present: number;
  absent: number;
  leave: number;
  lateCount: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  workedMinutes: number;
  productiveSeconds: number;
  issueSeconds: number;
  breakSeconds: number;
  productivityRate: number;
};

// ponytail: one DTR load per person. Fine for a few hundred people; precompute daily rows if a report needs thousands.
export async function attendanceSummary(me: Actor, myEmployeeId: string, from: string, to: string, tz: string, grace: number): Promise<AttendanceRow[]> {
  const people = await prisma.employee.findMany({
    where: { organizationId: me.organizationId, status: { in: ["ACTIVE", "ON_LEAVE", "SUSPENDED"] } },
    select: { id: true, employeeNo: true, firstName: true, lastName: true, department: { select: { name: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 300,
  });
  const out: AttendanceRow[] = [];
  for (const p of people) {
    const d = await loadDtr(me, myEmployeeId, p.id, from, to, tz, grace);
    if (!d) continue;
    const r = d.rows;
    const prodSec = r.reduce((n, x) => n + (x.productiveSeconds ?? 0), 0);
    const issueSec = r.reduce((n, x) => n + (x.issueSeconds ?? 0), 0);
    const breakSec = r.reduce((n, x) => n + (x.breakSeconds ?? 0), 0);
    const activeSec = prodSec + issueSec;
    const prodRate = activeSec > 0 ? Math.round((prodSec / activeSec) * 1000) / 10 : (prodSec > 0 ? 100 : 0);

    out.push({
      employeeId: p.id,
      employeeNo: p.employeeNo,
      name: `${p.lastName}, ${p.firstName}`,
      department: p.department?.name ?? "No department",
      scheduled: r.filter((x) => x.shift).length,
      present: r.filter((x) => x.status === "PRESENT" || x.status === "INCOMPLETE").length,
      absent: r.filter((x) => x.status === "ABSENT").length,
      leave: r.filter((x) => x.status === "LEAVE").length,
      lateCount: r.filter((x) => x.lateMinutes > 0).length,
      lateMinutes: r.reduce((n, x) => n + x.lateMinutes, 0),
      undertimeMinutes: r.reduce((n, x) => n + x.undertimeMinutes, 0),
      overtimeMinutes: r.reduce((n, x) => n + x.overtimeMinutes, 0),
      workedMinutes: r.reduce((n, x) => n + x.workedMinutes, 0),
      productiveSeconds: prodSec,
      issueSeconds: issueSec,
      breakSeconds: breakSec,
      productivityRate: prodRate,
    });
  }
  return out;
}


export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
