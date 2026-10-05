"use client";

import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { STAMP_ICONS, STAMP_TONES } from "@/lib/defaults";
import { addChecklistTemplate, addLeaveType, addShift, addStampType, saveWorkRules } from "./actions";

function Messages({ state }: { state: FormState }) {
  return (
    <>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
    </>
  );
}

export function WorkRulesForm(p: { timezones: string[]; current: { timezone: string; gpsPolicy: string; graceMinutes: number; lowAccuracyMeters: number; requirePunchPassword: boolean; punchUnlockSeconds: number } }) {
  const { state, pending, formProps } = useKeptForm(saveWorkRules);
  return (
    <form {...formProps} className="space-y-4">
      <label htmlFor="timezone" className="block text-sm font-medium">
        Timezone
        <select id="timezone" name="timezone" defaultValue={p.current.timezone} className={inputClass}>
          {[...new Set([p.current.timezone, ...p.timezones])].map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium">If someone clocks in without a location</legend>
        <div className="mt-2 space-y-2">
          {[
            ["ALLOW_FLAG", "Allow it, flag it, and ask for a note", "Field staff in dead zones can still clock in."],
            ["BLOCK", "Do not allow the punch", "Strict: a location is required every time."],
          ].map(([v, t, d]) => (
            <label key={v} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
              <input type="radio" name="gpsPolicy" value={v} defaultChecked={p.current.gpsPolicy === v} className="mt-1 accent-[var(--brand)]" />
              <span><span className="block text-sm font-medium">{t}</span><span className="text-xs text-muted">{d}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grace period (minutes)" id="graceMinutes" type="number" min={0} max={120} defaultValue={p.current.graceMinutes} required />
        <Field label="Flag location worse than (meters)" id="lowAccuracyMeters" type="number" min={10} max={5000} defaultValue={p.current.lowAccuracyMeters} required />
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
          <input type="checkbox" name="requirePunchPassword" defaultChecked={p.current.requirePunchPassword} className="mt-1 h-4 w-4 accent-[var(--brand)]" />
          <span><span className="block text-sm font-medium">Ask for the password before every time stamp</span><span className="text-xs text-muted">Stops one person stamping for another.</span></span>
        </label>
        <Field label="Password unlock lasts (seconds)" id="punchUnlockSeconds" type="number" min={30} max={600} defaultValue={p.current.punchUnlockSeconds} required />
      </div>
      <Messages state={state} />
      <SubmitButton pending={pending}>Save work rules</SubmitButton>
    </form>
  );
}

export function AddShiftForm() {
  const [name, setName] = useState("");
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await addShift(prev, fd);
    if (r?.ok) setName("");
    return r;
  });
  return (
    <form {...formProps} className="space-y-3">
      <Field label="Shift name" id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Starts" id="startTime" type="time" defaultValue="08:00" required />
        <Field label="Ends" id="endTime" type="time" defaultValue="17:00" required />
        <Field label="Break (min)" id="breakMinutes" type="number" min={0} max={240} defaultValue={60} required />
      </div>
      <p className="text-xs text-muted">An end time earlier than the start means the shift finishes the next day (overnight).</p>
      <Messages state={state} />
      <SubmitButton pending={pending}>Add shift</SubmitButton>
    </form>
  );
}

export function AddLeaveTypeForm() {
  const [name, setName] = useState("");
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await addLeaveType(prev, fd);
    if (r?.ok) setName("");
    return r;
  });
  return (
    <form {...formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Leave type" id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Days per year" id="annualDays" type="number" min={0} max={365} defaultValue={5} required />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="paid" defaultChecked className="h-4 w-4 accent-[var(--brand)]" /> Paid leave
      </label>
      <Messages state={state} />
      <SubmitButton pending={pending}>Add leave type</SubmitButton>
    </form>
  );
}

export function AddStampTypeForm() {
  const [name, setName] = useState("");
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await addStampType(prev, fd);
    if (r?.ok) setName("");
    return r;
  });
  return (
    <form {...formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Flag when longer than (minutes, optional)" id="allowedMinutes" type="number" min={1} max={720} />
        <label className="block text-sm font-medium">
          Icon
          <select name="icon" defaultValue={STAMP_ICONS[0]} className={inputClass}>
            {STAMP_ICONS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Color
          <select name="tone" defaultValue="amber" className={inputClass}>
            {STAMP_TONES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Counts as working at
          <select name="defaultContext" defaultValue="" className={inputClass}>
            <option value="">Whatever the person chose</option>
            <option value="OFFICE">Office</option>
            <option value="FIELD">Field work</option>
            <option value="REMOTE">Remote</option>
            <option value="CLIENT_SITE">Client site</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="paid" defaultChecked className="h-4 w-4 accent-[var(--brand)]" /> Paid (counts as worked time)</label>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="requiresNote" className="h-4 w-4 accent-[var(--brand)]" /> Needs a note</label>
      </div>
      <Messages state={state} />
      <SubmitButton pending={pending}>Add time stamp</SubmitButton>
    </form>
  );
}

export function AddChecklistTemplateForm() {
  const [title, setTitle] = useState("");
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await addChecklistTemplate(prev, fd);
    if (r?.ok) setTitle("");
    return r;
  });
  return (
    <form {...formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          For
          <select name="kind" defaultValue="ONBOARDING" className={inputClass}>
            <option value="ONBOARDING">New hires</option>
            <option value="OFFBOARDING">People leaving</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Done by
          <select name="owner" defaultValue="HR" className={inputClass}>
            <option value="HR">HR</option>
            <option value="MANAGER">The manager</option>
            <option value="EMPLOYEE">The employee</option>
          </select>
        </label>
        <Field label="Task" id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <Messages state={state} />
      <SubmitButton pending={pending}>Add task</SubmitButton>
    </form>
  );
}
