import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const cell = (v: string | number) => {
  const s = String(v);
  return /^[=+\-@]/.test(s) || /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const pesos = (c: number) => (c / 100).toFixed(2);

// Bank/accounting hand-off for one period. HR only (same rule as the Payroll pages).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/payroll");
  const p = await prisma.payrollPeriod.findFirst({
    where: { id, organizationId: me.organizationId },
    include: { payslips: { orderBy: { employeeName: "asc" } } },
  });
  if (!p) return new Response("Not found", { status: 404 });
  const lines = [["Employee no", "Name", "Gross", "Deductions", "Net", "Employer cost", "Status"].join(",")];
  for (const s of p.payslips) lines.push([s.employeeNo, s.employeeName, pesos(s.grossCents), pesos(s.deductionsCents), pesos(s.netCents), pesos(s.employerCostCents), p.status].map(cell).join(","));
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payroll-${p.name.replace(/[^a-z0-9]+/gi, "-")}.csv"`, "Cache-Control": "no-store" },
  });
}
