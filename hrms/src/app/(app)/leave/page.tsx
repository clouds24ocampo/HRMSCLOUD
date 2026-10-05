import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { isHr, visibleEmployeeIds } from "@/lib/scope";
import { LEAVE_STATUS } from "@/lib/leave";
import { ROLES } from "@/lib/roles";
import { dayKey, dbDate, formatDay, keyOfDbDate } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { CancelButton, DecideForm, RequestLeaveForm } from "./LeaveForms";

const range = (a: Date, b: Date) => {
  const f = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric" });
  return a.getTime() === b.getTime() ? f(a) : `${f(a)} – ${f(b)}`;
};

export default async function LeavePage() {
  const me = await requireUser("/leave");
  const settings = await getOrgSettings(me.organizationId);
  const emp = await getMyEmployee(me, settings.timezone);
  const today = dayKey(new Date(), settings.timezone);
  const year = today.slice(0, 4);
  const approver = isHr(me.role.key) || me.role.key === ROLES.MANAGER;

  const [types, mine, yearRequests] = await Promise.all([
    prisma.leaveType.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.leaveRequest.findMany({
      where: { employeeId: emp.id, organizationId: me.organizationId },
      include: { leaveType: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: emp.id, organizationId: me.organizationId, status: { in: ["PENDING", "APPROVED"] }, startDate: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) } },
      select: { leaveTypeId: true, days: true, status: true },
    }),
  ]);

  let queue: Awaited<ReturnType<typeof loadQueue>> = [];
  if (approver) queue = await loadQueue(me, emp.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Leave" subtitle={`Your balances for ${year}, your requests, and requests waiting for you.`} />

      {approver && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Waiting for your decision {queue.length > 0 && <Badge tone="warning">{queue.length}</Badge>}</h2>
          {queue.length === 0 ? (
            <p className="text-sm text-muted">Nothing is waiting. New requests from your team appear here.</p>
          ) : (
            <ul className="space-y-3">
              {queue.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <p className="font-medium">
                    {r.employee.firstName} {r.employee.lastName} <span className="text-sm font-normal text-muted">· {r.leaveType.name}</span>
                  </p>
                  <p className="text-sm text-muted">{range(r.startDate, r.endDate)} · {r.days} day{r.days === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-sm">“{r.reason}”</p>
                  <DecideForm id={r.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {types.map((t) => {
              const used = yearRequests.filter((r) => r.leaveTypeId === t.id && r.status === "APPROVED").reduce((n, r) => n + r.days, 0);
              const pending = yearRequests.filter((r) => r.leaveTypeId === t.id && r.status === "PENDING").reduce((n, r) => n + r.days, 0);
              return (
                <div key={t.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                  <p className="text-sm text-muted">{t.name}</p>
                  <p className="mt-1 text-3xl font-bold">{t.paid ? Math.max(t.annualDays - used - pending, 0) : "—"}<span className="text-base font-medium text-muted">{t.paid ? ` of ${t.annualDays}` : ""}</span></p>
                  <p className="mt-1 text-xs text-muted">{t.paid ? `${used} used${pending ? ` · ${pending} pending` : ""}` : `${used + pending} taken · unpaid`}</p>
                </div>
              );
            })}
          </div>

          <Card className="p-0">
            <h2 className="px-5 pt-5 text-lg font-semibold">My requests</h2>
            {mine.length === 0 ? (
              <div className="p-5"><EmptyState title="No requests yet" hint="Send one with the form." /></div>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {mine.map((r) => {
                  const s = LEAVE_STATUS[r.status];
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">{r.leaveType.name} <span className="text-sm font-normal text-muted">· {range(r.startDate, r.endDate)} · {r.days}d</span></p>
                        <p className="truncate text-sm text-muted">{r.reason}{r.decisionNote ? ` — ${r.decisionNote}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={s.tone}>{s.label}</Badge>
                        {r.status === "PENDING" && <CancelButton id={r.id} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <h2 className="mb-3 text-lg font-semibold">Request leave</h2>
          {types.length === 0 ? (
            <p className="text-sm text-muted">HR has not set up leave types yet.</p>
          ) : (
            <RequestLeaveForm today={today} types={types.map((t) => ({ id: t.id, label: `${t.name}${t.paid ? "" : " (unpaid)"}` }))} />
          )}
        </Card>
      </div>
    </div>
  );
}

async function loadQueue(me: Awaited<ReturnType<typeof requireUser>>, myEmployeeId: string) {
  const ids = await visibleEmployeeIds(me, myEmployeeId);
  return prisma.leaveRequest.findMany({
    where: {
      organizationId: me.organizationId,
      status: "PENDING",
      ...(ids ? { employeeId: { in: ids } } : {}),
      // Your own request is only yours to decide if you are the Super Admin.
      ...(me.role.key === ROLES.SUPER_ADMIN ? {} : { employeeId: { ...(ids ? { in: ids.filter((i) => i !== myEmployeeId) } : { not: myEmployeeId }) } }),
    },
    include: { employee: { select: { firstName: true, lastName: true } }, leaveType: { select: { name: true } } },
    orderBy: { startDate: "asc" },
    take: 100,
  });
}
