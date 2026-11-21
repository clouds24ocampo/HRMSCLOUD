import type { Step, StepKey } from "@/lib/hiring-pipeline";

// The road from applicant to hired as a row of numbered steps: done, where the person is now, and what comes next.
// Plain markup with no state, so the applicant's portal (server) and HR's card (client) both use it.
export function HiringJourney({ steps, current, compact = false, finalLabel }: { steps: Step[]; current: StepKey; compact?: boolean; finalLabel?: string }) {
  return (
    <ol aria-label="Hiring steps" className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7" : "sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"}`}>
      {steps.map((s, i) => {
        const now = s.key === current && !s.done;
        return (
          <li key={s.key} aria-current={now ? "step" : undefined} className={`rounded-xl border p-2.5 text-sm ${s.done ? "border-success/40 bg-success/5" : now ? "border-brand bg-brand/5 ring-1 ring-brand/30" : "border-line"}`}>
            <div className="flex items-center gap-2">
              <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${s.done ? "bg-success text-white" : now ? "bg-brand text-brand-ink" : "bg-line text-muted"}`}>{s.done ? "✓" : i + 1}</span>
              <span className={`font-semibold leading-tight ${s.done || now ? "" : "text-muted"}`}>{s.key === "hired" && finalLabel ? finalLabel : s.label}</span>
            </div>
            {!compact && <p className="mt-1.5 text-xs text-muted">{s.detail}</p>}
            <span className="sr-only">{s.done ? "Done" : now ? "Current step" : "Not yet"}</span>
          </li>
        );
      })}
    </ol>
  );
}
