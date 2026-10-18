"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { assignSchedule, copyLastWeek, relinkToLeader } from "./actions";

type Opt = { id: string; label: string };

export type CellActivity = {
  firstIn?: string | null;
  lastOut?: string | null;
  workedMinutes?: number;
  workedDuration?: string;
  isFinished?: boolean;
  isInProgress?: boolean;
  events?: {
    type: string;
    name: string;
    icon: string;
    time: string;
    note?: string | null;
  }[];
  pauses?: {
    name: string;
    count: number;
    minutes: number;
  }[];
};

// One click on a day opens transaction details and (if manager) options to pick a shift, day off, or back to regular.
export function CellEditor({
  employeeId,
  day,
  weekday,
  shifts,
  children,
  locked,
  activity,
}: {
  employeeId: string;
  day: string;
  weekday: number;
  shifts: Opt[];
  children: React.ReactNode;
  locked?: boolean;
  activity?: CellActivity | null;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();

  const isInteractive = !locked || !!activity;
  if (!isInteractive) return <>{children}</>;

  const save = (shift: string) => {
    const fd = new FormData();
    fd.set("people", employeeId);
    fd.set("from", day);
    fd.set("to", day);
    fd.set("shift", shift);
    fd.set("days", String(weekday));
    start(async () => {
      const r = await assignSchedule(undefined, fd);
      setMsg(r?.error);
      if (!r?.error) setOpen(false);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Details for ${day}`}
        className="w-full rounded-lg transition hover:ring-2 hover:ring-brand/40 focus:outline-none"
      >
        {children}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label={`Schedule and activity for ${day}`}
            className="absolute left-1/2 z-30 mt-1 w-64 -translate-x-1/2 rounded-2xl border border-line bg-surface p-3 text-left text-xs shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
              <span className="font-semibold text-ink">{day}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-ink text-xs font-medium"
              >
                ✕
              </button>
            </div>

            {activity && (
              <div className="mb-3 space-y-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-2 text-emerald-900">
                  <div className="flex items-center justify-between font-semibold">
                    <span>
                      {activity.isFinished
                        ? "Finished transaction"
                        : activity.isInProgress
                        ? "In progress"
                        : "Activity recorded"}
                    </span>
                    {activity.workedDuration && (
                      <span className="font-mono text-emerald-700">{activity.workedDuration}</span>
                    )}
                  </div>
                  {activity.firstIn && (
                    <p className="mt-0.5 text-[11px] text-emerald-800">
                      {activity.firstIn} {activity.lastOut ? `– ${activity.lastOut}` : "– Now"}
                    </p>
                  )}
                </div>

                {activity.events && activity.events.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Timeline</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {activity.events.map((ev, i) => (
                        <div key={i} className="flex items-start justify-between gap-1 text-[11px]">
                          <span className="flex items-center gap-1.5 text-ink min-w-0">
                            <span>{ev.icon}</span>
                            <span className="font-medium truncate">{ev.name}</span>
                            {ev.note && <span className="text-[10px] text-muted italic truncate">({ev.note})</span>}
                          </span>
                          <span className="font-mono text-muted shrink-0">{ev.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activity.pauses && activity.pauses.length > 0 && (
                  <div className="border-t border-line/60 pt-1.5 text-[11px] text-muted">
                    <span className="font-medium text-ink">Pauses & breaks: </span>
                    {activity.pauses.map((pa, idx) => (
                      <span key={idx}>
                        {pa.name} ({pa.minutes}m){idx < activity.pauses!.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!locked && (
              <div className={activity ? "border-t border-line pt-2" : ""}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Change schedule</p>
                <div className="space-y-0.5">
                  {shifts.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={pending}
                      onClick={() => save(s.id)}
                      className="block w-full rounded-lg px-2 py-1 text-left text-xs transition hover:bg-bg"
                    >
                      {s.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save("OFF")}
                    className="block w-full rounded-lg px-2 py-1 text-left text-xs font-medium text-amber-700 hover:bg-amber-50"
                  >
                    Day off
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save("CLEAR")}
                    className="block w-full rounded-lg px-2 py-1 text-left text-xs text-muted hover:bg-bg"
                  >
                    Back to regular
                  </button>
                </div>
                {msg && <p role="alert" className="mt-1 text-danger">{msg}</p>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function RelinkButton({ employeeId }: { employeeId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setMsg((await relinkToLeader(employeeId))?.error))}
        className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
      >
        {pending ? "Linking…" : "Follow leader again"}
      </button>
      {msg && <span role="alert" className="ml-1 text-xs text-danger">{msg}</span>}
    </span>
  );
}

export function CopyWeekForm({ weekStart, peopleIds }: { weekStart: string; peopleIds: string[] }) {
  const [state, action, pending] = useActionState(copyLastWeek.bind(null, weekStart), undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      {peopleIds.map((id) => (
        <input key={id} type="hidden" name="people" value={id} />
      ))}
      <button
        disabled={pending}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg disabled:opacity-60"
      >
        {pending ? "Copying…" : "Copy last week's changes"}
      </button>
      {state?.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      {state?.ok && <span role="status" className="text-sm text-success">{state.ok}</span>}
    </form>
  );
}
