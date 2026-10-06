"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { assignSchedule, copyLastWeek, relinkToLeader } from "./actions";

type Opt = { id: string; label: string };

// One click on a day opens a small menu: pick a shift, a day off, or back to regular. Saves on choice, no form.
export function CellEditor({ employeeId, day, weekday, shifts, children, locked }: { employeeId: string; day: string; weekday: number; shifts: Opt[]; children: React.ReactNode; locked?: boolean }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  if (locked) return <>{children}</>;
  const save = (shift: string) => {
    const fd = new FormData();
    fd.set("people", employeeId); fd.set("from", day); fd.set("to", day); fd.set("shift", shift); fd.set("days", String(weekday));
    start(async () => {
      const r = await assignSchedule(undefined, fd);
      setMsg(r?.error);
      if (!r?.error) setOpen(false);
    });
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Change ${day}`} className="w-full rounded-lg transition hover:ring-2 hover:ring-brand/40">
        {children}
      </button>
      {open && (
        <div role="menu" className="absolute left-1/2 z-20 mt-1 w-44 -translate-x-1/2 rounded-xl border border-line bg-surface p-1 text-left text-xs shadow-lg">
          {shifts.map((s) => (
            <button key={s.id} role="menuitem" disabled={pending} onClick={() => save(s.id)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-bg">{s.label}</button>
          ))}
          <button role="menuitem" disabled={pending} onClick={() => save("OFF")} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-bg">Day off</button>
          <button role="menuitem" disabled={pending} onClick={() => save("CLEAR")} className="block w-full rounded-lg px-2 py-1.5 text-left text-muted hover:bg-bg">Back to regular</button>
          {msg && <p role="alert" className="px-2 py-1 text-danger">{msg}</p>}
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
      <button type="button" disabled={pending} onClick={() => start(async () => setMsg((await relinkToLeader(employeeId))?.error))} className="text-xs font-medium text-brand hover:underline disabled:opacity-50">
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
      {peopleIds.map((id) => <input key={id} type="hidden" name="people" value={id} />)}
      <button disabled={pending} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg disabled:opacity-60">{pending ? "Copying…" : "Copy last week's changes"}</button>
      {state?.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      {state?.ok && <span role="status" className="text-sm text-success">{state.ok}</span>}
    </form>
  );
}
