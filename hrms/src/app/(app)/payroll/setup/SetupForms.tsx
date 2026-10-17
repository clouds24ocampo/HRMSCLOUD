"use client";

import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { addBracket, addComponent, addContribution, saveFactors, savePhSettings } from "./actions";

const Msg = ({ s }: { s: FormState }) => (
  <>
    {s?.error && <Alert kind="error">{s.error}</Alert>}
    {s?.ok && <Alert kind="success">{s.ok}</Alert>}
  </>
);

export function FactorsForm({ current }: { current: { workDaysPerMonth: number; hoursPerDay: number; otMultiplierBp: number; daysPerYear: number; payByLoggedHours: boolean; autoCutoffs: boolean } }) {
  const f = useKeptForm(saveFactors);
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Paid days a year" id="daysPerYear" type="number" min={200} max={366} defaultValue={current.daysPerYear} required />
        <Field label="Work days per month" id="workDaysPerMonth" type="number" min={1} max={31} defaultValue={current.workDaysPerMonth} required />
        <Field label="Work hours per day" id="hoursPerDay" type="number" min={1} max={24} defaultValue={current.hoursPerDay} required />
        <Field label="Overtime pays (% of normal)" id="otMultiplierPct" defaultValue={String(current.otMultiplierBp / 100)} required />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="payByLoggedHours" defaultChecked={current.payByLoggedHours} className="h-4 w-4 accent-brand" />
        Pay monthly salaries by the hours logged on the DTR
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="autoCutoffs" defaultChecked={current.autoCutoffs} className="h-4 w-4 accent-brand" />
        Create the 1–15 and 16–end-of-month cut-offs automatically and keep them up to date every hour
      </label>
      <p className="text-xs text-muted">Daily rate = monthly × 12 ÷ paid days a year (313 = six-day week). Hourly rate = daily rate ÷ hours. With logged hours on, each day pays the hours worked up to the normal day; approved overtime is added on top. Overtime 125 means 1.25 times the normal rate. Work days per month is kept only as a fallback for older records.</p>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Save factors</SubmitButton>
    </form>
  );
}

export function PhSettingsForm({ current }: { current: { statutoryProfile: string; contributionSchedule: string } }) {
  const f = useKeptForm(savePhSettings);
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Rates come from
          <select name="statutoryProfile" defaultValue={current.statutoryProfile} className={inputClass}>
            <option value="MANUAL">Rates I enter below</option>
            <option value="PHILIPPINES">Philippine statutory rules (dated, versioned)</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          SSS, GSIS, PhilHealth and Pag-IBIG come off pay
          <select name="contributionSchedule" defaultValue={current.contributionSchedule} className={inputClass}>
            <option value="EVERY_PERIOD">In every pay period (split)</option>
            <option value="LAST_PERIOD">Once a month, in the last period</option>
          </select>
        </label>
      </div>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Save</SubmitButton>
    </form>
  );
}

export function AddComponentForm({ deMinimis = [] }: { deMinimis?: { code: string; name: string }[] }) {
  const [calc, setCalc] = useState("FIXED");
  const [treatment, setTreatment] = useState("");
  const [name, setName] = useState("");
  const f = useKeptForm(async (p: FormState, fd: FormData) => {
    const r = await addComponent(p, fd);
    if (r?.ok) setName("");
    return r;
  });
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <label className="block text-sm font-medium">
          Type
          <select name="kind" defaultValue="EARNING" className={inputClass}>
            <option value="EARNING">Adds to pay (allowance, bonus)</option>
            <option value="DEDUCTION">Takes from pay (loan, insurance)</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Amount is
          <select name="calc" value={calc} onChange={(e) => setCalc(e.target.value)} className={inputClass}>
            <option value="FIXED">A fixed amount each pay period</option>
            <option value="PERCENT_OF_BASIC">A percentage of basic pay</option>
          </select>
        </label>
        <Field label={calc === "FIXED" ? "Amount (pesos)" : "Percentage"} id="value" inputMode="decimal" required placeholder={calc === "FIXED" ? "1000.00" : "10"} />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="taxable" defaultChecked className="h-4 w-4 accent-[var(--brand)]" /> Counts as taxable pay</label>
      <details className="rounded-lg border border-line px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-brand">Philippine tax treatment (optional)</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm font-medium">
            Special treatment
            <select name="treatment" value={treatment} onChange={(e) => setTreatment(e.target.value)} className={inputClass}>
              <option value="">None: follow the taxable box above</option>
              <option value="DE_MINIMIS">De minimis benefit: exempt up to its limit</option>
              <option value="OTHER_BENEFIT">Bonus or benefit that shares the yearly ₱90,000 exemption</option>
            </select>
          </label>
          {treatment === "DE_MINIMIS" && (
            <label className="block text-sm font-medium">
              Which benefit
              <select name="deMinimisCode" defaultValue="" className={inputClass}>
                <option value="" disabled>Choose…</option>
                {deMinimis.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="preTax" className="h-4 w-4 accent-[var(--brand)]" /> Deduction taken before tax (for example union dues)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inContributionBase" className="h-4 w-4 accent-[var(--brand)]" /> Pay item counts toward the pay that SSS is based on</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="mweExempt" className="h-4 w-4 accent-[var(--brand)]" /> Stays untaxed for minimum wage earners (hazard pay)</label>
        </div>
      </details>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Add pay item</SubmitButton>
    </form>
  );
}

export function AddContributionForm() {
  const [name, setName] = useState("");
  const f = useKeptForm(async (p: FormState, fd: FormData) => {
    const r = await addContribution(p, fd);
    if (r?.ok) setName("");
    return r;
  });
  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Name" id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Employee pays (%)" id="employeePct" inputMode="decimal" required placeholder="4.5" />
        <Field label="Employer pays (%)" id="employerPct" inputMode="decimal" required placeholder="9.5" />
        <Field label="Lowest pay it applies to (pesos, optional)" id="minBase" inputMode="decimal" placeholder="0.00" />
        <Field label="Highest pay it applies to (pesos, optional)" id="maxBase" inputMode="decimal" placeholder="no limit" />
      </div>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Add contribution</SubmitButton>
    </form>
  );
}

export function AddBracketForm() {
  const f = useKeptForm(addBracket);
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Taxable pay from (pesos)" id="from" inputMode="decimal" required placeholder="0.00" />
        <Field label="Rate on the excess (%)" id="ratePct" inputMode="decimal" required placeholder="20" />
        <Field label="Plus fixed tax (pesos)" id="fixed" inputMode="decimal" placeholder="0.00" />
      </div>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Add bracket</SubmitButton>
    </form>
  );
}
