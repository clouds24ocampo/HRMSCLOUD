import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope } from "@/lib/scope";
import { loadDtr, MAX_RANGE_DAYS } from "@/lib/dtr-data";
import { daysBetween, formatTime, addDays } from "@/lib/time";

const cell = (v: string | number | undefined | null) => {
  const s = v == null ? "" : String(v);
  // Quote everything that could be read as a spreadsheet formula, plus commas and quotes.
  return /^[=+\-@]/.test(s) || /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};


export async function GET(req: Request) {
  const me = await requireUser("/dtr");
  const url = new URL(req.url);
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const from = url.searchParams.get("from") ?? "";
  let to = url.searchParams.get("to") ?? "";
  if (!re.test(from) || !re.test(to) || from > to) return new Response("Invalid date range", { status: 400 });
  if (daysBetween(from, to).length > MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS - 1);

  const scope = await employeeScope(me, mine.id);
  const wanted = url.searchParams.get("employee") ?? mine.id;
  // ponytail: one set of queries per person. Fine for a team; batch if an export of thousands is needed.
  // AND, not a spread: a spread of {id} would overwrite the visibility rule.
  const people = await prisma.employee.findMany({ where: { AND: [scope, wanted === "all" ? {} : { id: wanted }] }, select: { id: true }, take: 200 });
  if (people.length === 0) return new Response("Not found", { status: 404 });

  const lines = [
    [
      "Employee no", "Name", "Date", "Shift", "In", "Out",
      "Productive (sec)", "Issues (sec)", "Breaks (sec)", "Productivity (%)",
      "Worked (min)", "Late (min)", "Undertime (min)", "Overtime candidate (min)",
      "Unpaid pauses (min)", "Over pause limit (min)", "Status"
    ].join(",")
  ];
  for (const p of people) {
    const d = await loadDtr(me, mine.id, p.id, from, to, settings.timezone, settings.graceMinutes);
    if (!d) continue;
    for (const r of d.rows) {
      lines.push(
        [
          d.employee.employeeNo, `${d.employee.lastName}, ${d.employee.firstName}`, r.day,
          r.shift ? `${r.shift.startTime}-${r.shift.endTime}` : "",
          r.firstIn ? formatTime(r.firstIn, settings.timezone) : "", r.lastOut ? formatTime(r.lastOut, settings.timezone) : "",
          r.productiveSeconds, r.issueSeconds, r.breakSeconds, `${r.productivityRate}%`,
          r.workedMinutes, r.lateMinutes, r.undertimeMinutes, r.overtimeMinutes, r.breakMinutes, r.overLimitMinutes, r.status,
        ].map(cell).join(","),
      );
    }
  }

  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="dtr-${from}-to-${to}.csv"`, "Cache-Control": "no-store" },
  });
}
