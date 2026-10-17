import type { payBreakdown } from "@/lib/pay-breakdown";
import { formatMoney, formatRate } from "@/lib/money";
import { formatDay, formatDuration } from "@/lib/time";
import { Badge } from "@/components/ui";

type Data = NonNullable<Awaited<ReturnType<typeof payBreakdown>>>;

// The rate chain written out the way HR checks it by hand, then what each day of this cut-off actually earned.
export function PayBreakdown({ b, daysPerYear, hoursPerDay }: { b: Data; daysPerYear: number; hoursPerDay: number }) {
  const steps: [string, string, string][] = [
    ["Monthly salary", "", formatMoney(b.monthly)],
    ["× 12 months", "a year", formatMoney(b.yearly)],
    [`÷ ${daysPerYear} days`, "daily rate", formatRate(b.daily)],
    [`÷ ${hoursPerDay} hours`, "hourly rate", formatRate(b.hourly)],
    ["Per cut-off (½ month)", "with full attendance", formatMoney(b.perCutoff)],
  ];
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-line rounded-xl border border-line text-sm" aria-label="How the rates are worked out">
        {steps.map(([k, hint, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt>{k} {hint && <span className="text-xs text-muted">{hint}</span>}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Actual pay this cut-off · {b.cut.name}</h3>
        <p className="mb-2 text-xs text-muted">
          Each day pays the hours logged, up to {hoursPerDay} h ({formatRate(b.daily)} for a full day). Overtime counts only when approved by the department head and HR. Without approval, the system times the person out 30 minutes after {hoursPerDay} hours.
        </p>
        {b.days.length === 0 ? (
          <p className="text-sm text-muted">No hours logged in this cut-off yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1.5 font-medium">Day</th><th className="font-medium">Hours paid</th><th className="font-medium">Pay</th><th className="font-medium">Overtime</th><th className="font-medium">Day total</th></tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {b.days.map((d) => (
                  <tr key={d.day}>
                    <td className="py-1.5">{formatDay(d.day)} {d.systemTimeout && <Badge tone="danger">System time-out</Badge>} {d.status === "INCOMPLETE" && <Badge tone="brand">Still timed in</Badge>} {d.recoveredMinutes > 0 && <Badge tone="success">Recovered {formatDuration(d.recoveredMinutes)}</Badge>}</td>
                    <td>{formatDuration(d.regularMinutes) || "0m"}</td>
                    <td>{formatMoney(d.regularCents)}</td>
                    <td>{d.approvedOtMinutes ? `${formatDuration(d.approvedOtMinutes)} · ${formatMoney(d.otCents)}` : d.overtimeMinutes ? <span className="text-xs text-muted">{formatDuration(d.overtimeMinutes)} not approved</span> : "—"}</td>
                    <td className="font-semibold">{formatMoney(d.regularCents + d.otCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td className="pt-2 font-semibold" colSpan={4}>So far this cut-off (before deductions)</td><td className="pt-2 font-bold tabular-nums">{formatMoney(b.total)}</td></tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
