import type { payBreakdown } from "@/lib/pay-breakdown";
import { formatMoney, formatRate } from "@/lib/money";
import { addDays, formatDay, formatDuration, weekStart } from "@/lib/time";
import { Badge } from "@/components/ui";

type Data = NonNullable<Awaited<ReturnType<typeof payBreakdown>>>;

// The rate chain written out the way HR checks it by hand, then what each day of this cut-off actually earned.
export function PayBreakdown({
  b,
  daysPerYear,
  hoursPerDay,
  isAdmin = false,
  today,
}: {
  b: Data;
  daysPerYear: number;
  hoursPerDay: number;
  isAdmin?: boolean;
  today?: string;
}) {
  const steps: [string, string, string][] = [
    ["Monthly salary", "", formatMoney(b.monthly)],
    ["× 12 months", "a year", formatMoney(b.yearly)],
    [`÷ ${daysPerYear} days`, "daily rate", formatRate(b.daily)],
    [`÷ ${hoursPerDay} hours`, "hourly rate", formatRate(b.hourly)],
    ["Per cut-off (½ month)", "with full attendance", formatMoney(b.perCutoff)],
  ];

  // Current or reference week within this cut-off
  const refDay =
    today && today >= b.cut.start && today <= b.cut.end
      ? today
      : b.days.length > 0
      ? b.days[b.days.length - 1].day
      : b.cut.end;
  const curWeekStart = weekStart(refDay);
  const curWeekEnd = addDays(curWeekStart, 6);
  const weekDays = b.days.filter((d) => d.day >= curWeekStart && d.day <= curWeekEnd);
  const weekTotal = weekDays.reduce((n, d) => n + d.regularCents + d.otCents, 0);

  return (
    <div className="space-y-4">
      {isAdmin && (
        <dl className="divide-y divide-line rounded-xl border border-line text-sm" aria-label="How the rates are worked out">
          {steps.map(([k, hint, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
              <dt>
                {k} {hint && <span className="text-xs text-muted">{hint}</span>}
              </dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Summary cards: weekly total & cut-off total */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
          <p className="text-xs font-medium text-muted">Total pay this week</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-ink">{formatMoney(weekTotal)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatDay(curWeekStart)} – {formatDay(curWeekEnd)}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
          <p className="text-xs font-medium text-muted">Total pay this cut-off</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-brand">{formatMoney(b.total)}</p>
          <p className="mt-0.5 text-xs text-muted">{b.cut.name}</p>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Actual pay this cut-off · {b.cut.name}</h3>
        <p className="mb-2 text-xs text-muted">
          Each day pays the hours logged, up to {hoursPerDay} h
          {isAdmin ? ` (${formatRate(b.daily)} for a full day)` : ""}. Overtime counts only when approved by the department head and HR. Without approval, the system times the person out 30 minutes after {hoursPerDay} hours.
        </p>
        {b.days.length === 0 ? (
          <p className="text-sm text-muted">No hours logged in this cut-off yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1.5 font-medium">Day</th>
                  <th className="font-medium">Hours paid</th>
                  <th className="font-medium">Pay</th>
                  <th className="font-medium">Overtime</th>
                  <th className="font-medium">Day total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {b.days.map((d) => (
                  <tr key={d.day}>
                    <td className="py-1.5">
                      {formatDay(d.day)}{" "}
                      {d.systemTimeout && <Badge tone="danger">System time-out</Badge>}{" "}
                      {d.status === "INCOMPLETE" && <Badge tone="brand">Still timed in</Badge>}{" "}
                      {d.recoveredMinutes > 0 && <Badge tone="success">Recovered {formatDuration(d.recoveredMinutes)}</Badge>}
                    </td>
                    <td>{formatDuration(d.regularMinutes) || "0m"}</td>
                    <td>{formatMoney(d.regularCents)}</td>
                    <td>
                      {d.approvedOtMinutes ? (
                        `${formatDuration(d.approvedOtMinutes)} · ${formatMoney(d.otCents)}`
                      ) : d.overtimeMinutes ? (
                        <span className="text-xs text-muted">{formatDuration(d.overtimeMinutes)} not approved</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="font-semibold">{formatMoney(d.regularCents + d.otCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="divide-y divide-line border-t border-line text-sm">
                <tr>
                  <td className="pt-2 font-medium text-muted" colSpan={4}>
                    Total this week ({formatDay(curWeekStart)} – {formatDay(curWeekEnd)})
                  </td>
                  <td className="pt-2 font-semibold tabular-nums text-ink">{formatMoney(weekTotal)}</td>
                </tr>
                <tr>
                  <td className="pt-2 font-semibold" colSpan={4}>
                    Total so far this cut-off (before deductions)
                  </td>
                  <td className="pt-2 font-bold tabular-nums text-brand">{formatMoney(b.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
