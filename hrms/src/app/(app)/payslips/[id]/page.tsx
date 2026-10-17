import { regularMinutesOf } from "@/lib/payroll";
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
import { AnswerPayoutForm, RecordPayoutForm } from "./PayoutForms";

type Inputs = {
  payType: string; rateCents: number; attendance: Attendance; warnings?: string[]; ph?: unknown;
  factors?: { payByLoggedHours?: boolean };
  statutoryDeducted?: boolean; govNotDeducted?: { label: string; cents: number }[]; // stored since contributions became optional
};
type Ded = { id: string; code: string; label: string; detail: string | null; amountCents: number };
type Group = "Government" | "Cash advance" | "Attendance" | "Other";
const groupOf = (l: { code: string; label: string }): Group =>
  l.code === "CONTRIBUTION" || l.code === "TAX" || l.code === "TAX_ADJUSTMENT" ? "Government"
  : l.label === "Cash advance repayment" ? "Cash advance"
  : ["LATE", "UNDERTIME", "ABSENCE", "UNPAID_LEAVE"].includes(l.code) ? "Attendance" : "Other";
const GROUP_TITLE: Record<Group, string> = { Government: "Government contributions and tax", "Cash advance": "Cash advance", Attendance: "Tardiness and absences", Other: "Other deductions" };

// Every deduction by kind, what was not deducted (for information, not counted), and the total at the bottom.
function DeductionSummary({ lines, notDeducted, statutoryDeducted, a, byHours, total, net }: {
  lines: Ded[]; notDeducted: { label: string; cents: number }[]; statutoryDeducted: boolean | undefined; a: Attendance; byHours: boolean; total: number; net: number;
}) {
  const lostTime = a.lateMinutes + a.undertimeMinutes;
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Deductions</h3>
      {(["Government", "Cash advance", "Attendance", "Other"] as const).map((g) => {
        const rows = lines.filter((l) => groupOf(l) === g);
        const extra = g === "Government" && rows.length === 0 ? notDeducted.filter((n) => n.cents > 0) : [];
        const info = g === "Attendance" && byHours && lostTime > 0 && rows.length === 0;
        if (!rows.length && !extra.length && !info && g !== "Government") return null;
        return (
          <div key={g}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{GROUP_TITLE[g]}</p>
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {rows.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-4 px-3 py-2">
                  <span className="min-w-0"><span className="font-medium">{l.label}</span> <Badge tone="danger">Deducted</Badge>{l.detail && <span className="block text-xs text-muted">{l.detail}</span>}</span>
                  <span className="shrink-0 font-medium tabular-nums">−{formatMoney(l.amountCents)}</span>
                </li>
              ))}
              {extra.map((n) => (
                <li key={n.label} className="flex items-start justify-between gap-4 px-3 py-2 text-muted">
                  <span><span className="font-medium">{n.label}</span> <Badge>Not deducted</Badge><span className="block text-xs">Government contributions are optional for now (company setting). Shown for information only.</span></span>
                  <span className="shrink-0 tabular-nums line-through">{formatMoney(n.cents)}</span>
                </li>
              ))}
              {g === "Government" && rows.length === 0 && extra.length === 0 && (
                <li className="px-3 py-2 text-muted">{statutoryDeducted === false ? "Not deducted: government contributions are optional for now." : "None in this period."}</li>
              )}
              {info && (
                <li className="px-3 py-2 text-muted">
                  <span className="font-medium">Late {formatDuration(a.lateMinutes) || "0m"} · undertime {formatDuration(a.undertimeMinutes) || "0m"}</span> <Badge>Not deducted</Badge>
                  <span className="block text-xs">Pay counts only the hours logged, so this time was simply not paid. Nothing more is taken.</span>
                </li>
              )}
            </ul>
          </div>
        );
      })}
      <div className="rounded-xl border-2 border-line">
        <div className="flex justify-between px-3 py-2 text-sm"><span className="font-semibold">Total deductions</span><span className="font-bold tabular-nums">−{formatMoney(total)}</span></div>
        <div className="flex justify-between border-t border-line px-3 py-2"><span className="font-semibold">Net pay to receive</span><span className="text-lg font-bold tabular-nums">{formatMoney(net)}</span></div>
      </div>
    </div>
  );
}
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
  const payouts = await prisma.payout.findMany({ where: { payslipId: s.id, organizationId: me.organizationId }, orderBy: { createdAt: "desc" } });
  const latest = payouts[0];

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
          <DeductionSummary
            lines={deductions} notDeducted={inputs.govNotDeducted ?? []} statutoryDeducted={inputs.statutoryDeducted} a={a}
            byHours={!!inputs.factors?.payByLoggedHours && inputs.payType === "MONTHLY"} total={s.deductionsCents} net={s.netCents}
          />
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
              ["Hours logged (paid)", formatDuration(regularMinutesOf(a)) || "0m"],
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

      {s.period.status === "FINALIZED" && (hr || own) && (
        <Card className="space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Payment received</h2>
            {latest ? (
              <Badge tone={latest.status === "CONFIRMED" ? "success" : latest.status === "DISPUTED" ? "danger" : "warning"}>
                {latest.status === "CONFIRMED" ? "Confirmed by employee" : latest.status === "DISPUTED" ? "Problem reported" : "Waiting for employee"}
              </Badge>
            ) : <Badge>Not recorded yet</Badge>}
          </div>
          {latest ? (
            <div className="space-y-2 text-sm">
              <p><span className="text-2xl font-bold tabular-nums">{formatMoney(latest.amountCents)}</span> {latest.method}{latest.reference ? ` · ref ${latest.reference}` : ""} · paid {fmt(latest.paidOn)}</p>
              {latest.amountCents !== s.netCents && <p className="font-semibold text-warning">Differs from the net pay ({formatMoney(s.netCents)}) by {formatMoney(Math.abs(s.netCents - latest.amountCents))}.</p>}
              {latest.proofKey
                ? <a href={`/payslips/${s.id}/proof/${latest.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">Open proof of payment ({latest.proofName})</a>
                : <p className="text-muted">No proof uploaded.</p>}
              {latest.status !== "WAITING" && (
                <p className="text-muted">{latest.status === "CONFIRMED" ? "Employee confirmed" : "Employee reported a problem"} on {latest.answeredAt?.toISOString().slice(0, 10)}{latest.employeeNote ? `: “${latest.employeeNote}”` : "."}</p>
              )}
              {own && latest.status === "WAITING" && <AnswerPayoutForm payoutId={latest.id} amount={formatMoney(latest.amountCents)} />}
            </div>
          ) : (
            <p className="text-sm text-muted">{hr ? "Record what was actually paid, with proof. The employee is then asked to confirm." : "HR has not recorded the payment yet."}</p>
          )}
          {hr && (
            <details open={!latest || latest.status === "DISPUTED"}>
              <summary className="cursor-pointer text-sm font-semibold text-brand">{latest ? "Record a new payment (the earlier record is kept)" : "Record payment"}</summary>
              <div className="mt-3"><RecordPayoutForm payslipId={s.id} net={(s.netCents / 100).toFixed(2)} today={new Date().toISOString().slice(0, 10)} /></div>
            </details>
          )}
          {payouts.length > 1 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-muted">Earlier records ({payouts.length - 1})</summary>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {payouts.slice(1).map((p) => <li key={p.id}>{p.createdAt.toISOString().slice(0, 10)}: {formatMoney(p.amountCents)} · {p.method} · {p.status.toLowerCase()}{p.employeeNote ? ` — “${p.employeeNote}”` : ""}</li>)}
              </ul>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}
