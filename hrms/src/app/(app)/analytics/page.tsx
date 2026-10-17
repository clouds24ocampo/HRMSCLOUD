import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { activityAnalytics } from "@/lib/analytics";
import { getOrgSettings } from "@/lib/settings";
import { addDays, dayKey, formatDay, formatTime } from "@/lib/time";
import { Bars } from "@/components/Charts";
import { Card, PageHeader, Stat } from "@/components/ui";

const RANGES = [7, 30, 90] as const;
const SOURCE: Record<string, string> = { GPS: "Phone GPS", PHONE_LINK: "Computer, confirmed by phone", WIFI: "Computer estimate", NONE: "No location", BEFORE_TRACKING: "Before device tracking" };
const DEVICE: Record<string, string> = { PHONE: "Phone", TABLET: "Tablet", DESKTOP: "Computer", UNKNOWN: "Not recorded" };

function List({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  if (!rows.length) return <p className="text-sm text-muted">Nothing in this range.</p>;
  return (
    <ul className="space-y-2">
      {rows.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-line" aria-hidden><span className="block h-full rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} /></span>
          <span className="text-right font-medium tabular-nums">{n.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

// Everything that happened in the system: who used it, what for, when and from which devices.
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const me = await requireUser("/analytics");
  const settings = await getOrgSettings(me.organizationId);
  const tz = settings.timezone;
  const { days: want } = await searchParams;
  const days = RANGES.find((r) => String(r) === want) ?? 30;
  const to = dayKey(new Date(), tz);
  const from = addDays(to, -(days - 1));
  const a = await activityAnalytics(me.organizationId, from, to, tz);
  const short = (d: string) => formatDay(d, { month: "short", day: "numeric" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Activity analytics"
        subtitle={`All activity in the system, ${short(from)} – ${short(to)}.`}
        action={
          <nav aria-label="Range" className="flex gap-2">
            {RANGES.map((r) => (
              <Link key={r} href={`/analytics?days=${r}`} aria-current={r === days ? "page" : undefined} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${r === days ? "border-brand bg-brand/10 text-brand" : "border-line hover:bg-bg"}`}>
                {r} days
              </Link>
            ))}
          </nav>
        }
      />

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="Actions recorded" value={a.totals.actions.toLocaleString()} />
        <Stat label="Active users" value={a.totals.activeUsers} />
        <Stat label="Sign-ins" value={a.totals.logins} hint={a.totals.failed ? `${a.totals.failed} failed` : "No failures"} tone={a.totals.failed ? "warning" : "success"} />
        <Stat label="Time stamps" value={a.totals.stamps.toLocaleString()} />
        <Stat label="Chat messages" value={a.totals.messages.toLocaleString()} />
        <Stat label="Calls" value={a.totals.voiceCalls + a.totals.videoCalls} hint={`${a.totals.voiceCalls} voice · ${a.totals.videoCalls} video`} />
        <Stat label="Daily reports" value={a.totals.reports} />
        <Stat label="Documents uploaded" value={a.totals.uploads} />
        <Stat label="Policies signed" value={a.totals.signatures} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {([["Actions per day", a.perDay.actions, "brand"], ["Time stamps per day", a.perDay.stamps, "success"], ["Chat messages per day", a.perDay.messages, "warning"]] as const).map(([title, data, tone]) => (
          <Card key={title}>
            <h2 className="mb-2 font-semibold">{title}</h2>
            <Bars data={data} tone={tone} />
            <p className="mt-1 flex justify-between text-xs text-muted"><span>{short(from)}</span><span>{short(to)}</span></p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">What the system was used for</h2>
          <List rows={a.modules} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Most active users</h2>
          <List rows={a.topUsers.map((u) => [`${u.name}${u.role ? ` (${u.role})` : ""}`, u.count])} />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Time in and time out by hour</h2>
          <Bars data={a.stampHours} tone="brand" />
          <p className="mt-1 flex justify-between text-xs text-muted"><span>00:00</span><span>12:00</span><span>23:00</span></p>
        </Card>
        <Card className="space-y-4">
          <div>
            <h2 className="mb-3 font-semibold">How time stamps were located</h2>
            <List rows={a.sources.map((s) => [SOURCE[s.key] ?? s.key, s.count])} />
          </div>
          <div>
            <h2 className="mb-3 font-semibold">Devices used</h2>
            <List rows={a.devices.map((s) => [DEVICE[s.key] ?? s.key, s.count])} />
          </div>
        </Card>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Latest activity</h2>
          <Link href="/audit" className="text-sm font-semibold text-brand hover:underline">Full audit log</Link>
        </div>
        <ul className="divide-y divide-line text-sm">
          {a.recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0"><span className="font-medium">{r.who}</span> · {r.module} · <span className="text-muted">{r.action}</span></span>
              <span className="text-xs tabular-nums text-muted">{short(dayKey(r.at, tz))} {formatTime(r.at, tz)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
