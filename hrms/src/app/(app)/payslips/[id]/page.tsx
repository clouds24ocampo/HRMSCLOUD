import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { isHr } from "@/lib/scope";
import { formatDay, formatDuration, keyOfDbDate } from "@/lib/time";
import type { Attendance } from "@/lib/payroll";
import { Badge, Card } from "@/components/ui";
import { PrintButton } from "./PrintButton";

type Inputs = { payType: string; rateCents: number; attendance: Attendance; warnings?: string[]; ph?: unknown };
const PAY_TYPE = { MONTHLY: "per month", DAILY: "per day", HOURLY: "per hour" } as const;

function LineTable({ title, rows }: { title: string; rows: { id: string; label: string; detail: string | null; amountCents: number }[] }) {
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">None.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {rows.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-4 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium">{l.label}</p>
                {l.detail && <p className="text-xs text-muted">{l.detail}</p>}
              </div>
              <p className="shrink-0 font-medium tabular-nums">{formatMoney(l.amountCents)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser("/payslips");
  const s = await prisma.payslip.findFirst({
    where: { id, organizationId: me.organizationId },
    include: { lines: { orderBy: { sortOrder: "asc" } }, period: true, employee: { select: { userId: true } } },
  });
  if (!s) notFound();
  const hr = isHr(me.role.key);
  const own = s.employee.userId === me.id;
  // HR sees any payslip, even a draft. An employee sees only their own, and only once payroll is final.
  if (!hr && !(own && s.period.status === "FINALIZED")) notFound();

  const inputs = s.inputs as unknown as Inputs;
  const a = inputs.attendance;
  const earnings = s.lines.filter((l) => l.kind === "EARNING");
  const deductions = s.lines.filter((l) => l.kind === "DEDUCTION");
  const employer = s.lines.filter((l) => l.kind === "EMPLOYER");
  const fmt = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href={hr ? `/payroll/${s.periodId}` : "/payslips"} className="text-sm font-medium text-muted hover:text-ink">← Back</Link>
        <PrintButton />
      </div>

      {s.period.status !== "FINALIZED" && (
        <div role="status" className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm font-medium text-warning print:hidden">
          Draft: payroll for this period is not final yet, so these numbers can still change.
        </div>
      )}

      <Card className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Payslip · {s.period.name}</p>
            <h1 className="text-2xl font-bold tracking-tight">{s.employeeName}</h1>
            <p className="text-sm text-muted">{s.employeeNo} · {fmt(s.period.startDate)} – {fmt(s.period.endDate)} · pay day {fmt(s.period.payDate)}</p>
          </div>
          <Badge tone={s.period.status === "FINALIZED" ? "success" : "warning"}>{s.period.status === "FINALIZED" ? "Final" : "Draft"}</Badge>
        </div>

        <div className="rounded-2xl bg-brand/10 p-5 text-center">
          <p className="text-sm text-muted">Net pay</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">{formatMoney(s.netCents)}</p>
          <p className="mt-1 text-sm text-muted">Gross {formatMoney(s.grossCents)} − deductions {formatMoney(s.deductionsCents)}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <LineTable title="Earnings" rows={earnings} />
          <LineTable title="Deductions" rows={deductions} />
        </div>
        {hr && employer.length > 0 && <LineTable title="Employer cost (not deducted from pay)" rows={employer} />}

        <div>
          <h3 className="mb-2 font-semibold">How this was worked out</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {[
              ["Pay rate", `${formatMoney(inputs.rateCents)} ${PAY_TYPE[inputs.payType as keyof typeof PAY_TYPE] ?? ""}`],
              ["Scheduled days", a.scheduledDays],
              ["Days worked", a.presentDays],
              ["Absent days", a.absentDays],
              ["Paid leave days", a.paidLeaveDays],
              ["Unpaid leave days", a.unpaidLeaveDays],
              ["Late", formatDuration(a.lateMinutes)],
              ["Undertime", formatDuration(a.undertimeMinutes)],
              ["Approved overtime", formatDuration(a.approvedOvertimeMinutes)],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-2 border-b border-line py-1"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          {hr && inputs.ph !== undefined && (
            <>
              <h3 className="mb-2 mt-4 font-semibold">Tax summary</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                {[
                  ["Taxable pay", formatMoney(s.taxableCents)],
                  ["Non-taxable pay", formatMoney(s.nonTaxableCents)],
                  ["Minimum wage exempt", formatMoney(s.mweExemptCents)],
                  ["Contributions and pre-tax", formatMoney(s.mandatoryEeCents)],
                  ["13th month and benefits exempt", formatMoney(s.benefitsExemptCents)],
                  ["Taxable benefits", formatMoney(s.benefitsTaxableCents)],
                  ["Tax withheld", formatMoney(s.taxWithheldCents)],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between gap-2 border-b border-line py-1"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
              </dl>
            </>
          )}
          {hr && (inputs.warnings ?? []).map((w) => <p key={w} className="mt-2 text-sm text-warning">{w}</p>)}
          <p className="mt-3 text-xs text-muted">Every line above shows its calculation. The inputs are saved with the payslip, so it can always be explained, even if records change later.</p>
        </div>
      </Card>
    </div>
  );
}
