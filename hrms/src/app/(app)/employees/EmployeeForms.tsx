"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { File201 } from "@/app/(app)/documents/File201";
import { FILE_201 } from "@/lib/file201";
import { formatMoney, formatRate, parsePesos } from "@/lib/money";
import { rates } from "@/lib/ph/calc";
import { createEmployeeAction, deleteEmployee, updateAssignment, updateDetails } from "./actions";

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

const empty = { firstName: "", lastName: "", email: "", phone: "", departmentId: "", positionId: "", managerId: "", username: "", password: "", monthlySalary: "" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Same formula as the payroll: monthly × 12 ÷ days a year, then ÷ hours a day.
function RatePreview({ monthly, daysPerYear, hoursPerDay }: { monthly: string; daysPerYear: number; hoursPerDay: number }) {
  const cents = parsePesos(monthly);
  if (!cents) return <p className="text-xs text-muted">Daily rate = monthly × 12 ÷ {daysPerYear} days. Hourly = daily ÷ {hoursPerDay} hours. Pay follows the hours logged on the DTR.</p>;
  const r = rates("MONTHLY", cents, daysPerYear, hoursPerDay);
  return (
    <p className="text-sm" aria-live="polite">
      Daily rate <span className="font-semibold tabular-nums">{formatRate(r.daily)}</span> · hourly <span className="font-semibold tabular-nums">{formatRate(r.hourly)}</span>
      <span className="block text-xs text-muted">{formatMoney(cents)} × 12 ÷ {daysPerYear} days ÷ {hoursPerDay} h. Paid for the hours logged on the DTR.</span>
    </p>
  );
}

export function AddEmployeeForm(p: { departments: Opt[]; positions: Opt[]; managers: Opt[]; roles: Opt[]; defaultRoleId: string; shifts: Opt[]; today: string; daysPerYear: number; hoursPerDay: number }) {
  const [v, setV] = useState(empty);
  const [login, setLogin] = useState(true);
  const [flexible, setFlexible] = useState(false);
  const [roleId, setRoleId] = useState(p.defaultRoleId);
  const [idMode, setIdMode] = useState<"auto" | "manual">("auto");
  const [manualId, setManualId] = useState("");
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const { state, pending, formProps } = useKeptForm(async (prev: FormState, fd: FormData) => {
    const r = await createEmployeeAction(prev, fd);
    if (r?.ok && r.id) {
      setCreated({ id: r.id, name: `${v.firstName} ${v.lastName}` });
      setV(empty);
      setFlexible(false);
      setIdMode("auto");
      setManualId("");
    }
    return r;
  });
  const bind = (k: keyof typeof empty) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });
  const pickSel = (k: keyof typeof empty) => (val: string) => setV({ ...v, [k]: val });

  return (
    <div className="space-y-6">
      <form {...formProps} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" id="firstName" required {...bind("firstName")} />
          <Field label="Last name" id="lastName" required {...bind("lastName")} />
          <Field label={login ? "Email" : "Email (optional)"} id="email" type="email" required={login} {...bind("email")} />
          <Field label="Phone (optional)" id="phone" type="tel" {...bind("phone")} />
          <Select id="departmentId" label="Department" empty="Not set" options={p.departments} value={v.departmentId} onChange={pickSel("departmentId")} />
          <Select id="positionId" label="Position" empty="Not set" options={p.positions} value={v.positionId} onChange={pickSel("positionId")} />
          <Select id="managerId" label="Immediate supervisor" empty="No supervisor" options={p.managers} value={v.managerId} onChange={pickSel("managerId")} />
          <label htmlFor="hireDate" className="block text-sm font-medium">
            Hire date
            <input id="hireDate" name="hireDate" type="date" required defaultValue={p.today} className={inputClass} />
          </label>
        </div>

        <div className="space-y-3 rounded-xl border border-line bg-bg p-4">
          <fieldset>
            <legend className="text-sm font-medium">Employee / Contractor ID number</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="idMode" value="auto" checked={idMode === "auto"} onChange={() => setIdMode("auto")} className="h-4 w-4 accent-brand" />
                Auto-generate ({p.today.replace(/-/g, "")}-0001)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="idMode" value="manual" checked={idMode === "manual"} onChange={() => setIdMode("manual")} className="h-4 w-4 accent-brand" />
                Manual input
              </label>
            </div>
          </fieldset>
          {idMode === "manual" ? (
            <Field label="Custom ID number" id="employeeNo" required placeholder="e.g. 20261017-0001 or CONT-101" value={manualId} onChange={(e) => setManualId(e.target.value)} />
          ) : (
            <p className="text-xs text-muted">ID will be automatically generated starting with {p.today.replace(/-/g, "")}-0001 based on creation date.</p>
          )}
        </div>

        <div className="grid items-end gap-4 rounded-xl border border-line bg-bg p-4 sm:grid-cols-2">
          <MoneyInput label="Monthly salary (pesos)" id="monthlySalary" required placeholder="10,000.00" value={v.monthlySalary} onValue={(x) => setV({ ...v, monthlySalary: x })} />
          <RatePreview monthly={v.monthlySalary} daysPerYear={p.daysPerYear} hoursPerDay={p.hoursPerDay} />
        </div>

        <div className="space-y-4 rounded-xl border border-line bg-bg p-4">
          <fieldset>
            <legend className="text-sm font-medium">Schedule</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="scheduleKind" checked={!flexible} onChange={() => setFlexible(false)} className="h-4 w-4 accent-brand" /> Fixed shift</label>
              <label className="flex items-center gap-2"><input type="radio" name="scheduleKind" checked={flexible} onChange={() => setFlexible(true)} className="h-4 w-4 accent-brand" /> Flexible</label>
            </div>
            {flexible && <input type="hidden" name="flexible" value="on" />}
          </fieldset>
          {flexible ? (
            <p className="text-sm text-muted">
              Their own start time and days off, but at least <span className="font-semibold text-ink">8 hours</span> on every working day and at least <span className="font-semibold text-ink">1 day off a week</span>. Fewer hours show as undertime; a 7th worked day in a row is flagged on the DTR.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Select id="shiftId" label="Regular shift" empty="Set later" options={p.shifts} />
              <fieldset>
                <legend className="text-sm font-medium">Works on</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["1", "2", "3", "4", "5", "6", "0"] as const).map((d, i) => (
                    <label key={d} className="cursor-pointer">
                      <input type="checkbox" name="days" value={d} defaultChecked={i < 6} className="peer sr-only" />
                      <span className="inline-block rounded-lg border border-line px-2.5 py-1 text-sm font-medium transition peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand">{DAYS[i]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="text-xs text-muted sm:col-span-2">The schedule starts on the hire date. Without one, late, undertime and overtime cannot be measured.</p>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="createLogin" checked={login} onChange={(e) => setLogin(e.target.checked)} className="h-4 w-4 accent-brand" />
          Create their own sign-in (username, password and dashboard)
        </label>
        {login && (
          <div className="grid gap-4 rounded-xl border border-line bg-bg p-4 sm:grid-cols-2">
            <Field label="Username" id="username" required autoCapitalize="none" spellCheck={false} pattern="[a-zA-Z0-9._\-]{3,30}" title="3 to 30 letters, numbers, dots, dashes or underscores" autoComplete="off" {...bind("username")} />
            <Select id="roleId" label="Role" empty="Choose a role" options={p.roles} value={roleId} onChange={setRoleId} />
            <Field label="Temporary password" id="password" type="password" autoComplete="new-password" minLength={10} required {...bind("password")} />
            <p className="text-xs text-muted">They sign in with this username (or the email) and choose their own password at first sign-in, then upload their 201 file.</p>
          </div>
        )}
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        {state?.ok && <Alert kind="success">{state.ok}</Alert>}
        <SubmitButton pending={pending}>Add employee</SubmitButton>
      </form>

      {created && (
        <section aria-label={`201 file of ${created.name}`} className="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">201 file of {created.name} <span className="text-sm font-normal text-muted">(optional for HR)</span></h3>
            <button type="button" onClick={() => setCreated(null)} className="text-sm font-medium text-muted hover:text-ink">Done</button>
          </div>
          <File201 employeeId={created.id} mandatory={false} items={FILE_201.map((r) => ({ ...r, doc: null }))} />
        </section>
      )}
    </div>
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

export function EditDetailsForm(p: {
  employeeId: string; hasLogin: boolean;
  current: { firstName: string; lastName: string; email: string; phone: string; hireDate: string; username: string };
}) {
  const { state, pending, formProps } = useKeptForm(updateDetails.bind(null, p.employeeId));
  const c = p.current;
  return (
    <form {...formProps} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" id="firstName" required defaultValue={c.firstName} />
        <Field label="Last name" id="lastName" required defaultValue={c.lastName} />
        <Field label={p.hasLogin ? "Email (sign-in)" : "Email (optional)"} id="email" type="email" required={p.hasLogin} defaultValue={c.email} />
        <Field label="Phone (optional)" id="phone" type="tel" defaultValue={c.phone} />
        <Field label="Hire date" id="hireDate" type="date" required defaultValue={c.hireDate} />
        {p.hasLogin && <Field label="Username (optional)" id="username" autoCapitalize="none" spellCheck={false} autoComplete="off" defaultValue={c.username} />}
      </div>
      {p.hasLogin && (
        <Field label="New temporary password (optional, at least 10 characters)" id="newPassword" type="password" autoComplete="new-password" minLength={10} placeholder="Leave empty to keep their password" />
      )}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      <SubmitButton pending={pending}>Save details</SubmitButton>
    </form>
  );
}

export function DeleteEmployeeForm({ employeeId, employeeNo, name, superAdmin }: { employeeId: string; employeeNo: string; name: string; superAdmin: boolean }) {
  const { state, pending, formProps } = useKeptForm(deleteEmployee.bind(null, employeeId));
  return (
    <form {...formProps} className="space-y-3">
      <p className="text-sm text-muted">
        Only for someone added by mistake. If {name} has any work records (time stamps, payslips, leave, documents…), deleting is refused: set their status to <span className="font-semibold">Separated</span> instead, which turns off their sign-in and keeps their history.
      </p>
      <Field label={`Type ${employeeNo} to confirm`} id="confirm" required autoComplete="off" />
      {superAdmin && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="withRecords" className="mt-0.5 h-4 w-4 accent-danger" />
          <span>Also delete all their records (time stamps, leave, overtime, unfinalized payslips, documents, reports, signatures). This cannot be undone. Finalized payslips are always kept.</span>
        </label>
      )}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-danger px-4 py-2.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60">
        {pending ? "Deleting…" : `Delete ${name} permanently`}
      </button>
    </form>
  );
}
