import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { LEAVE_STATUS } from "@/lib/leave";
import { formatMoney } from "@/lib/money";
import { isHr } from "@/lib/scope";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { CancelCashAdvanceButton, DecideCashAdvanceForm, DeductCashAdvanceForm, RequestCashAdvanceForm } from "./CashAdvanceForms";
import { cutoffFor } from "@/lib/cutoffs";
import { addDays, dayKey, formatDay, keyOfDbDate } from "@/lib/time";
import { getOrgSettings } from "@/lib/settings";

const formatWhen = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);

type Row = Awaited<ReturnType<typeof load>>[number];
const load = (where: object) =>
  prisma.cashAdvance.findMany({
    where,
    include: { payments: { orderBy: { paidOn: "asc" } }, employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

// The record of one advance: request amount, date & time, confirmation status, and decider details.
type Opt = { start: string; label: string };
function Record({ r, deciders, showName, canCancel, tz, cutoffs }: { r: Row; deciders: Map<string, string>; showName: boolean; canCancel: boolean; tz: string; cutoffs?: Opt[] }) {
  const paid = r.payments[0];
  const isDeducted = r.status === "APPROVED" && !!paid;
  const planned = r.firstCutoff ? cutoffFor(keyOfDbDate(r.firstCutoff)) : null;
  const s = LEAVE_STATUS[r.status];
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-base">
            {showName && <Link href={`/cash-advance?employee=${r.employee.id}`} className="hover:underline">{r.employee.firstName} {r.employee.lastName} · </Link>}
            {formatMoney(r.amountCents)}
          </p>
          <p className="text-sm text-muted">Requested: {formatWhen(r.createdAt, tz)} · “{r.reason}”</p>
          {r.decidedAt && (
            <p className="text-sm text-muted">
              {r.status === "APPROVED" ? <span className="font-medium text-success">Confirmed</span> : <span className="font-medium text-danger">Rejected</span>} by {deciders.get(r.decidedById ?? "") ?? "HR"} on {formatWhen(r.decidedAt, tz)}{r.decisionNote ? ` — ${r.decisionNote}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {r.status === "APPROVED" ? (
            <Badge tone={isDeducted ? "success" : planned ? "brand" : "warning"}>{isDeducted ? "Deducted" : planned ? "Confirmed · deduction set" : "Confirmed · not deducted yet"}</Badge>
          ) : (
            <Badge tone={s.tone}>{s.label}</Badge>
          )}
          {canCancel && r.status === "PENDING" && <CancelCashAdvanceButton id={r.id} />}
        </div>
      </div>
      {r.status === "APPROVED" && (
        <p className="mt-1 text-sm">
          {isDeducted
            ? <span className="font-medium text-success">Deducted on the payslip paid {formatWhen(paid.paidOn, tz)}.</span>
            : planned
              ? <>To be deducted on the <span className="font-semibold">{planned.name}</span> payslip (pay day {formatDay(planned.payDate, { month: "short", day: "numeric" })}).</>
              : <span className="text-muted">Not deducted yet.</span>}
        </p>
      )}
      {cutoffs && r.status === "APPROVED" && !isDeducted && <DeductCashAdvanceForm id={r.id} cutoffs={cutoffs} current={planned?.start ?? ""} />}
    </li>
  );
}

export default async function CashAdvancePage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const me = await requireUser("/cash-advance");
  const sp = await searchParams;
  const mine = await getMyEmployee(me);
  const hr = isHr(me.role.key);
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  // Cut-offs HR can deduct on: the current one and the next five.
  const today = dayKey(new Date(), tz);
  const cutoffs: Opt[] = [];
  for (let c = cutoffFor(today); cutoffs.length < 6; c = cutoffFor(addDays(c.end, 1))) cutoffs.push({ start: c.start, label: `${c.name} · pay day ${formatDay(c.payDate, { month: "short", day: "numeric" })}` });

  // HR can open anyone's record; everyone else sees their own.
  const personId = hr && sp.employee ? sp.employee : mine.id;
  const person = personId === mine.id ? null : await prisma.employee.findFirst({ where: { id: personId, organizationId: me.organizationId }, select: { firstName: true, lastName: true } });

  const [own, pending, all] = await Promise.all([
    load({ organizationId: me.organizationId, employeeId: personId }),
    hr ? load({ organizationId: me.organizationId, status: "PENDING", ...(me.role.key === "SUPER_ADMIN" ? {} : { employeeId: { not: mine.id } }) }) : [],
    hr && !person ? load({ organizationId: me.organizationId, status: { in: ["APPROVED", "REJECTED"] } }) : [],
  ]);
  const deciders = new Map((await prisma.user.findMany({ where: { id: { in: [...own, ...all].map((r) => r.decidedById).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={person ? `Cash advances of ${person.firstName} ${person.lastName}` : "Cash advance"} subtitle="Ask for an advance on your pay. HR confirms it, then decides on which payslip it is deducted. Every step is on record with its date and time." />

      {hr && !person && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Waiting for confirmation" value={pending.length} tone={pending.length ? "warning" : "success"} hint={pending.length ? "Below" : "All clear"} />
          <Stat label="Approved advances" value={all.filter((r) => r.status === "APPROVED").length} />
          <div className="col-span-2 md:col-span-1"><Stat label="Total approved" value={formatMoney(all.filter((r) => r.status === "APPROVED").reduce((n, r) => n + r.amountCents, 0))} /></div>
        </div>
      )}

      {hr && !person && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Waiting for your decision {pending.length > 0 && <Badge tone="warning">{pending.length}</Badge>}</h2>
          {pending.length === 0 ? <p className="text-sm text-muted">Nothing is waiting.</p> : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.employee.firstName} {r.employee.lastName} · <span className="font-semibold">{formatMoney(r.amountCents)}</span></p>
                      <p className="text-sm text-muted">Requested: {formatWhen(r.createdAt, tz)} · “{r.reason}”</p>
                    </div>
                    <Link href={`/cash-advance?employee=${r.employee.id}`} className="text-sm font-medium text-brand hover:underline">Earlier advances</Link>
                  </div>
                  <DecideCashAdvanceForm id={r.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {!person && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Request a cash advance</h2>
          <RequestCashAdvanceForm />
        </Card>
      )}

      <Card className="p-0">
        <h2 className="px-5 pt-5 text-lg font-semibold">{person ? "Their advances" : "My advances"}</h2>
        {own.length === 0 ? <div className="p-5"><EmptyState title="No cash advances" /></div> : (
          <ul className="mt-2 divide-y divide-line">{own.map((r) => <Record key={r.id} r={r} deciders={deciders} showName={false} canCancel={!person} tz={tz} cutoffs={hr ? cutoffs : undefined} />)}</ul>
        )}
      </Card>

      {all.length > 0 && (
        <Card className="p-0">
          <h2 className="px-5 pt-5 text-lg font-semibold">All decided advances</h2>
          <ul className="mt-2 divide-y divide-line">{all.map((r) => <Record key={r.id} r={r} deciders={deciders} showName canCancel={false} tz={tz} cutoffs={cutoffs} />)}</ul>
        </Card>
      )}
    </div>
  );
}
