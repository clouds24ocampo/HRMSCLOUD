"use client";

import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { addRuleVersion, addWageOrder, endRule, installLeaves, installPack, removeRule, removeWageOrder } from "./actions";

const Msg = ({ s }: { s: FormState }) => (
  <>
    {s?.error && <Alert kind="error">{s.error}</Alert>}
    {s?.ok && <Alert kind="success">{s.ok}</Alert>}
  </>
);

export function InstallButtons({ what }: { what: "rules" | "leaves" }) {
  const [msg, setMsg] = useState<FormState>();
  const [pending, start] = useTransition();
  const go = (scope: "PRIVATE" | "GOVERNMENT" | "BOTH") => {
    setMsg(undefined);
    start(async () => setMsg(await (what === "rules" ? installPack(scope) : installLeaves(scope))));
  };
  const btn = "rounded-lg border border-line px-4 py-2 text-sm font-semibold transition hover:bg-bg active:scale-95 disabled:opacity-60";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => go("PRIVATE")} className={btn}>Private sector</button>
        <button disabled={pending} onClick={() => go("GOVERNMENT")} className={btn}>Government</button>
        <button disabled={pending} onClick={() => go("BOTH")} className={btn}>Both</button>
      </div>
      <div aria-live="polite"><Msg s={msg} /></div>
    </div>
  );
}

export type ExistingRule = { code: string; kind: string; sector: string; name: string; agency: string; legalBasis: string; params: string };

const KIND_LABEL: Record<string, string> = {
  SSS: "SSS-type contribution (salary credit table)", PERCENT_CONTRIBUTION: "Percentage contribution (PhilHealth, Pag-IBIG, GSIS)", WITHHOLDING_TABLE: "Withholding tax table",
  ANNUAL_TAX_TABLE: "Annual income tax rates", DE_MINIMIS: "De minimis benefit limit", BENEFITS_POOL: "Yearly 13th month and benefits exemption", PREMIUM_PAY: "Premium pay (holiday, rest day, overtime, night)", INCENTIVE: "Government bonus or incentive",
};

// A new version of a rule (for example when a circular changes a rate) or a brand new one.
export function AddRuleVersionForm({ existing }: { existing: ExistingRule[] }) {
  const [code, setCode] = useState("");
  const [fields, setFields] = useState({ kind: "", sector: "ALL", name: "", agency: "COMPANY", legalBasis: "", params: "" });
  const blank = { kind: "", sector: "ALL", name: "", agency: "COMPANY", legalBasis: "", params: "" };
  const f = useKeptForm(async (p: FormState, fd: FormData) => {
    const r = await addRuleVersion(p, fd);
    if (r?.ok) {
      setCode("");
      setFields(blank);
    }
    return r;
  });
  const pick = (c: string) => {
    setCode(c);
    const e = existing.find((x) => x.code === c);
    if (e) setFields({ kind: e.kind, sector: e.sector, name: e.name, agency: e.agency, legalBasis: "", params: e.params });
  };
  const set = (k: keyof typeof fields) => (e: { target: { value: string } }) => setFields({ ...fields, [k]: e.target.value });
  const known = existing.find((x) => x.code === code);
  return (
    <form {...f.formProps} className="space-y-3">
      <label className="block text-sm font-medium">
        Rule to update
        <select value={known ? code : code === "" ? "" : "__new"} onChange={(e) => (e.target.value === "__new" ? (setCode("NEW_RULE"), setFields(blank)) : pick(e.target.value))} className={inputClass}>
          <option value="" disabled>Choose a rule…</option>
          {existing.map((e) => <option key={e.code} value={e.code}>{e.code}: {e.name}</option>)}
          <option value="__new">A new rule (new code)</option>
        </select>
      </label>
      {code !== "" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" name="code" id="code" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} readOnly={!!known} />
            <label className="block text-sm font-medium">
              Kind
              <select name="kind" value={fields.kind} onChange={set("kind")} disabled={!!known} className={inputClass} required>
                <option value="" disabled>Choose…</option>
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {known && <input type="hidden" name="kind" value={fields.kind} />}
            </label>
            <label className="block text-sm font-medium">
              Applies to
              <select name="sector" value={fields.sector} onChange={set("sector")} className={inputClass}>
                <option value="ALL">Everyone</option>
                <option value="PRIVATE">Private employees</option>
                <option value="GOVERNMENT">Government employees</option>
              </select>
            </label>
            <Field label="Name" id="name" required value={fields.name} onChange={set("name")} />
            <Field label="In force from" id="effectiveFrom" type="date" required />
            <Field label="Until (leave empty if open-ended)" id="effectiveTo" type="date" />
          </div>
          <Field label="Where this comes from (law, circular, contract)" id="legalBasis" required value={fields.legalBasis} onChange={set("legalBasis")} placeholder="For example: BIR RR 12-2027" />
          <input type="hidden" name="agency" value={fields.agency} />
          <label className="block text-sm font-medium">
            Parameters (change only the numbers; money is in centavos, rates in basis points: 100 = 1%)
            <textarea name="params" value={fields.params} onChange={set("params")} rows={10} spellCheck={false} className={`${inputClass} font-mono text-xs`} required />
          </label>
          <p className="text-xs text-muted">The earlier version of this rule ends the day before the new one starts, so old payrolls keep the rates that applied then.</p>
        </>
      )}
      <Msg s={f.state} />
      {code !== "" && <SubmitButton pending={f.pending}>Save this version</SubmitButton>}
    </form>
  );
}

export function EndRuleForm({ id }: { id: string }) {
  const f = useKeptForm(endRule.bind(null, id));
  return (
    <form {...f.formProps} className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium">Last day<input type="date" name="effectiveTo" required className="mt-1 block rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" /></label>
      <button disabled={f.pending} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">End version</button>
      {f.state?.error && <span className="text-xs text-danger">{f.state.error}</span>}
    </form>
  );
}

export function RemoveRuleButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} aria-label={`Remove ${label}`} onClick={() => { if (window.confirm(`Remove ${label}? Payslips already calculated keep their own copy.`)) start(() => removeRule(id)); }} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      Remove
    </button>
  );
}

export function WageOrderForm() {
  const f = useKeptForm(addWageOrder);
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Region" id="region" required placeholder="NCR" />
        <Field label="Wage order number" id="orderNo" required placeholder="NCR-26" />
        <Field label="Daily minimum wage (pesos)" id="daily" inputMode="decimal" required placeholder="695.00" />
        <Field label="Sector (optional)" id="sector" placeholder="Non-agriculture" />
        <Field label="In force from" id="effectiveFrom" type="date" required />
        <Field label="Until (optional)" id="effectiveTo" type="date" />
      </div>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Add wage order</SubmitButton>
    </form>
  );
}

export function RemoveWageOrderButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} aria-label={`Remove ${label}`} onClick={() => start(() => removeWageOrder(id))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">Remove</button>;
}
