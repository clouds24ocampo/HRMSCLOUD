import Link from "next/link";
import type { BoardRow, LiveEvent, LiveRow } from "@/lib/team-dtr";
import { mapUrl } from "@/components/AttendanceBoard";
import { formatDuration, formatTime } from "@/lib/time";

type Tone = "success" | "brand" | "warning" | "danger" | "neutral";
const TONE: Record<Tone, string> = {
  success: "border-success/40 bg-success/10 text-success",
  brand: "border-brand/40 bg-brand/10 text-brand",
  warning: "border-warning/50 bg-warning/15 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
  neutral: "border-line bg-line/40 text-muted",
};
type Tag = { group: string; icon: string; label: string; detail?: string; tone: Tone };

const mins = (from: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60000));

// One person's status right now, as a tag: what they are doing, since when, and whether it is a problem.
export function statusTag(l: LiveRow | undefined, flex: boolean, lateToday: number, tz: string, now: Date): Tag {
  if (!l) return { group: "Not in", icon: "○", label: "Not in", tone: "neutral" };
  if (l.state === "ON_BREAK" && l.pause) {
    const since = `since ${formatTime(l.pause.since, tz)} · ${formatDuration(mins(l.pause.since, now)) || "0m"}`;
    if (l.pause.page === "ISSUE") return { group: "On an issue", icon: l.pause.icon, label: l.pause.name, detail: since, tone: "danger" };
    return { group: "On break", icon: l.pause.icon, label: l.pause.name, detail: l.pause.overMinutes ? `${since} · ${l.pause.overMinutes} min over` : since, tone: l.pause.overMinutes ? "danger" : "brand" };
  }
  if (l.state === "WORKING") return { group: "Working", icon: "●", label: lateToday ? `Working · late ${formatDuration(lateToday)}` : "Working", detail: l.firstIn ? `in ${formatTime(l.firstIn, tz)}` : undefined, tone: lateToday ? "warning" : "success" };
  if (l.state === "DONE") {
    return l.systemOut
      ? { group: "Timed out", icon: "⏏", label: "System time-out", detail: "no log out", tone: "danger" }
      : { group: "Timed out", icon: "✓", label: "Timed out", detail: l.lastOut ? formatTime(l.lastOut, tz) : undefined, tone: "neutral" };
  }
  if (l.state === "LATE") return { group: "Late, not in", icon: "!", label: "Late, not in", detail: l.detail, tone: "warning" };
  if (l.state === "ABSENT_RISK") return { group: "No show", icon: "✕", label: "No show", detail: l.detail, tone: "danger" };
  if (l.state === "NOT_YET") return { group: "Not in yet", icon: "○", label: "Not in yet", detail: l.detail ?? (l.shift ? `shift ${l.shift.startTime}` : undefined), tone: "neutral" };
  if (l.state === "ON_LEAVE") return { group: "On leave", icon: "🏖️", label: "On leave", tone: "brand" };
  if (l.state === "DAY_OFF") return { group: "Day off", icon: "–", label: "Day off", tone: "neutral" };
  return flex ? { group: "Not in yet", icon: "○", label: "Flexible, not in", tone: "neutral" } : { group: "No schedule", icon: "?", label: "No schedule, not in", tone: "neutral" };
}

export function StatusTag({ t }: { t: Tag }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE[t.tone]}`}>
      <span aria-hidden>{t.icon}</span>
      <span className="truncate">{t.label}</span>
      {t.detail && <span className="truncate font-normal opacity-80">· {t.detail}</span>}
    </span>
  );
}

const VERB = { IN: "", OUT: "", PAUSE_START: "started", PAUSE_END: "ended" } as const;

// Every stamp of the day, in order: what, when, where, and the note if any.
function Timeline({ events, tz }: { events: LiveEvent[]; tz: string }) {
  if (!events.length) return <p className="text-xs text-muted">No time stamps today.</p>;
  return (
    <ol className="space-y-1.5 border-l border-line pl-3">
      {events.map((e) => (
        <li key={e.id} className="relative text-xs">
          <span className={`absolute -left-[17px] top-1 h-2 w-2 rounded-full ${e.page === "ISSUE" ? "bg-danger" : e.type === "IN" ? "bg-success" : e.type === "OUT" ? "bg-muted" : "bg-brand"}`} aria-hidden />
          <span className="font-semibold tabular-nums">{formatTime(e.at, tz)}</span>{" "}
          <span aria-hidden>{e.icon}</span> {e.name} {VERB[e.type]}
          {e.page === "ISSUE" && <span className="ml-1 text-danger">(issue)</span>}
          {e.source === "SYSTEM" && <span className="ml-1 font-semibold text-danger">system time-out</span>}
          {e.source === "MANUAL" && <span className="ml-1 text-warning">added by HR</span>}
          <span className="block text-muted">
            {e.lat != null && e.lng != null ? (
              <a href={mapUrl(e.lat, e.lng)} target="_blank" rel="noopener noreferrer" className={e.gpsStatus === "OK" ? "text-brand hover:underline" : "text-warning hover:underline"}>
                📍 ±{Math.round(e.accuracy ?? 0)} m{e.device === "DESKTOP" ? " · computer" : e.device ? " · phone" : ""}
              </a>
            ) : e.source === "SYSTEM" || e.source === "MANUAL" ? null : <span className="text-danger">no location</span>}
            {e.note && <span className="block italic">“{e.note}”</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const ORDER = ["On an issue", "No show", "Late, not in", "On break", "Working", "Not in yet", "Timed out", "On leave", "Day off", "No schedule", "Not in"];

// Everyone in reach, right now. Problems first: issues, no shows, late, over-long breaks.
export function LiveStatus({ rows, names, tz }: { rows: BoardRow[]; names: Map<string, { name: string; dept: string | null }>; tz: string }) {
  const now = new Date();
  const people = rows.map((r) => ({ r, t: statusTag(r.live, !!r.today?.flex, r.today?.lateMinutes ?? 0, tz, now) }));
  const counts = new Map<string, number>();
  for (const p of people) counts.set(p.t.group, (counts.get(p.t.group) ?? 0) + 1);
  const sorted = [...people].sort((a, b) => ORDER.indexOf(a.t.group) - ORDER.indexOf(b.t.group) || (names.get(a.r.id)?.name ?? "").localeCompare(names.get(b.r.id)?.name ?? ""));
  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2" aria-label="How many people are in each status">
        {ORDER.filter((g) => counts.get(g)).map((g) => (
          <li key={g} className="rounded-lg border border-line bg-bg px-3 py-1.5 text-sm"><span className="font-bold tabular-nums">{counts.get(g)}</span> {g.toLowerCase()}</li>
        ))}
      </ul>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map(({ r, t }) => {
          const n = names.get(r.id);
          return (
            <li key={r.id} className="min-w-0 rounded-xl border border-line px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/dtr?employee=${r.id}`} className="truncate font-medium hover:underline">{n?.name}</Link>
                {n?.dept && <span className="shrink-0 truncate text-xs text-muted">{n.dept}</span>}
              </div>
              <div className="mt-1.5"><StatusTag t={t} /></div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-brand">Today&apos;s time stamps ({r.live?.today.length ?? 0})</summary>
                <div className="mt-2 pl-2"><Timeline events={r.live?.today ?? []} tz={tz} /></div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
