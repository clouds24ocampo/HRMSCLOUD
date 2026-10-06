import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope } from "@/lib/scope";
import { loadTeamDtr } from "@/lib/team-dtr";
import { summarize, VERDICT, type Summary } from "@/lib/adherence";
import { addDays, dayKey, formatDay, formatDuration } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, Stat, buttonClass, inputClass } from "@/components/ui";
import { Bars, Meter } from "@/components/Charts";
import { ScheduleTabs } from "@/components/ScheduleTabs";

const RANGES = [["7", "Last 7 days"], ["14", "Last 14 days"], ["30", "Last 30 days"], ["60", "Last 60 days"]] as const;
const pctText = (n: number | null) => (n === null ? "—" : `${n}%`);
const toneOf = (a: number | null) => (a === null ? "neutral" : a >= 95 ? "success" : a >= 85 ? "warning" : "danger");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string; employee?: string; q?: string }> }) {
  const me = await requireUser("/schedule/analytics");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const today = dayKey(new Date(), tz);
  const span = RANGES.some(([v]) => v === sp.days) ? Number(sp.days) : 30;
  const from = addDays(today, -(span - 1));

  const scope = await employeeScope(me, mine.id);
  const q = (sp.q ?? "").trim().toLowerCase();
  const people = (
    await prisma.employee.findMany({
      where: { AND: [scope, { status: { notIn: ["SEPARATED"] } }] },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, department: { select: { name: true } }, position: { select: { title: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    })
  ).filter((p) => !q || `${p.firstName} ${p.lastName} ${p.employeeNo}`.toLowerCase().includes(q));
  const profile = sp.employee ? people.find((p) => p.id === sp.employee) : undefined;
  const group = profile ? [profile] : people;

  const dtr = await loadTeamDtr(me.organizationId, group.map((p) => p.id), from, today, tz, settings.graceMinutes);
  const per = group.map((p) => ({ p, s: summarize(dtr.get(p.id) ?? [], today) }));
  const total = summarize(group.flatMap((p) => dtr.get(p.id) ?? []), today); // pooled over every person-day
  const days = Array.from(new Set(group.flatMap((p) => (dtr.get(p.id) ?? []).map((r) => r.day)))).sort();
  const daily = days.map((d) => {
    const rows = group.flatMap((p) => (dtr.get(p.id) ?? []).filter((r) => r.day === d));
    return { label: formatDay(d, { month: "short", day: "numeric" }), late: rows.reduce((n, r) => n + r.lateMinutes, 0), absent: rows.filter((r) => r.status === "ABSENT").length };
  });
  const byDept = new Map<string, Summary[]>();
  for (const x of per) {
    const k = x.p.department?.name ?? "No department";
    byDept.set(k, [...(byDept.get(k) ?? []), x.s]);
  }
  const ranked = [...per].sort((a, b) => (a.s.adherencePct ?? 101) - (b.s.adherencePct ?? 101));
  const v = VERDICT[total.verdict];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Schedule"
        subtitle={profile ? `${profile.firstName} ${profile.lastName} · ${[profile.position?.title, profile.department?.name].filter(Boolean).join(" · ") || profile.employeeNo}` : "Adherence and tardiness across your downline."}
      />
      <ScheduleTabs active="/schedule/analytics" leader />

      <form className="flex flex-wrap items-end gap-2" role="search">
        <label className="block min-w-0 flex-1 basis-56 text-sm font-medium">
          Find a person
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Name or employee number" className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Period
          <select name="days" defaultValue={String(span)} className={inputClass}>
            {RANGES.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
          </select>
        </label>
        {sp.employee && <input type="hidden" name="employee" value={sp.employee} />}
        <button className={buttonClass}>Show</button>
        {profile && <Link href={`/schedule/analytics?days=${span}`} className="self-center text-sm font-medium text-muted hover:text-ink">All people</Link>}
      </form>

      {group.length === 0 ? (
        <EmptyState title="No one matches" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={v.tone}>{profile ? `${profile.firstName}: ${v.label}` : v.label}</Badge>
            <p className="text-sm text-muted">
              {formatDay(from, { month: "short", day: "numeric" })} – {formatDay(today, { month: "short", day: "numeric" })} · {total.scheduledDays} scheduled {total.scheduledDays === 1 ? "day" : "days"} measured (today not counted until it ends)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Schedule adherence" value={pctText(total.adherencePct)} tone={v.tone} hint={v.label} />
            <Stat label="On time" value={pctText(total.onTimePct)} hint={total.lateDays ? `${total.lateDays} late ${total.lateDays === 1 ? "day" : "days"}` : "No late days"} tone={total.lateDays ? "warning" : "success"} />
            <Stat label="Attendance" value={pctText(total.attendancePct)} hint={total.absent ? `${total.absent} absent` : "No absences"} tone={total.absent ? "danger" : "success"} />
            <Stat label="Late · Under · Over" value={<span className="text-2xl">{formatDuration(total.lateMinutes)} · {formatDuration(total.undertimeMinutes)} · {formatDuration(total.overtimeMinutes)}</span>} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="text-lg font-semibold">Tardiness by day</h2>
              <p className="mb-2 text-sm text-muted">Total late minutes per day.</p>
              <Bars data={daily.map((d) => ({ label: d.label, value: d.late }))} unit=" min" tone="warning" />
              <p className="mt-1 flex justify-between text-xs text-muted"><span>{daily[0]?.label}</span><span>{daily.at(-1)?.label}</span></p>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Absences by day</h2>
              <p className="mb-2 text-sm text-muted">People absent on scheduled workdays.</p>
              <Bars data={daily.map((d) => ({ label: d.label, value: d.absent }))} tone="danger" />
              <p className="mt-1 flex justify-between text-xs text-muted"><span>{daily[0]?.label}</span><span>{daily.at(-1)?.label}</span></p>
            </Card>
          </div>

          {!profile && byDept.size > 1 && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold">By department</h2>
              <ul className="space-y-3">
                {[...byDept].map(([name, list]) => {
                  const scored = list.filter((s) => s.adherencePct !== null);
                  const a = scored.length ? Math.round((scored.reduce((n, s) => n + s.adherencePct!, 0) / scored.length) * 10) / 10 : null;
                  return (
                    <li key={name} className="grid grid-cols-[9rem_1fr_4rem] items-center gap-3 text-sm">
                      <span className="truncate font-medium">{name}</span>
                      <Meter value={a} tone={toneOf(a)} />
                      <span className="text-right tabular-nums">{pctText(a)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card className="p-0">
            <div className="border-b border-line px-5 py-3"><h2 className="text-lg font-semibold">{profile ? "Verdict" : "People, lowest adherence first"}</h2></div>
            <ul className="divide-y divide-line">
              {ranked.map(({ p, s }) => {
                const vv = VERDICT[s.verdict];
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1 basis-44">
                      <Link href={`/schedule/analytics?employee=${p.id}&days=${span}`} className="font-medium hover:underline">{p.lastName}, {p.firstName}</Link>
                      <p className="text-xs text-muted">{p.department?.name ?? p.employeeNo}</p>
                    </div>
                    <div className="w-32">
                      <Meter value={s.adherencePct} tone={vv.tone} />
                      <p className="mt-0.5 text-xs tabular-nums text-muted">{pctText(s.adherencePct)} adherence</p>
                    </div>
                    <span className="w-28 tabular-nums text-muted">Late {s.lateDays}× · {formatDuration(s.lateMinutes)}</span>
                    <span className="w-20 tabular-nums text-muted">Absent {s.absent}</span>
                    <Badge tone={vv.tone}>{vv.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
