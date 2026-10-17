import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { notFound } from "next/navigation";
import { canViewEmployee, isHr } from "@/lib/scope";
import { overtimeQueue } from "@/lib/overtime";
import { LEAVE_STATUS } from "@/lib/leave";
import { ROLES } from "@/lib/roles";
import { formatDay, formatDuration, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { CancelOvertimeButton, DecideOvertimeForm } from "./OvertimeForms";

export default async function OvertimePage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const me = await requireUser("/overtime");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const emp = await getMyEmployee(me, settings.timezone);
  // Opened from someone's profile: that person's overtime, never your own.
  if (sp.employee && sp.employee !== emp.id) return <PersonOvertime me={me} meId={emp.id} employeeId={sp.employee} />;
  const approver = isHr(me.role.key) || me.role.key === ROLES.MANAGER;

  const mine = await prisma.overtimeRequest.findMany({ where: { employeeId: emp.id, organizationId: me.organizationId }, orderBy: { date: "desc" }, take: 30 });

  const queue = approver ? await overtimeQueue(me, emp.id) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Overtime" subtitle="Extra time the DTR measured is paid only after two approvals: the department head, then HR. Ask from the DTR, on the day you worked it." />

      {approver && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Waiting for your decision {queue.length > 0 && <Badge tone="warning">{queue.length}</Badge>}</h2>
          {queue.length === 0 ? (
            <p className="text-sm text-muted">Nothing is waiting.</p>
          ) : (
            <ul className="space-y-3">
              {queue.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <p className="flex flex-wrap items-center gap-2 font-medium">{r.employee.firstName} {r.employee.lastName} <span className="text-sm font-normal text-muted">· {formatDay(keyOfDbDate(r.date))} · {formatDuration(r.minutes)}</span> <Badge tone={r.step === "HEAD" ? "brand" : "warning"}>{r.step === "HEAD" ? "Step 1 · department head" : "Step 2 · final (HR)"}</Badge></p>
                  <p className="mt-1 text-sm">“{r.reason}”</p>
                  <Link href={`/dtr?employee=${r.employeeId}&from=${keyOfDbDate(r.date)}&to=${keyOfDbDate(r.date)}`} className="mt-1 inline-block text-sm font-medium text-brand hover:underline">Check the DTR</Link>
                  <DecideOvertimeForm id={r.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card className="p-0">
        <h2 className="px-5 pt-5 text-lg font-semibold">My overtime requests</h2>
        {mine.length === 0 ? (
          <div className="p-5"><EmptyState title="No overtime requests" hint="When the DTR shows extra time on a day, open it and press Request overtime." action={<Link href="/dtr" className="font-semibold text-brand hover:underline">Open my DTR</Link>} /></div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {mine.map((r) => {
              const s = LEAVE_STATUS[r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{formatDay(keyOfDbDate(r.date))} <span className="text-sm font-normal text-muted">· {formatDuration(r.minutes)}</span></p>
                    <p className="truncate text-sm text-muted">{r.reason}{r.decisionNote ? ` — ${r.decisionNote}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={s.tone}>{r.status === "PENDING" ? (r.headApprovedAt ? "Head approved · waiting for HR" : "Waiting for department head") : s.label}</Badge>
                    {r.status === "PENDING" && <CancelOvertimeButton id={r.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}


async function PersonOvertime({ me, meId, employeeId }: { me: Awaited<ReturnType<typeof requireUser>>; meId: string; employeeId: string }) {
  if (!(await canViewEmployee(me, meId, employeeId))) notFound();
  const [person, rows] = await Promise.all([
    prisma.employee.findFirst({ where: { id: employeeId, organizationId: me.organizationId }, select: { id: true, firstName: true, lastName: true } }),
    prisma.overtimeRequest.findMany({ where: { employeeId, organizationId: me.organizationId }, orderBy: { date: "desc" }, take: 100 }),
  ]);
  if (!person) notFound();
  const approved = rows.filter((r) => r.status === "APPROVED").reduce((n, r) => n + r.minutes, 0);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={`/employees/${person.id}`} className="text-sm font-medium text-muted hover:text-ink">← {person.firstName} {person.lastName}</Link>
      <PageHeader title={`Overtime of ${person.firstName} ${person.lastName}`} subtitle={`${formatDuration(approved)} approved in the last ${rows.length} requests.`} />
      <Card className="p-0">
        {rows.length === 0 ? <div className="p-5"><EmptyState title="No overtime requests" /></div> : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{formatDay(keyOfDbDate(r.date))} <span className="text-sm font-normal text-muted">· {formatDuration(r.minutes)}</span></p>
                  <p className="truncate text-sm text-muted">{r.reason}{r.decisionNote ? ` — ${r.decisionNote}` : ""}</p>
                </div>
                <Badge tone={LEAVE_STATUS[r.status].tone}>{r.status === "PENDING" ? (r.headApprovedAt ? "Head approved · waiting for HR" : "Waiting for department head") : LEAVE_STATUS[r.status].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
