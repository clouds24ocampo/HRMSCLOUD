import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getMyEmployee } from "@/lib/employees";
import { getOrgSettings } from "@/lib/settings";
import { employeeScope } from "@/lib/scope";
import { loadLive } from "@/lib/team-dtr";
import type { LiveState } from "@/lib/live";
import { formatTime } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, Stat, buttonClass, inputClass } from "@/components/ui";
import { ScheduleTabs } from "@/components/ScheduleTabs";

const STATE: Record<LiveState, { label: string; tone: "success" | "warning" | "danger" | "brand" | "neutral"; rank: number }> = {
  ABSENT_RISK: { label: "No show", tone: "danger", rank: 0 },
  LATE: { label: "Late, not in", tone: "warning", rank: 1 },
  ON_BREAK: { label: "On break", tone: "brand", rank: 2 },
  WORKING: { label: "Working", tone: "success", rank: 3 },
  NOT_YET: { label: "Not yet in", tone: "neutral", rank: 4 },
  DONE: { label: "Done for today", tone: "neutral", rank: 5 },
  ON_LEAVE: { label: "On leave", tone: "brand", rank: 6 },
  DAY_OFF: { label: "Day off", tone: "neutral", rank: 7 },
  NO_SCHEDULE: { label: "No schedule", tone: "neutral", rank: 8 },
};

export default async function LivePage({ searchParams }: { searchParams: Promise<{ q?: string; state?: string }> }) {
  const me = await requireUser("/schedule/live");
  const sp = await searchParams;
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const mine = await getMyEmployee(me, tz);
  const scope = await employeeScope(me, mine.id);
  const q = (sp.q ?? "").trim();
  const people = await prisma.employee.findMany({
    where: { AND: [scope, { status: { notIn: ["SEPARATED"] } }] },
    select: { id: true, firstName: true, lastName: true, employeeNo: true, department: { select: { name: true } }, position: { select: { title: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
  });
  const live = await loadLive(me.organizationId, people.map((p) => p.id), tz, settings.graceMinutes);
  const all = people.map((p) => ({ p, l: live.get(p.id)! }));
  const count = (s: LiveState[]) => all.filter((x) => s.includes(x.l.state)).length;
  const shown = all
    .filter((x) => !q || `${x.p.firstName} ${x.p.lastName} ${x.p.employeeNo}`.toLowerCase().includes(q.toLowerCase()))
    .filter((x) => !sp.state || x.l.state === sp.state)
    .sort((a, b) => STATE[a.l.state].rank - STATE[b.l.state].rank || a.p.lastName.localeCompare(b.p.lastName));
  const chip = (s: string | undefined, label: string) => (
    <Link
      key={label}
      href={`/schedule/live?${new URLSearchParams({ ...(q ? { q } : {}), ...(s ? { state: s } : {}) })}`}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${sp.state === s || (!sp.state && !s) ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:bg-bg"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Schedule" subtitle="Live view of your downline. Updates by itself every 20 seconds." />
      <ScheduleTabs active="/schedule/live" leader />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Working now" value={count(["WORKING"])} tone="success" />
        <Stat label="On break" value={count(["ON_BREAK"])} />
        <Stat label="Late, not in" value={count(["LATE"])} tone={count(["LATE"]) ? "warning" : "success"} hint={count(["LATE"]) ? "needs a look" : "none"} />
        <Stat label="No show (2 h+)" value={count(["ABSENT_RISK"])} tone={count(["ABSENT_RISK"]) ? "danger" : "success"} hint={count(["ABSENT_RISK"]) ? "act now" : "none"} />
        <Stat label="Not yet in · off" value={`${count(["NOT_YET"])} · ${count(["DAY_OFF", "ON_LEAVE"])}`} />
      </div>
      <form className="flex flex-wrap items-end gap-2" role="search">
        <label className="block min-w-0 flex-1 basis-64 text-sm font-medium">
          Search a person
          <input name="q" defaultValue={q} placeholder="Name or employee number" className={inputClass} />
        </label>
        {sp.state && <input type="hidden" name="state" value={sp.state} />}
        <button className={buttonClass}>Search</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {chip(undefined, "All")}
        {(Object.keys(STATE) as LiveState[]).filter((k) => count([k])).map((k) => chip(k, `${STATE[k].label} (${count([k])})`))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No one matches" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {shown.map(({ p, l }) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <Link href={`/schedule/analytics?employee=${p.id}`} className="font-medium hover:underline">{p.lastName}, {p.firstName}</Link>
                  <p className="text-xs text-muted">{[p.position?.title, p.department?.name].filter(Boolean).join(" · ") || p.employeeNo}</p>
                </div>
                <span className="w-32 text-sm text-muted">{l.shift ? `${l.shift.startTime}–${l.shift.endTime}` : l.shift === null ? "Off today" : "No plan"}</span>
                <span className="w-24 text-sm tabular-nums">{l.firstIn ? `In ${formatTime(l.firstIn, tz)}` : "—"}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={STATE[l.state].tone}>{STATE[l.state].label}</Badge>
                  {l.detail && <span className="text-xs text-muted">{l.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
