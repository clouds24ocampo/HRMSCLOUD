import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { installmentPlan, MAX_INSTALLMENTS } from "@/lib/cash-advance";
import { getMyEmployee } from "@/lib/employees";
import { LEAVE_STATUS } from "@/lib/leave";
import { formatMoney } from "@/lib/money";
import { isHr } from "@/lib/scope";
import { formatDay, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { CancelCashAdvanceButton, DecideCashAdvanceForm, RequestCashAdvanceForm, RescheduleCashAdvanceForm } from "./CashAdvanceForms";
import { cutoffFor } from "@/lib/cutoffs";
import { getOrgSettings } from "@/lib/settings";
import { addDays, dayKey } from "@/lib/time";

const day = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric", year: "numeric" });
const when = (d: Date) => d.toISOString().slice(0, 10);

type Row = Awaited<ReturnType<typeof load>>[number];
const load = (where: object) =>
  prisma.cashAdvance.findMany({
    where,
    include: { payments: { orderBy: { paidOn: "asc" } }, employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

// The record of one advance: request, decision, plan, each repayment, and what is left.
type Opt = { start: string; label: string };
function Record({ r, deciders, showName, canCancel, schedule }: { r: Row; deciders: Map<string, string>; showName: boolean; canCancel: boolean; schedule?: Opt[] }) {
  const paid = r.payments.reduce((n, p) => n + p.amountCents, 0);
  const left = r.status === "APPROVED" ? r.amountCents - paid : 0;
  const plan = r.firstCutoff ? installmentPlan(r.amountCents, r.installments, keyOfDbDate(r.firstCutoff)) : [];
  const s = LEAVE_STATUS[r.status];
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {showName && <Link href={`/cash-advance?employee=${r.employee.id}`} className="hover:underline">{r.employee.firstName} {r.employee.lastName} · </Link>}
            {formatMoney(r.amountCents)} <span className="text-sm font-normal text-muted">over {r.installments} cut-off{r.installments === 1 ? "" : "s"}</span>
          </p>
          <p className="text-sm text-muted">Requested {when(r.createdAt)} · “{r.reason}”</p>
          {r.decidedAt && (
            <p className="text-sm text-muted">
              {r.status === "APPROVED" ? "Approved" : "Rejected"} by {deciders.get(r.decidedById ?? "") ?? "HR"} on {when(r.decidedAt)}{r.decisionNote ? ` — ${r.decisionNote}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {r.status === "APPROVED" ? <Badge tone={left === 0 ? "success" : "warning"}>{left === 0 ? "Fully repaid" : `${formatMoney(left)} left`}</Badge> : <Badge tone={s.tone}>{s.label}</Badge>}
          {canCancel && r.status === "PENDING" && <CancelCashAdvanceButton id={r.id} />}
        </div>
      </div>
      {plan.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-brand">Repayment plan and record</summary>
          <table className="mt-2 w-full max-w-md text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1 font-medium">Cut-off</th><th className="font-medium">Installment</th><th className="font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-line tabular-nums">
              {plan.map((p, i) => {
                const pay = r.payments[i];
                return (
                  <tr key={p.cutoff.start}>
                    <td className="py-1">{p.cutoff.name}</td>
                    <td>{formatMoney(p.cents)}</td>
                    <td>{pay ? <span className="text-success">Paid {day(pay.paidOn)}</span> : <span className="text-muted">Due, pay day {formatDay(p.cutoff.payDate, { month: "short", day: "numeric" })}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-muted">Paid so far {formatMoney(paid)}. A repayment is recorded when the payroll that took it is finalized.</p>
        </details>
      )}
      {schedule && r.status === "APPROVED" && r.payments.length === 0 && r.firstCutoff && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-brand">Change when it is deducted</summary>
          <RescheduleCashAdvanceForm id={r.id} cutoffs={schedule} start={keyOfDbDate(r.firstCutoff)} installments={r.installments} max={MAX_INSTALLMENTS} />
        </details>
      )}
    </li>
  );
}

export default async function CashAdvancePage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const me = await requireUser("/cash-advance");
  const sp = await searchParams;
  const mine = await getMyEmployee(me);
  const hr = isHr(me.role.key);
  // Cut-offs HR can schedule deductions in: the current one and the next eleven.
  const today = dayKey(new Date(), (await getOrgSettings(me.organizationId)).timezone);
  const cutoffs: Opt[] = [];
  for (let c = cutoffFor(today); cutoffs.length < 12; c = cutoffFor(addDays(c.end, 1))) cutoffs.push({ start: c.start, label: `${c.name} · pay day ${formatDay(c.payDate, { month: "short", day: "numeric" })}${cutoffs.length === 0 ? " (current)" : ""}` });
  // HR can open anyone's record; everyone else sees their own.
  const personId = hr && sp.employee ? sp.employee : mine.id;
  const person = personId === mine.id ? null : await prisma.employee.findFirst({ where: { id: personId, organizationId: me.organizationId }, select: { firstName: true, lastName: true } });

  const [own, pending, all] = await Promise.all([
    load({ organizationId: me.organizationId, employeeId: personId }),
    hr ? load({ organizationId: me.organizationId, status: "PENDING", ...(me.role.key === "SUPER_ADMIN" ? {} : { employeeId: { not: mine.id } }) }) : [],
    hr && !person ? load({ organizationId: me.organizationId, status: { in: ["APPROVED", "REJECTED"] } }) : [],
  ]);
  const deciders = new Map((await prisma.user.findMany({ where: { id: { in: [...own, ...all].map((r) => r.decidedById).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const outstanding = all.filter((r) => r.status === "APPROVED").reduce((n, r) => n + r.amountCents - r.payments.reduce((m, p) => m + p.amountCents, 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={person ? `Cash advances of ${person.firstName} ${person.lastName}` : "Cash advance"} subtitle="Ask for an advance on your pay. HR approves it and decides when it comes off: whole in one cut-off or split. It shows on the payslip, and every step is kept on record." />

      {hr && !person && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Waiting for decision" value={pending.length} tone={pending.length ? "warning" : "success"} hint={pending.length ? "Below" : "All clear"} />
          <Stat label="Still to be repaid" value={formatMoney(outstanding)} />
          <Stat label="Approved advances" value={all.filter((r) => r.status === "APPROVED").length} />
        </div>
      )}

      {hr && !person && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Waiting for your decision {pending.length > 0 && <Badge tone="warning">{pending.length}</Badge>}</h2>
          {pending.length === 0 ? <p className="text-sm text-muted">Nothing is waiting.</p> : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <p className="font-medium">{r.employee.firstName} {r.employee.lastName} <span className="text-sm font-normal text-muted">· {formatMoney(r.amountCents)} over {r.installments} cut-off{r.installments === 1 ? "" : "s"} · {when(r.createdAt)}</span></p>
                  <p className="mt-1 text-sm">“{r.reason}”</p>
                  <Link href={`/cash-advance?employee=${r.employee.id}`} className="text-sm font-medium text-brand hover:underline">Earlier advances</Link>
                  <DecideCashAdvanceForm id={r.id} cutoffs={cutoffs} start={cutoffs[1].start} installments={r.installments} max={MAX_INSTALLMENTS} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {!person && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Request a cash advance</h2>
          <RequestCashAdvanceForm max={MAX_INSTALLMENTS} />
        </Card>
      )}

      <Card className="p-0">
        <h2 className="px-5 pt-5 text-lg font-semibold">{person ? "Their advances" : "My advances"}</h2>
        {own.length === 0 ? <div className="p-5"><EmptyState title="No cash advances" /></div> : (
          <ul className="mt-2 divide-y divide-line">{own.map((r) => <Record key={r.id} r={r} deciders={deciders} showName={false} canCancel={!person} schedule={hr ? cutoffs : undefined} />)}</ul>
        )}
      </Card>

      {all.length > 0 && (
        <Card className="p-0">
          <h2 className="px-5 pt-5 text-lg font-semibold">All decided advances</h2>
          <ul className="mt-2 divide-y divide-line">{all.map((r) => <Record key={r.id} r={r} deciders={deciders} showName canCancel={false} schedule={cutoffs} />)}</ul>
        </Card>
      )}
    </div>
  );
}
