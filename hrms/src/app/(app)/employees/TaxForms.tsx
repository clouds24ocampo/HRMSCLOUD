"use client";

import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { WAGE_BASIS_LABEL, type WageBasis } from "@/lib/ph/calc";
import { addPreviousEmployment, removePreviousEmployment, saveTaxProfile } from "./tax-actions";

export type TaxProfileValues = {
  sector: "PRIVATE" | "GOVERNMENT"; mwe: boolean; wageBasis: WageBasis; customFactor: number | null; wageRegion: string;
  socialCovered: boolean; philhealthCovered: boolean; pagibigCovered: boolean; withholdingApplies: boolean;
  tin: string; sssNo: string; philhealthNo: string; pagibigNo: string; gsisNo: string;
};

const check = "h-4 w-4 accent-[var(--brand)]";

export function TaxProfileForm({ employeeId, today, current, hint }: { employeeId: string; today: string; current: TaxProfileValues; hint: WageBasis }) {
  const f = useKeptForm(saveTaxProfile.bind(null, employeeId));
  const [basis, setBasis] = useState<WageBasis>(current.wageBasis);
  const [sector, setSector] = useState(current.sector);
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Employee type
          <select name="sector" value={sector} onChange={(e) => setSector(e.target.value as typeof sector)} className={inputClass}>
            <option value="PRIVATE">Private sector (SSS)</option>
            <option value="GOVERNMENT">Government (GSIS)</option>
          </select>
        </label>
        <Field label="Starts on" id="effectiveFrom" type="date" required defaultValue={today} />
        <label className="block text-sm font-medium">
          Yearly wage factor
          <select name="wageBasis" value={basis} onChange={(e) => setBasis(e.target.value as WageBasis)} className={inputClass}>
            {(Object.keys(WAGE_BASIS_LABEL) as WageBasis[]).map((k) => <option key={k} value={k}>{WAGE_BASIS_LABEL[k]}{k === hint ? " (suggested by schedule)" : ""}</option>)}
          </select>
        </label>
        {basis === "CUSTOM" ? <Field label="Days a year" id="customFactor" type="number" min={200} max={366} defaultValue={current.customFactor ?? 260} required /> : <Field label="Wage region (for minimum wage check)" id="wageRegion" defaultValue={current.wageRegion} placeholder="NCR" />}
      </div>
      {basis === "CUSTOM" && <Field label="Wage region (for minimum wage check)" id="wageRegion" defaultValue={current.wageRegion} placeholder="NCR" />}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="mwe" defaultChecked={current.mwe} className={check} /> Minimum wage earner (basic pay and premiums are not taxed)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="withholdingApplies" defaultChecked={current.withholdingApplies} className={check} /> Withholding tax applies</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="socialCovered" defaultChecked={current.socialCovered} className={check} /> Covered by {sector === "GOVERNMENT" ? "GSIS" : "SSS"}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="philhealthCovered" defaultChecked={current.philhealthCovered} className={check} /> Covered by PhilHealth</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pagibigCovered" defaultChecked={current.pagibigCovered} className={check} /> Covered by Pag-IBIG</label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="TIN" id="tin" defaultValue={current.tin} />
        <Field label={sector === "GOVERNMENT" ? "GSIS number" : "SSS number"} id={sector === "GOVERNMENT" ? "gsisNo" : "sssNo"} defaultValue={sector === "GOVERNMENT" ? current.gsisNo : current.sssNo} />
        <Field label="PhilHealth number" id="philhealthNo" defaultValue={current.philhealthNo} />
        <Field label="Pag-IBIG number" id="pagibigNo" defaultValue={current.pagibigNo} />
        <Field label="Note (optional)" id="note" />
      </div>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Save tax profile</SubmitButton>
    </form>
  );
}

export function PreviousEmploymentForm({ employeeId, year }: { employeeId: string; year: number }) {
  const f = useKeptForm(addPreviousEmployment.bind(null, employeeId));
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Year" id="year" type="number" required defaultValue={year} />
        <Field label="Earlier employer" id="employerName" required />
        <Field label="Gross compensation (pesos)" id="gross" inputMode="decimal" required />
        <Field label="Taxable compensation (pesos)" id="taxable" inputMode="decimal" required />
        <Field label="Tax withheld (pesos)" id="withheld" inputMode="decimal" required />
        <Field label="Non-taxable compensation (optional)" id="nonTaxable" inputMode="decimal" />
        <Field label="13th month and benefits kept exempt (optional)" id="benefitsExempt" inputMode="decimal" />
        <Field label="13th month and benefits taxable (optional)" id="benefitsTaxable" inputMode="decimal" />
        <Field label="Contributions deducted (optional)" id="mandatory" inputMode="decimal" />
        <Field label="Note (optional)" id="note" />
      </div>
      <p className="text-xs text-muted">Copy these from the BIR Form 2316 the earlier employer gave this person.</p>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>Save earlier employment</SubmitButton>
    </form>
  );
}

export function RemovePreviousButton({ employeeId, rowId, label }: { employeeId: string; rowId: string; label: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} aria-label={`Remove ${label}`} onClick={() => start(() => removePreviousEmployment(employeeId, rowId))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">Remove</button>;
}
