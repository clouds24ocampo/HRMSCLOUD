"use client";

import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { assignSchedule, setRegularSchedule } from "./actions";

const WEEK = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]] as const;
type Person = { id: string; label: string };
export type Team = { id: string; label: string; members: string[] }; // a leader and everyone below them

function PeoplePicker({ people, picked, setPicked, teams = [] }: { people: Person[]; picked: string[]; setPicked: (v: string[]) => void; teams?: Team[] }) {
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  // The dropdown names the team whose people are exactly the ones ticked, so the choice stays visible after picking.
  const team = teams.find((t) => t.members.length === picked.length && t.members.every((m) => picked.includes(m)))?.id ?? "";
  return (
    <fieldset>
      <div className="mb-2 flex items-center justify-between">
        <legend className="text-sm font-medium">People ({picked.length} chosen)</legend>
        <button type="button" className="text-sm font-medium text-brand hover:underline" onClick={() => setPicked(picked.length === people.length ? [] : people.map((x) => x.id))}>
          {picked.length === people.length ? "Clear all" : "Choose everyone"}
        </button>
      </div>
      {teams.length > 0 && (
        <label className="mb-2 block text-sm font-medium">
          Pick a whole team in one click
          <select value={team} onChange={(e) => { const t = teams.find((x) => x.id === e.target.value); if (t) setPicked(t.members); }} className={inputClass}>
            <option value="">Choose a leader…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.label} ({t.members.length})</option>
            ))}
          </select>
        </label>
      )}
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
        {people.map((x) => (
          <label key={x.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-bg">
            <input type="checkbox" name="people" value={x.id} checked={picked.includes(x.id)} onChange={() => toggle(x.id)} className="h-4 w-4 accent-[var(--brand)]" />
            {x.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function WeekdayPicker({ legend = "On these days", defaults = [1, 2, 3, 4, 5] }: { legend?: string; defaults?: number[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {WEEK.map(([v, l]) => (
          <label key={v} className="cursor-pointer">
            <input type="checkbox" name="days" value={v} defaultChecked={defaults.includes(Number(v))} className="peer sr-only" />
            <span className="inline-block rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand peer-focus-visible:outline-2">{l}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Same shift every week on chosen weekdays, from a date. One person (profile) or many (schedule page).
export function RegularScheduleForm(p: { people: Person[]; teams?: Team[]; shifts: Person[]; from: string; preselect?: string; fixedPerson?: string; defaultShift?: string; defaultDays?: number[] }) {
  const [picked, setPicked] = useState<string[]>(p.preselect ? [p.preselect] : []);
  const { state, pending, formProps } = useKeptForm(setRegularSchedule);
  return (
    <form {...formProps} className="space-y-4">
      {p.fixedPerson ? <input type="hidden" name="people" value={p.fixedPerson} /> : <PeoplePicker people={p.people} picked={picked} setPicked={setPicked} teams={p.teams} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Regular shift
          <select name="shiftId" required defaultValue={p.defaultShift ?? ""} className={inputClass}>
            <option value="" disabled>Choose…</option>
            {p.shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Starts on
          <input type="date" name="effectiveFrom" defaultValue={p.from} required className={inputClass} />
        </label>
      </div>
      <WeekdayPicker legend="Works on" defaults={p.defaultDays} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Save regular schedule</SubmitButton>
    </form>
  );
}

// Specific days that differ from the regular schedule.
export function ScheduleForm(p: { people: Person[]; teams?: Team[]; shifts: Person[]; from: string; to: string; preselect?: string }) {
  const [picked, setPicked] = useState<string[]>(p.preselect ? [p.preselect] : []);
  const { state, pending, formProps } = useKeptForm(assignSchedule);
  return (
    <form {...formProps} className="space-y-4">
      <PeoplePicker people={p.people} picked={picked} setPicked={setPicked} teams={p.teams} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Shift
          <select name="shift" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose…</option>
            {p.shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
            <option value="OFF">Day off</option>
            <option value="CLEAR">Back to the regular schedule</option>
          </select>
        </label>
        <label className="block text-sm font-medium">From<input type="date" name="from" defaultValue={p.from} required className={inputClass} /></label>
        <label className="block text-sm font-medium">To<input type="date" name="to" defaultValue={p.to} required className={inputClass} /></label>
      </div>
      <WeekdayPicker />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Save changes</SubmitButton>
    </form>
  );
}
