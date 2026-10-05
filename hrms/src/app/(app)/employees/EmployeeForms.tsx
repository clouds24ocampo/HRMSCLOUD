"use client";

import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { createEmployeeAction, updateAssignment } from "./actions";

type Opt = { id: string; label: string };

function Select({ id, label, value, onChange, options, empty }: { id: string; label: string; value?: string; onChange?: (v: string) => void; options: Opt[]; empty: string }) {
  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <select id={id} name={id} className={inputClass} {...(onChange ? { value: value ?? "", onChange: (e) => onChange(e.target.value) } : { defaultValue: value ?? "" })}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

const empty = { firstName: "", lastName: "", email: "", phone: "", departmentId: "", positionId: "", managerId: "", password: "" };

export function AddEmployeeForm(p: { departments: Opt[]; positions: Opt[]; managers: Opt[]; roles: Opt[]; shifts: Opt[]; today: string }) {
  const [v, setV] = useState(empty);
  const [login, setLogin] = useState(false);
  const [roleId, setRoleId] = useState("");
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await createEmployeeAction(prev, fd);
    if (r?.ok) {
      setV(empty);
      setLogin(false);
    }
    return r;
  });
  const bind = (k: keyof typeof empty) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });
  const pickSel = (k: keyof typeof empty) => (val: string) => setV({ ...v, [k]: val });

  return (
    <form {...formProps} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" id="firstName" required {...bind("firstName")} />
        <Field label="Last name" id="lastName" required {...bind("lastName")} />
        <Field label="Email (optional)" id="email" type="email" {...bind("email")} />
        <Field label="Phone (optional)" id="phone" type="tel" {...bind("phone")} />
        <Select id="departmentId" label="Department" empty="Not set" options={p.departments} value={v.departmentId} onChange={pickSel("departmentId")} />
        <Select id="positionId" label="Position" empty="Not set" options={p.positions} value={v.positionId} onChange={pickSel("positionId")} />
        <Select id="managerId" label="Immediate supervisor" empty="No supervisor" options={p.managers} value={v.managerId} onChange={pickSel("managerId")} />
        <label htmlFor="hireDate" className="block text-sm font-medium">
          Hire date
          <input id="hireDate" name="hireDate" type="date" required defaultValue={p.today} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 rounded-xl border border-line bg-bg p-4 sm:grid-cols-2">
        <Select id="shiftId" label="Regular shift" empty="Set later" options={p.shifts} />
        <fieldset>
          <legend className="text-sm font-medium">Works on</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["1", "2", "3", "4", "5", "6", "0"] as const).map((v, i) => (
              <label key={v} className="cursor-pointer">
                <input type="checkbox" name="days" value={v} defaultChecked={i < 5} className="peer sr-only" />
                <span className="inline-block rounded-lg border border-line px-2.5 py-1 text-sm font-medium transition peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-muted sm:col-span-2">The schedule starts on the hire date. Without one, late, undertime and overtime cannot be measured.</p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="createLogin" checked={login} onChange={(e) => setLogin(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
        Also create a sign-in for this person
      </label>
      {login && (
        <div className="grid gap-4 rounded-xl border border-line bg-bg p-4 sm:grid-cols-2">
          <Select id="roleId" label="Role" empty="Choose a role" options={p.roles} value={roleId} onChange={setRoleId} />
          <Field label="Temporary password" id="password" type="password" autoComplete="new-password" minLength={10} {...bind("password")} />
          <p className="text-xs text-muted sm:col-span-2">Needs the email above. They must choose their own password at first sign-in.</p>
        </div>
      )}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Add employee</SubmitButton>
    </form>
  );
}

export function AssignmentForm(p: {
  employeeId: string; departments: Opt[]; positions: Opt[]; managers: Opt[];
  current: { departmentId: string; positionId: string; managerId: string; status: string };
  statuses: Opt[];
}) {
  const { state, pending, formProps } = useKeptForm(updateAssignment.bind(null, p.employeeId));
  return (
    <form {...formProps} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="departmentId" label="Department" empty="Not set" options={p.departments} value={p.current.departmentId} />
        <Select id="positionId" label="Position" empty="Not set" options={p.positions} value={p.current.positionId} />
        <Select id="managerId" label="Immediate supervisor" empty="No supervisor" options={p.managers} value={p.current.managerId} />
        <label htmlFor="status" className="block text-sm font-medium">
          Status
          <select id="status" name="status" defaultValue={p.current.status} className={inputClass}>
            {p.statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>
      <Field label="Reason or note (optional)" id="note" />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Save changes</SubmitButton>
    </form>
  );
}
