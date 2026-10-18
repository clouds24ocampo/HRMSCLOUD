import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { canViewEmployee, isHr } from "@/lib/scope";
import { dbDate, formatDay, keyOfDbDate } from "@/lib/time";
import { getOrgSettings } from "@/lib/settings";
import { LEVEL_LABEL } from "@/lib/defaults";
import { Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { AssignmentForm, DeleteEmployeeForm, EditDetailsForm } from "../EmployeeForms";
import { ChecklistCard } from "../ChecklistCard";
import { OWNER_LABEL } from "@/lib/checklists";
import { AssignComponentForm, CompensationForm, RemoveComponentButton } from "../PayForms";
import { formatMoney, formatPercent } from "@/lib/money";
import { payBreakdown } from "@/lib/pay-breakdown";
import { PayBreakdown } from "@/components/PayBreakdown";
import { items201, load201 } from "@/lib/documents";
import { File201 } from "@/app/(app)/documents/File201";
import { setFlexible } from "../actions";
import { RegularScheduleForm } from "@/app/(app)/schedule/ScheduleForm";
import { describeDays } from "@/lib/schedule";
import { ROLES } from "@/lib/roles";
import { dayKey } from "@/lib/time";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import { WAGE_BASIS_LABEL, suggestBasis } from "@/lib/ph/calc";
import { PreviousEmploymentForm, RemovePreviousButton, TaxProfileForm } from "../TaxForms";

const CHANGE_LABEL = { HIRED: "Hired", ASSIGNMENT: "Assignment changed", STATUS: "Status changed" } as const;
const fmt = (d: Date) => formatDay(keyOfDbDate(d), { year: "numeric", month: "short", day: "numeric" });

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ via?: string }> }) {
  const { id } = await params;
  const { via } = await searchParams;
  const me = await requireUser("/dashboard"); // own record for employees; canViewEmployee scopes everyone else
  const settings = await getOrgSettings(me.organizationId);
  const mine = await getMyEmployee(me, settings.timezone);
  if (!(await canViewEmployee(me, mine.id, id))) notFound();

  const e = await prisma.employee.findFirst({
    where: { id, organizationId: me.organizationId },
    include: {
      department: { select: { name: true } },
      position: { select: { title: true, level: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      user: { select: { email: true, username: true, role: { select: { name: true } } } },
      history: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!e) notFound();
  const hr = isHr(me.role.key);
  const canSchedule = hr || me.role.key === ROLES.MANAGER;
  const today = dayKey(new Date(), settings.timezone);
  const regulars = await prisma.regularSchedule.findMany({
    where: { employeeId: e.id, organizationId: me.organizationId },
    include: { shift: { select: { id: true, name: true, startTime: true, endTime: true } } },
    orderBy: { effectiveFrom: "desc" },
  });
  const currentReg = regulars.find((r) => keyOfDbDate(r.effectiveFrom) <= today);
  // Pay is visible to HR only (the employee sees it on their payslips).
  const [comps, assignedComps, allComps] = hr
    ? await Promise.all([
        prisma.compensation.findMany({ where: { employeeId: e.id, organizationId: me.organizationId }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] }),
        prisma.employeeComponent.findMany({ where: { employeeId: e.id, organizationId: me.organizationId, active: true }, include: { component: true } }),
        prisma.payComponent.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, orderBy: { name: "asc" } }),
      ])
    : [[], [], []];
  // Philippine tax profile and this year's totals: HR only.
  const year = Number(today.slice(0, 4));
  const [profiles, previous, ytd] = hr
    ? await Promise.all([
        prisma.employeeTaxProfile.findMany({ where: { employeeId: e.id, organizationId: me.organizationId }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] }),
        prisma.previousEmployment.findMany({ where: { employeeId: e.id, organizationId: me.organizationId }, orderBy: { year: "desc" } }),
        prisma.payslip.aggregate({
          where: { employeeId: e.id, organizationId: me.organizationId, period: { status: "FINALIZED", payDate: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) } } },
          _sum: { grossCents: true, taxableCents: true, taxWithheldCents: true, benefitsExemptCents: true, mandatoryEeCents: true },
        }),
      ])
    : [[], [], null];
  const taxNow = profiles.find((p) => keyOfDbDate(p.effectiveFrom) <= today) ?? null;
  const basisHint = suggestBasis(currentReg?.workDays.length ?? 5);
  const checklist = await prisma.checklistItem.findMany({ where: { employeeId: e.id, organizationId: me.organizationId }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  const tick = (owner: string) => hr || (owner === "EMPLOYEE" && e.id === mine.id) || (owner === "MANAGER" && me.role.key === ROLES.MANAGER && e.id !== mine.id);
  const listFor = (kind: "ONBOARDING" | "OFFBOARDING") =>
    checklist.filter((c) => c.kind === kind).map((c) => ({ id: c.id, title: c.title, owner: OWNER_LABEL[c.owner], done: !!c.doneAt, canTick: tick(c.owner) }));
  const onboarding = listFor("ONBOARDING");
  const offboarding = listFor("OFFBOARDING");
  const currentComp = comps.find((c) => keyOfDbDate(c.effectiveFrom) <= today);
  const PAY_TYPE = { MONTHLY: "per month", DAILY: "per day", HOURLY: "per hour" } as const;
  const own = e.id === mine.id;
  // Pay is personal: HR and the person themselves only.
  const breakdown = hr || own ? await payBreakdown(me, mine.id, e.id, today, settings) : null;
  const f201 = hr ? items201((await load201(me.organizationId, [e.id])).get(e.id)) : null;
  const tabs = [
    (hr || own) && { href: own ? "/payslips" : `/payslips?employee=${e.id}`, label: "Payslips", icon: "🧾" },
    { href: `/schedule?employee=${e.id}`, label: "Schedule", icon: "📅" },
    { href: `/dtr?employee=${e.id}`, label: "DTR", icon: "⏱️" },
    (hr || own) && { href: own ? "/cash-advance" : `/cash-advance?employee=${e.id}`, label: "Cash advance", icon: "💵" },
    { href: own ? "/daily-report" : `/daily-report?employee=${e.id}`, label: "Daily report", icon: "🗒️" },
    (hr || own) && { href: own ? "/policies" : `/policies?employee=${e.id}`, label: "Policies", icon: "📜" },
  ].filter((t): t is { href: string; label: string; icon: string } => !!t);
  const shifts = canSchedule ? await prisma.shiftTemplate.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, orderBy: { startTime: "asc" } }) : [];

  const [departments, positions, managers] = hr
    ? await Promise.all([
        prisma.department.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.position.findMany({ where: { organizationId: me.organizationId, archivedAt: null }, select: { id: true, title: true, level: true }, orderBy: { title: "asc" } }),
        prisma.employee.findMany({ where: { organizationId: me.organizationId, status: { not: "SEPARATED" }, id: { not: e.id } }, select: { id: true, firstName: true, lastName: true, employeeNo: true }, orderBy: { lastName: "asc" } }),
      ])
    : [[], [], []];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {me.role.key === ROLES.EMPLOYEE || me.role.key === ROLES.SUBCONTRACTOR ? <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink">← Home</Link> : <Link href="/employees" className="text-sm font-medium text-muted hover:text-ink">← All employees</Link>}
      {via === "id" && (
        <p role="status" className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          🪪 Opened from the QR code on {e.firstName}&apos;s digital ID. Status: {STATUS_LABEL[e.status]}.
        </p>
      )}
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- private picture behind a signed-in route */}
        {e.photoKey ? <img src={`/employees/${e.id}/photo?v=${e.photoKey.slice(-8)}`} alt={`Photo of ${e.firstName}`} className="h-20 w-20 shrink-0 rounded-2xl object-cover" /> : <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-line/60 text-3xl" aria-hidden>👤</span>}
        <div className="min-w-0 flex-1">
      <PageHeader
        title={`${e.firstName} ${e.lastName}`}
        subtitle={`${e.employeeNo} · hired ${fmt(e.hireDate)}`}
        action={<Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>}
      />
        </div>
      </div>

      <nav aria-label={`${e.firstName}'s records`} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => (
          <Link key={t.label} href={t.href} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold shadow-sm transition hover:border-brand hover:text-brand">
            <span aria-hidden>{t.icon}</span>{t.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Details</h2>
          <dl className="space-y-2 text-sm">
            {[
              ["Position", e.position ? `${e.position.title} (${LEVEL_LABEL[e.position.level]})` : "Not set"],
              ["Department", e.department?.name ?? "Not set"],
              ["Supervisor", e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : "None"],
              ["Residential Address", e.address ?? "Not set"],
              ["Email", e.email ?? "Not set"],
              ["Phone", e.phone ?? "Not set"],
              ["Sign-in", e.user ? `${e.user.username ? `${e.user.username} · ` : ""}${e.user.email} · ${e.user.role.name}` : "No sign-in"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/dtr?employee=${e.id}`} className={buttonClass}>View DTR</Link>
            <Link href={`/schedule?employee=${e.id}`} className="rounded-lg border border-line px-4 py-2.5 font-semibold transition hover:bg-bg">View schedule</Link>
            {hr && <Link href={`/contracts?employee=${e.id}`} className="rounded-lg border border-line px-4 py-2.5 font-semibold transition hover:border-brand hover:text-brand">📝 Contract</Link>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Employment history</h2>
          <ol className="space-y-3 border-l border-line pl-4">
            {e.history.map((h) => (
              <li key={h.id} className="relative text-sm">
                <span className="absolute left-[-1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
                <p className="font-medium">{CHANGE_LABEL[h.change]} <span className="font-normal text-muted">· {fmt(h.effectiveFrom)}</span></p>
                <p className="text-muted">
                  {h.change === "STATUS"
                    ? STATUS_LABEL[h.status ?? "ACTIVE"]
                    : [h.positionTitle, h.departmentName, h.managerName && `reports to ${h.managerName}`].filter(Boolean).join(" · ") || "No assignment"}
                </p>
                {h.note && <p className="text-muted">“{h.note}”</p>}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">History is never overwritten.</p>
        </Card>
      </div>

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Work schedule {e.flexible && <Badge tone="brand">Flexible</Badge>}</h2>
          {hr && (
            <form action={setFlexible.bind(null, e.id, !e.flexible)}>
              <button className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95">{e.flexible ? "Switch to fixed shift" : "Make flexible"}</button>
            </form>
          )}
        </div>
        {e.flexible ? (
          <p className="text-sm">Own start time and days off. At least <span className="font-semibold">8 hours</span> on each working day (less is undertime) and at least <span className="font-semibold">1 day off a week</span> (a 7th day in a row is flagged on the DTR).</p>
        ) : currentReg ? (
          <p className="text-sm">
            <span className="font-medium">{currentReg.shift.name}</span> ({currentReg.shift.startTime}–{currentReg.shift.endTime}) · {describeDays(currentReg.workDays)}
          </p>
        ) : (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            No regular schedule yet. Late, undertime and overtime cannot be measured until one is set.
          </p>
        )}
        {regulars.length > 1 && (
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {regulars.map((r) => (
              <li key={r.id}>From {fmt(r.effectiveFrom)}: {r.shift.name} · {describeDays(r.workDays)}</li>
            ))}
          </ul>
        )}
        {canSchedule && !e.flexible && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-brand">{currentReg ? "Change regular schedule" : "Set regular schedule"}</summary>
            <div className="mt-3">
              <RegularScheduleForm
                people={[]}
                fixedPerson={e.id}
                from={today}
                shifts={shifts.map((s) => ({ id: s.id, label: `${s.name} (${s.startTime}–${s.endTime})` }))}
                defaultShift={currentReg?.shift.id}
                defaultDays={currentReg?.workDays}
              />
            </div>
          </details>
        )}
      </Card>

      {f201 && (
        <Card className="space-y-3">
          <h2 className="font-semibold">201 file</h2>
          <File201 employeeId={e.id} items={f201} mandatory={own && !hr} />
        </Card>
      )}

      {!hr && own && breakdown && (
        <Card className="space-y-3">
          <h2 className="font-semibold">My pay</h2>
          <PayBreakdown b={breakdown} daysPerYear={settings.daysPerYear} hoursPerDay={settings.hoursPerDay} isAdmin={false} today={today} />
        </Card>
      )}

      {onboarding.length > 0 && <ChecklistCard title="Onboarding checklist" items={onboarding} />}
      {offboarding.length > 0 && <ChecklistCard title="Offboarding checklist" items={offboarding} />}

      {hr && (
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold">Pay</h2>
            <p className="text-xs text-muted">Visible to HR and the employee only. Rates are never overwritten: a change starts on its date and the old one stays.</p>
          </div>
          {currentComp ? (
            <div className="space-y-4 text-sm">
              <p><span className="text-lg font-bold">{formatMoney(currentComp.rateCents)}</span> {PAY_TYPE[currentComp.payType]}</p>
              {breakdown && <PayBreakdown b={breakdown} daysPerYear={settings.daysPerYear} hoursPerDay={settings.hoursPerDay} isAdmin={true} today={today} />}
            </div>
          ) : (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">No pay rate yet. This person is skipped when payroll is calculated.</p>
          )}
          {comps.length > 1 && (
            <ul className="space-y-1 text-sm text-muted">
              {comps.map((c) => <li key={c.id}>From {fmt(c.effectiveFrom)}: {formatMoney(c.rateCents)} {PAY_TYPE[c.payType]}{c.note ? ` (${c.note})` : ""}</li>)}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-brand">{currentComp ? "Change pay rate" : "Set pay rate"}</summary>
            <div className="mt-3"><CompensationForm employeeId={e.id} today={today} /></div>
          </details>
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-semibold">Allowances and deductions</h3>
            {assignedComps.length === 0 ? <p className="text-sm text-muted">None assigned.</p> : (
              <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
                {assignedComps.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span><span className="font-medium">{a.component.name}</span> · {a.component.kind === "EARNING" ? "adds" : "takes"} {a.component.calc === "FIXED" ? formatMoney(a.valueOverride ?? a.component.value) : `${formatPercent(a.valueOverride ?? a.component.value)} of basic`}</span>
                    <RemoveComponentButton employeeId={e.id} componentId={a.componentId} name={a.component.name} />
                  </li>
                ))}
              </ul>
            )}
            {allComps.length > 0 ? (
              <AssignComponentForm employeeId={e.id} items={allComps.map((c) => ({ id: c.id, label: `${c.name} (${c.kind === "EARNING" ? "adds" : "takes"})` }))} />
            ) : (
              <p className="text-sm text-muted">Create pay items first in Payroll → Pay setup.</p>
            )}
          </div>
        </Card>
      )}

      {hr && (
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold">Tax and contributions</h2>
            <p className="text-xs text-muted">Visible to HR only. Used when payroll runs on the Philippine rules.</p>
          </div>
          {taxNow ? (
            <p className="text-sm">
              {taxNow.sector === "GOVERNMENT" ? "Government employee (GSIS)" : "Private employee (SSS)"} · {WAGE_BASIS_LABEL[taxNow.wageBasis]}
              {taxNow.mwe ? " · minimum wage earner" : ""}{taxNow.withholdingApplies ? "" : " · no withholding tax"}
              {!taxNow.socialCovered || !taxNow.philhealthCovered || !taxNow.pagibigCovered ? ` · not covered by ${[!taxNow.socialCovered && (taxNow.sector === "GOVERNMENT" ? "GSIS" : "SSS"), !taxNow.philhealthCovered && "PhilHealth", !taxNow.pagibigCovered && "Pag-IBIG"].filter(Boolean).join(", ")}` : ""}
            </p>
          ) : (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">No tax profile yet. Payroll treats this person as a private employee, not a minimum wage earner, with every contribution applying.</p>
          )}
          {profiles.length > 1 && (
            <ul className="space-y-1 text-sm text-muted">
              {profiles.map((p) => <li key={p.id}>From {fmt(p.effectiveFrom)}: {p.sector === "GOVERNMENT" ? "Government" : "Private"}, {p.wageBasis.replace("_", " ").toLowerCase()}{p.mwe ? ", minimum wage earner" : ""}</li>)}
            </ul>
          )}
          {ytd && (ytd._sum.grossCents ?? 0) > 0 && (
            <p className="text-sm text-muted">This year, finalized payrolls: gross {formatMoney(ytd._sum.grossCents ?? 0)} · taxable {formatMoney(ytd._sum.taxableCents ?? 0)} · tax withheld {formatMoney(ytd._sum.taxWithheldCents ?? 0)} · 13th month and benefits kept exempt {formatMoney(ytd._sum.benefitsExemptCents ?? 0)} of the yearly limit.</p>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-brand">{taxNow ? "Change tax profile" : "Set tax profile"}</summary>
            <div className="mt-3">
              <TaxProfileForm
                employeeId={e.id}
                today={today}
                hint={basisHint}
                current={{
                  sector: taxNow?.sector ?? "PRIVATE", mwe: taxNow?.mwe ?? false, wageBasis: taxNow?.wageBasis ?? basisHint, customFactor: taxNow?.customFactor ?? null, wageRegion: taxNow?.wageRegion ?? "",
                  socialCovered: taxNow?.socialCovered ?? true, philhealthCovered: taxNow?.philhealthCovered ?? true, pagibigCovered: taxNow?.pagibigCovered ?? true, withholdingApplies: taxNow?.withholdingApplies ?? true,
                  tin: taxNow?.tin ?? "", sssNo: taxNow?.sssNo ?? "", philhealthNo: taxNow?.philhealthNo ?? "", pagibigNo: taxNow?.pagibigNo ?? "", gsisNo: taxNow?.gsisNo ?? "",
                }}
              />
            </div>
          </details>
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-semibold">Earlier employer this year</h3>
            {previous.length === 0 ? <p className="mb-2 text-sm text-muted">None. Add one if this person worked elsewhere earlier in the year, so the year-end tax adjustment counts it.</p> : (
              <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
                {previous.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span><span className="font-medium">{p.employerName}</span> · {p.year} · taxable {formatMoney(p.taxableCents)} · tax withheld {formatMoney(p.taxWithheldCents)}</span>
                    <RemovePreviousButton employeeId={e.id} rowId={p.id} label={p.employerName} />
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-brand">Add earlier employment</summary>
              <div className="mt-3"><PreviousEmploymentForm employeeId={e.id} year={year} /></div>
            </details>
          </div>
        </Card>
      )}

      {hr && (
        <Card>
          <h2 className="mb-4 font-semibold">Edit details and sign-in</h2>
          <EditDetailsForm
            employeeId={e.id}
            hasLogin={!!e.user}
            current={{ firstName: e.firstName, lastName: e.lastName, email: e.user?.email ?? e.email ?? "", phone: e.phone ?? "", address: e.address ?? "", hireDate: keyOfDbDate(e.hireDate), username: e.user?.username ?? "" }}
          />
        </Card>
      )}

      {hr && (
        <Card>
          <h2 className="mb-4 font-semibold">Change assignment or status</h2>
          <AssignmentForm
            employeeId={e.id}
            departments={departments.map((d) => ({ id: d.id, label: d.name }))}
            positions={positions.map((p) => ({ id: p.id, label: `${p.title} (${LEVEL_LABEL[p.level]})` }))}
            managers={managers.map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName} · ${m.employeeNo}` }))}
            statuses={Object.entries(STATUS_LABEL).map(([id, label]) => ({ id, label }))}
            current={{ departmentId: e.departmentId ?? "", positionId: e.positionId ?? "", managerId: e.managerId ?? "", status: e.status }}
          />
        </Card>
      )}
      {hr && !own && (
        <Card className="border-danger/40">
          <h2 className="mb-3 font-semibold text-danger">Delete employee</h2>
          <DeleteEmployeeForm employeeId={e.id} employeeNo={e.employeeNo} name={`${e.firstName} ${e.lastName}`} superAdmin={me.role.key === ROLES.SUPER_ADMIN} />
        </Card>
      )}
    </div>
  );
}
