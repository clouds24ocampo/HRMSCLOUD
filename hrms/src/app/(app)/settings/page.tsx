import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { TIMEZONES } from "@/lib/defaults";
import { Badge, Card, EmptyState, PageHeader, ghostClass } from "@/components/ui";
import { AddChecklistTemplateForm, AddLeaveTypeForm, AddShiftForm, AddStampTypeForm, WorkRulesForm } from "./SettingsForms";
import { ensureTemplates, OWNER_LABEL } from "@/lib/checklists";
import { setChecklistTemplateArchived, setLeaveTypeArchived, setShiftArchived, setStampArchived } from "./actions";
import { getStampTypes } from "@/lib/stamps";

export default async function SettingsPage() {
  const me = await requireUser("/settings");
  const settings = await getOrgSettings(me.organizationId);
  const stamps = await getStampTypes(me.organizationId, true);
  await ensureTemplates(prisma, me.organizationId);
  const templates = await prisma.checklistTemplate.findMany({ where: { organizationId: me.organizationId }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  const [shifts, leaveTypes] = await Promise.all([
    prisma.shiftTemplate.findMany({ where: { organizationId: me.organizationId }, orderBy: [{ archivedAt: "asc" }, { startTime: "asc" }] }),
    prisma.leaveType.findMany({ where: { organizationId: me.organizationId }, orderBy: [{ archivedAt: "asc" }, { name: "asc" }] }),
  ]);
  const activeShifts = shifts.filter((s) => !s.archivedAt);
  const activeLeave = leaveTypes.filter((l) => !l.archivedAt);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" subtitle="Work rules, shifts and leave types for your organization. The time clock itself works the same for everyone." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Work rules</h2>
          <WorkRulesForm timezones={TIMEZONES} current={settings} />
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <div>
            <h2 className="text-lg font-semibold">Time stamps</h2>
            <p className="text-sm text-muted">The buttons people press on the time clock. Time In and Time Out are always there. Add your own, such as Training or Client call.</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {stamps.map((t) => (
              <li key={t.id} className={`flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 ${t.archivedAt ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate font-medium"><span aria-hidden>{t.icon}</span> {t.name}</p>
                  <p className="mt-0.5 flex flex-wrap gap-1.5">
                    {t.locked && <Badge tone="brand">Required</Badge>}
                    {t.kind === "PAUSE" && <Badge tone={t.paid ? "success" : "neutral"}>{t.paid ? "Paid" : "Unpaid"}</Badge>}
                    {t.allowedMinutes && <Badge>up to {t.allowedMinutes} min</Badge>}
                    {t.requiresNote && <Badge>Needs a note</Badge>}
                    {t.defaultContext === "FIELD" && <Badge>Field work</Badge>}
                  </p>
                </div>
                {!t.locked && (
                  <form action={setStampArchived.bind(null, t.id, !t.archivedAt)}>
                    <button className={ghostClass} aria-label={`${t.archivedAt ? "Restore" : "Archive"} ${t.name}`}>{t.archivedAt ? "Restore" : "Archive"}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <AddStampTypeForm />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Shifts</h2>
          {activeShifts.length === 0 ? (
            <EmptyState title="No shifts yet" hint="Add one to build schedules." />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {activeShifts.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-sm text-muted">{s.startTime} to {s.endTime} · {s.breakMinutes} min break</p>
                  </div>
                  <form action={setShiftArchived.bind(null, s.id, true)}>
                    <button className={ghostClass} aria-label={`Archive ${s.name}`}>Archive</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <AddShiftForm />
          {shifts.some((s) => s.archivedAt) && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-muted">Archived ({shifts.filter((s) => s.archivedAt).length})</summary>
              <ul className="mt-2 space-y-1">
                {shifts.filter((s) => s.archivedAt).map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm text-muted">
                    {s.name}
                    <form action={setShiftArchived.bind(null, s.id, false)}><button className={ghostClass}>Restore</button></form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">Leave types</h2>
          {activeLeave.length === 0 ? (
            <EmptyState title="No leave types yet" hint="Add one so people can request leave." />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {activeLeave.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.name}</p>
                    <p className="text-sm text-muted">{l.annualDays} days per year</p>
                  </div>
                  <span className="flex items-center gap-2">
                    <Badge tone={l.paid ? "success" : "neutral"}>{l.paid ? "Paid" : "Unpaid"}</Badge>
                    <form action={setLeaveTypeArchived.bind(null, l.id, true)}>
                      <button className={ghostClass} aria-label={`Archive ${l.name}`}>Archive</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <AddLeaveTypeForm />
          {leaveTypes.some((l) => l.archivedAt) && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-muted">Archived ({leaveTypes.filter((l) => l.archivedAt).length})</summary>
              <ul className="mt-2 space-y-1">
                {leaveTypes.filter((l) => l.archivedAt).map((l) => (
                  <li key={l.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm text-muted">
                    {l.name}
                    <form action={setLeaveTypeArchived.bind(null, l.id, false)}><button className={ghostClass}>Restore</button></form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
        <Card className="space-y-4 lg:col-span-2">
          <div>
            <h2 className="text-lg font-semibold">Onboarding and offboarding checklists</h2>
            <p className="text-sm text-muted">Created automatically for each new hire and for each person who is separated. Changes apply to people from now on.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(["ONBOARDING", "OFFBOARDING"] as const).map((kind) => (
              <div key={kind}>
                <h3 className="mb-2 text-sm font-semibold">{kind === "ONBOARDING" ? "New hires" : "People leaving"}</h3>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {templates.filter((t) => t.kind === kind).map((t) => (
                    <li key={t.id} className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${t.archivedAt ? "opacity-50" : ""}`}>
                      <span className="min-w-0"><span className="font-medium">{t.title}</span> <Badge>{OWNER_LABEL[t.owner]}</Badge></span>
                      <form action={setChecklistTemplateArchived.bind(null, t.id, !t.archivedAt)}>
                        <button className={ghostClass} aria-label={`${t.archivedAt ? "Restore" : "Archive"} ${t.title}`}>{t.archivedAt ? "Restore" : "Archive"}</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <AddChecklistTemplateForm />
        </Card>
      </div>
    </div>
  );
}
