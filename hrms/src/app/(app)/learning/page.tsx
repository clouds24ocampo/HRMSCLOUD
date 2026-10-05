import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope, isHr } from "@/lib/scope";
import { ROLES } from "@/lib/roles";
import { addDays, dayKey, formatDay, keyOfDbDate } from "@/lib/time";
import { setCourseArchived } from "./actions";
import { Badge, Card, EmptyState, PageHeader, ghostClass } from "@/components/ui";
import { AddCourseForm, CancelEnrollmentButton, CompleteForm, EnrollForm } from "./LearningForms";

const SOON_DAYS = 60;

export default async function LearningPage() {
  const me = await requireUser("/learning");
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  const hr = isHr(me.role.key);
  const manager = me.role.key === ROLES.MANAGER;
  const today = dayKey(new Date(), settings.timezone);
  const soon = addDays(today, SOON_DAYS);
  const fmt = (d: Date) => formatDay(keyOfDbDate(d), { month: "short", day: "numeric", year: "numeric" });
  const orgId = me.organizationId;

  const scope = await employeeScope(me, mine.id);
  const people = hr || manager ? await prisma.employee.findMany({ where: { AND: [scope, { status: { not: "SEPARATED" } }] }, select: { id: true, firstName: true, lastName: true, employeeNo: true }, orderBy: { lastName: "asc" }, take: 300 }) : [];
  const [courses, myEnrollments, teamEnrollments] = await Promise.all([
    prisma.course.findMany({ where: { organizationId: orgId }, orderBy: [{ archivedAt: "asc" }, { title: "asc" }], include: { _count: { select: { enrollments: true } } } }),
    prisma.enrollment.findMany({ where: { organizationId: orgId, employeeId: mine.id, status: { not: "CANCELLED" } }, include: { course: true }, orderBy: { createdAt: "desc" } }),
    hr || manager
      ? prisma.enrollment.findMany({ where: { organizationId: orgId, employeeId: { in: people.map((p) => p.id), not: mine.id }, status: { not: "CANCELLED" } }, include: { course: true, employee: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 200 })
      : [],
  ]);

  const expiry = (e: { expiresOn: Date | null; status: string }) => {
    if (e.status !== "COMPLETED" || !e.expiresOn) return null;
    const k = keyOfDbDate(e.expiresOn);
    return k < today ? ("expired" as const) : k <= soon ? ("soon" as const) : ("ok" as const);
  };
  const attention = teamEnrollments.filter((e) => ["expired", "soon"].includes(expiry(e) ?? ""));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Learning" subtitle="Courses, who took them, and certificates that are about to expire." />

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">My trainings</h2>
        {myEnrollments.length === 0 ? (
          <p className="text-sm text-muted">You are not enrolled in anything yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {myEnrollments.map((e) => {
              const x = expiry(e);
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{e.course.title}</p>
                    <p className="text-muted">{e.status === "COMPLETED" ? `Completed ${fmt(e.completedOn!)}${e.expiresOn ? ` · valid until ${fmt(e.expiresOn)}` : ""}` : "Not completed yet"}</p>
                  </div>
                  <span className="flex gap-2">
                    {e.status === "ENROLLED" && <Badge tone="warning">Enrolled</Badge>}
                    {e.status === "COMPLETED" && x === "ok" && <Badge tone="success">Completed</Badge>}
                    {x === "soon" && <Badge tone="warning">Expires soon</Badge>}
                    {x === "expired" && <Badge tone="danger">Expired</Badge>}
                    {e.status === "COMPLETED" && !x && <Badge tone="success">Completed</Badge>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {(hr || manager) && attention.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Certificates that need attention <Badge tone="danger">{attention.length}</Badge></h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {attention.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                <span><span className="font-medium">{e.employee.firstName} {e.employee.lastName}</span> · {e.course.title}</span>
                <span className="flex items-center gap-2 text-muted">until {fmt(e.expiresOn!)} {expiry(e) === "expired" ? <Badge tone="danger">Expired</Badge> : <Badge tone="warning">Within {SOON_DAYS} days</Badge>}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Course catalog</h2>
          {courses.length === 0 ? <EmptyState title="No courses yet" hint={hr ? "Add the first one." : "HR has not added courses yet."} /> : (
            <ul className="space-y-3">
              {courses.map((c) => (
                <li key={c.id} className={`rounded-xl border border-line p-4 ${c.archivedAt ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{c.title}</p>
                    <span className="flex items-center gap-2 text-sm text-muted">
                      {c.hours ? `${c.hours} h` : ""} {c.validityMonths ? `· valid ${c.validityMonths} mo` : ""} · {c._count.enrollments} enrolled
                      {hr && <form action={setCourseArchived.bind(null, c.id, !c.archivedAt)}><button className={ghostClass} aria-label={`${c.archivedAt ? "Restore" : "Archive"} ${c.title}`}>{c.archivedAt ? "Restore" : "Archive"}</button></form>}
                    </span>
                  </div>
                  {c.description && <p className="text-sm text-muted">{c.description}</p>}
                  {(hr || manager) && !c.archivedAt && people.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-brand">Enroll people</summary>
                      <EnrollForm courseId={c.id} people={people.map((p) => ({ id: p.id, label: `${p.lastName}, ${p.firstName}` }))} />
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {hr && <Card className="h-fit"><h2 className="mb-3 text-lg font-semibold">Add a course</h2><AddCourseForm /></Card>}
      </div>

      {(hr || manager) && (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">{hr ? "Everyone's enrollments" : "My team's enrollments"}</h2>
          {teamEnrollments.length === 0 ? <p className="text-sm text-muted">Nobody is enrolled yet.</p> : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {teamEnrollments.map((e) => (
                <li key={e.id} className="px-3 py-3 text-sm">
                  <p><span className="font-medium">{e.employee.firstName} {e.employee.lastName}</span> · {e.course.title} {e.status === "COMPLETED" ? <Badge tone="success">Completed {fmt(e.completedOn!)}</Badge> : <Badge tone="warning">Enrolled</Badge>}</p>
                  {e.status === "ENROLLED" && (
                    <div className="flex flex-wrap items-end gap-3">
                      <CompleteForm id={e.id} today={today} />
                      <CancelEnrollmentButton id={e.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
