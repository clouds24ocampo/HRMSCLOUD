import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { attendanceSummary } from "@/lib/reports";
import { getOrgSettings } from "@/lib/settings";
import { MAX_RANGE_DAYS } from "@/lib/dtr-data";
import { addDays, daysBetween } from "@/lib/time";

const cell = (v: string | number) => {
  const s = String(v);
  return /^[=+\-@]/.test(s) || /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const me = await requireUser("/reports"); // HR only
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  let to = url.searchParams.get("to") ?? "";
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to) || from > to) return new Response("Invalid date range", { status: 400 });
  if (daysBetween(from, to).length > MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS - 1);
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const rows = await attendanceSummary(me, mine.id, from, to, settings.timezone, settings.graceMinutes);
  const lines = [["Employee no", "Name", "Department", "Scheduled days", "Present", "Absent", "Leave", "Late days", "Late (min)", "Undertime (min)", "Overtime candidate (min)", "Worked (min)"].join(",")];
  for (const r of rows) lines.push([r.employeeNo, r.name, r.department, r.scheduled, r.present, r.absent, r.leave, r.lateCount, r.lateMinutes, r.undertimeMinutes, r.overtimeMinutes, r.workedMinutes].map(cell).join(","));
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="attendance-${from}-to-${to}.csv"`, "Cache-Control": "no-store" },
  });
}
