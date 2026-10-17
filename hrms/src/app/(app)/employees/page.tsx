import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { employeeScope, isHr } from "@/lib/scope";
import { dayKey, formatDay } from "@/lib/time";
import { getOrgSettings } from "@/lib/settings";
import { LEVEL_LABEL } from "@/lib/defaults";
import { Badge, Card, EmptyState, PageHeader, inputClass, buttonClass } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import { AddEmployeeForm } from "./EmployeeForms";


export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string; status?: string }> }) {
  const me = await requireUser("/employees");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const hr = isHr(me.role.key);
  const scope = await employeeScope(me, mine.id);

  const q = sp.q?.trim();
  const [employees, departments, positions, managers, roles, shifts] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...scope,
        ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { employeeNo: { contains: q, mode: "insensitive" } }] } : {}),
        ...(sp.dept ? { departmentId: sp.dept } : {}),
        ...(sp.status && sp.status in STATUS_LABEL ? { status: sp.status as keyof typeof STATUS_LABEL } : {}),
      },
      select: {
        id: true, employeeNo: true, firstName: true, lastName: true, status: true, userId: true,
        _count: { select: { regulars: true } },
        department: { select: { name: true } }, position: { select: { title: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 300, // ponytail: no pagination until an organization needs it
    }),
    prisma.department.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    hr ? prisma.position.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, title: true, level: true }, orderBy: { title: "asc" } }) : [],
    hr ? prisma.employee.findMany({ where: { organizationId: me.organizationId, status: { not: "SEPARATED" } }, select: { id: true, firstName: true, lastName: true, employeeNo: true }, orderBy: { lastName: "asc" } }) : [],
    hr ? prisma.role.findMany({ select: { id: true, key: true, name: true }, orderBy: { name: "asc" } }) : [],
    hr ? prisma.shiftTemplate.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, name: true, startTime: true, endTime: true }, orderBy: { startTime: "asc" } }) : [],
  ]);
  const today = dayKey(new Date(), settings.timezone);
  const filtered = !!(q || sp.dept || sp.status);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={hr ? "Employees" : "My team"} subtitle={hr ? "Everyone in your organization." : "You, and everyone who reports to you."} />

      {hr && (
        <details className="group rounded-2xl border border-line bg-surface shadow-sm open:pb-1">
          <summary className="cursor-pointer list-none px-5 py-4 font-semibold marker:hidden">
            <span className="mr-2 inline-block transition group-open:rotate-90">▸</span>Add an employee
          </summary>
          <div className="px-5 pb-5">
            <AddEmployeeForm
              today={today}
              daysPerYear={settings.daysPerYear}
              hoursPerDay={settings.hoursPerDay}
              departments={departments.map((d) => ({ id: d.id, label: d.name }))}
              positions={positions.map((p) => ({ id: p.id, label: `${p.title} (${LEVEL_LABEL[p.level]})` }))}
              managers={managers.map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName} · ${m.employeeNo}` }))}
              roles={roles.map((r) => ({ id: r.id, label: r.name }))}
              defaultRoleId={roles.find((r) => r.key === "EMPLOYEE")?.id ?? ""}
              shifts={shifts.map((s) => ({ id: s.id, label: `${s.name} (${s.startTime}–${s.endTime})` }))}
            />
          </div>
        </details>
      )}

      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search name or number" aria-label="Search" className={`${inputClass} mt-0 min-w-0 flex-1 basis-48`} />
        <select name="dept" defaultValue={sp.dept ?? ""} aria-label="Filter by department" className={`${inputClass} mt-0 w-auto`}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Filter by status" className={`${inputClass} mt-0 w-auto`}>
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <button className={buttonClass}>Search</button>
        {filtered && <Link href="/employees" className="self-center text-sm font-medium text-muted hover:text-ink">Clear</Link>}
      </form>

      {employees.length === 0 ? (
        <EmptyState
          title={filtered ? "No one matches" : "No employees yet"}
          hint={filtered ? "Try a different search." : hr ? "Add the first employee above." : "People who report to you will appear here."}
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {employees.map((e) => (
              <li key={e.id}>
                <Link href={`/employees/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition hover:bg-bg">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.lastName}, {e.firstName} <span className="text-sm font-normal text-muted">{e.employeeNo}</span></p>
                    <p className="truncate text-sm text-muted">
                      {[e.position?.title, e.department?.name].filter(Boolean).join(" · ") || "No assignment yet"}
                      {e.manager ? ` · reports to ${e.manager.firstName} ${e.manager.lastName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {e._count.regulars === 0 && e.status !== "SEPARATED" && <Badge tone="warning">No schedule</Badge>}
                    {e.userId && <Badge tone="brand">Can sign in</Badge>}
                    <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-muted">Showing {employees.length}. Dates use {settings.timezone}; today is {formatDay(today, { month: "long", day: "numeric", year: "numeric" })}.</p>
    </div>
  );
}
