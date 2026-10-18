import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { MAX_RANGE_DAYS } from "@/lib/dtr-data";
import { loadDtrReport } from "@/lib/dtr-report";
import { buildDtrPdf } from "@/lib/dtr-pdf";
import { addDays, dayKey, daysBetween } from "@/lib/time";

// DTR report as a PDF: each person's days with time in and out, breaks, issues, hours paid and daily wage, and a total.
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   the period (at most 62 days)
//   ?employee=<id>                   one person (default: you)   |   ?employee=all   everyone you may see
// Wages are pay data: HR sees them for anyone, a person for themselves only. Anyone else gets the DTR without money.
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
  const people = await prisma.employee.findMany({ where: { AND: [scope, wanted === "all" ? { status: { not: "SEPARATED" } } : { id: wanted }] }, select: { id: true }, take: 300 });
  if (people.length === 0) return new Response("Not found", { status: 404 });

  const wages = isHr(me.role.key) || (people.length === 1 && people[0].id === mine.id);
  const report = await loadDtrReport(me.organizationId, me.organization.name, people.map((p) => p.id), from, to, dayKey(new Date(), settings.timezone), settings, wages);
  const pdf = await buildDtrPdf(report);
  await audit(me.id, "dtr_report.downloaded", "DtrReport", undefined, { from, to, people: people.length, wages }, me.organizationId);
  const name = wanted === "all" ? "all" : report.people[0]?.employeeNo.replace(/[^\w-]+/g, "_") ?? "employee";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dtr-${name}-${from}-to-${to}.pdf"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
