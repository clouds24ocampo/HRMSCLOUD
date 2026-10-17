import Link from "next/link";
import {
  type DailyAdherence,
  type AdherenceAggregate,
  VERDICT,
  DAILY_BASE_BREAK_MINUTES,
  OVERTIME_BREAK_INTERVAL_MINUTES,
  OVERTIME_BREAK_BONUS_MINUTES,
} from "@/lib/adherence";
import { formatDay, formatDuration, formatDurationPrecise } from "@/lib/time";
import { Badge, Card, Stat } from "@/components/ui";
import { Meter } from "@/components/Charts";

type Props = {
  daily: DailyAdherence[];
  summary: AdherenceAggregate;
  today: string;
  selectedDays: number;
  baseUrl: string;
  title?: string;
  subtitle?: string;
};

const RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
] as const;

const STATUS_BADGE: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  PRESENT: { label: "Present", tone: "success" },
  INCOMPLETE: { label: "Incomplete", tone: "warning" },
  ABSENT: { label: "Absent", tone: "danger" },
  LEAVE: { label: "On leave", tone: "neutral" },
  DAY_OFF: { label: "Day off", tone: "neutral" },
  NO_SCHEDULE: { label: "No schedule", tone: "neutral" },
};

export function ScheduleAdherenceSection({
  daily,
  summary,
  today,
  selectedDays,
  baseUrl,
  title = "Schedule Adherence & Time Performance",
  subtitle = "Daily adherence to working hours and break limits.",
}: Props) {
  const v = VERDICT[summary.verdict];
  const urlForDays = (d: number) => {
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}days=${d}`;
  };

  // Sort daily rows with most recent first
  const sortedDaily = [...daily].sort((a, b) => b.day.localeCompare(a.day));

  return (
    <Card className="space-y-6">
      {/* Header & Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
            <Badge tone={v.tone}>{v.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-bg p-1 text-xs font-medium">
          {RANGES.map((r) => {
            const active = selectedDays === r.days;
            return (
              <Link
                key={r.days}
                href={urlForDays(r.days)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  active
                    ? "bg-brand font-semibold text-white shadow-xs"
                    : "text-muted hover:text-ink hover:bg-surface"
                }`}
              >
                {r.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Break Policy Callout */}
      <div className="rounded-xl border border-line bg-surface-raised/40 p-3.5 text-xs text-ink/90 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <span className="text-base select-none" aria-hidden>
            ⏱️
          </span>
          <div className="space-y-1">
            <p className="font-semibold text-ink">
              Break &amp; Meal Adherence Policy:
            </p>
            <p className="text-muted leading-relaxed">
              Standard allowance is{" "}
              <strong className="text-ink">
                {formatDuration(DAILY_BASE_BREAK_MINUTES)} (1h 30m) daily
              </strong>{" "}
              with <em>no extension permitted</em>. When working overtime, an
              additional{" "}
              <strong className="text-ink">
                +{OVERTIME_BREAK_BONUS_MINUTES} minutes
              </strong>{" "}
              is granted for every{" "}
              <strong className="text-ink">
                {formatDuration(OVERTIME_BREAK_INTERVAL_MINUTES)} (2 hours)
              </strong>{" "}
              of overtime worked. Any break time taken past the allowed limit is
              deducted from schedule adherence as an unapproved extension.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Schedule Adherence</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
            {summary.overallAdherencePct !== null ? `${summary.overallAdherencePct}%` : "—"}
          </p>
          <div className="mt-2 space-y-1">
            <Meter value={summary.overallAdherencePct} tone={v.tone} />
            <p className="text-xs text-muted">
              {summary.presentDays} of {summary.totalScheduledDays} scheduled days kept
            </p>
          </div>
        </div>

        <Stat
          label="Productive Work"
          value={formatDurationPrecise(summary.totalProductiveSeconds)}
          tone="success"
          hint={`${summary.overallProductivityRate}% productivity rate`}
        />

        <Stat
          label="Breaks &amp; Meals"
          value={formatDuration(summary.totalBreakMinutes)}
          tone={summary.totalExcessBreakMinutes > 0 ? "warning" : "neutral"}
          hint={
            summary.totalExcessBreakMinutes > 0
              ? `⚠️ +${formatDuration(summary.totalExcessBreakMinutes)} overbreak`
              : "Within 1h 30m limit"
          }
        />

        <Stat
          label="Late · Undertime"
          value={
            <span className="text-2xl tabular-nums">
              {formatDuration(summary.totalLateMinutes)} · {formatDuration(summary.totalUndertimeMinutes)}
            </span>
          }
          tone={summary.totalLateMinutes > 0 || summary.totalUndertimeMinutes > 0 ? "warning" : "success"}
          hint={
            summary.totalOvertimeMinutes > 0
              ? `OT: ${formatDuration(summary.totalOvertimeMinutes)}`
              : "No overtime"
          }
        />
      </div>

      {/* Daily Breakdown Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">
            Daily Breakdown ({daily.length} days)
          </h3>
          <p className="text-xs text-muted">
            Computed daily based on shift, overtime, and break limits
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs font-semibold text-muted">
              <tr>
                <th className="px-3.5 py-3">Date</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Shift / Plan</th>
                <th className="px-3 py-3 text-right">Productive Work</th>
                <th className="px-3 py-3 text-right">Breaks &amp; Meals</th>
                <th className="px-3 py-3 text-right">Extension</th>
                <th className="px-3 py-3 text-right">Late · Under</th>
                <th className="px-3 py-3 text-right">Overtime</th>
                <th className="px-3.5 py-3 text-right">Schedule Adherence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sortedDaily.map((row) => {
                const isToday = row.day === today;
                const statusMeta = STATUS_BADGE[row.status] ?? {
                  label: row.status,
                  tone: "neutral",
                };
                const verdictMeta = VERDICT[row.verdict];
                const shiftText = row.shift
                  ? `${row.shift.startTime} – ${row.shift.endTime}`
                  : row.plannedMinutes
                  ? `${formatDuration(row.plannedMinutes)}`
                  : "—";

                return (
                  <tr
                    key={row.day}
                    className={`transition hover:bg-surface/60 ${
                      isToday ? "bg-brand/5 font-medium" : ""
                    }`}
                  >
                    {/* Date */}
                    <td className="px-3.5 py-3 tabular-nums">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink">
                          {formatDay(row.day, { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        {isToday && (
                          <span className="rounded-full bg-brand/15 px-1.5 py-0.2 text-[10px] font-bold text-brand uppercase tracking-wider">
                            Today
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </td>

                    {/* Shift / Plan */}
                    <td className="px-3 py-3 text-right tabular-nums text-muted text-xs">
                      {shiftText}
                    </td>

                    {/* Productive Work */}
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.productiveSeconds > 0 ? (
                        <div>
                          <span className="font-semibold text-emerald-600">
                            {formatDurationPrecise(row.productiveSeconds)}
                          </span>
                          <span className="ml-1.5 text-xs text-muted">
                            ({row.productivityRate}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Breaks & Meals Taken vs Allowed */}
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.status === "PRESENT" || row.status === "INCOMPLETE" ? (
                        <div>
                          <span className="font-medium text-ink">
                            {formatDurationPrecise(row.breakSeconds)}
                          </span>
                          <span className="text-xs text-muted">
                            {" "}/ {formatDuration(row.allowedBreakMinutes)}
                          </span>
                          {row.allowedBreakMinutes > DAILY_BASE_BREAK_MINUTES && (
                            <span className="block text-[11px] text-brand">
                              +{row.allowedBreakMinutes - DAILY_BASE_BREAK_MINUTES}m OT bonus
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Extension / Over-break */}
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.excessBreakMinutes > 0 ? (
                        <Badge tone="warning">
                          +{formatDuration(row.excessBreakMinutes)} over
                        </Badge>
                      ) : row.status === "PRESENT" || row.status === "INCOMPLETE" ? (
                        <span className="text-xs text-muted">None</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Late · Undertime */}
                    <td className="px-3 py-3 text-right tabular-nums text-xs">
                      {row.lateMinutes > 0 || row.undertimeMinutes > 0 ? (
                        <span className="font-medium text-amber-600">
                          {formatDuration(row.lateMinutes)} · {formatDuration(row.undertimeMinutes)}
                        </span>
                      ) : row.status === "PRESENT" ? (
                        <span className="text-muted">0m · 0m</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Overtime */}
                    <td className="px-3 py-3 text-right tabular-nums text-xs">
                      {row.overtimeMinutes > 0 ? (
                        <span className="font-semibold text-brand">
                          +{formatDuration(row.overtimeMinutes)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Schedule Adherence % & Verdict */}
                    <td className="px-3.5 py-3 text-right tabular-nums">
                      {row.adherencePct !== null ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-base font-bold text-ink">
                            {row.adherencePct}%
                          </span>
                          <Badge tone={verdictMeta.tone}>{verdictMeta.label}</Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
