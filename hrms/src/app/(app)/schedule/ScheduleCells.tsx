"use client";

import { Icon } from "@/components/Icon";
import { useState, useTransition } from "react";
import { useActionState } from "react";
import Link from "next/link";
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

// Every schedule cell is clickable and routes to all timestamps and activity for that employee and day.
// For managers with edit rights, a quick-action pencil trigger allows changing shifts on the spot.
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

  const dtrUrl = `/dtr?employee=${employeeId}&from=${day}&to=${day}`;

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
    <div className="relative group/cell flex items-center justify-center">
      <Link
        href={dtrUrl}
        aria-label={`View timestamps and activity for ${day}`}
        title={
          activity?.isFinished
            ? `Finished transaction (${activity.firstIn}–${activity.lastOut} · ${activity.workedDuration}) · Click to view all timestamps and activity`
            : activity?.isInProgress
            ? `In progress (${activity.firstIn}–Now) · Click to view all timestamps and activity`
            : `Click to view all timestamps and activity for ${day}`
        }
        className="block w-full cursor-pointer rounded-lg p-0.5 transition duration-150 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-brand/40"
      >
        {children}
      </Link>

      {!locked && (
        <div className="absolute -top-1 -right-1 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            aria-expanded={open}
            aria-label={`Change schedule for ${day}`}
            title={`Change schedule for ${day}`}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-[10px] text-muted shadow-xs transition hover:border-brand/40 hover:bg-bg hover:text-ink opacity-0 group-hover/cell:opacity-100 max-sm:opacity-70 focus:opacity-100"
          >
            <Icon name="edit" className="h-3 w-3" />
          </button>
          {open && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                aria-hidden="true"
              />
              <div
                role="dialog"
                aria-label={`Change schedule for ${day}`}
                className="absolute right-0 z-30 mt-1 w-64 rounded-2xl border border-line bg-surface p-3 text-left text-xs shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
                  <span className="font-semibold text-ink">{day}</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-muted hover:text-ink text-xs font-medium"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </div>

                <div>
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

                <div className="mt-3 border-t border-line pt-2">
                  <Link
                    href={dtrUrl}
                    className="flex items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand/10 transition"
                  >
                    <span>View timestamps & activity</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
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
