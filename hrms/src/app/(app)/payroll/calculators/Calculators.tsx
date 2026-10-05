"use client";

import { useState } from "react";
import { formatMoney, parsePesos } from "@/lib/money";
import { MATERNITY_DAYS, gsisRetirement, sssMaternity, sssSickness, terminalLeave } from "@/lib/ph/benefits";
import { Card, inputClass } from "@/components/ui";

const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => <div className={`flex justify-between gap-4 border-b border-line py-1.5 text-sm ${strong ? "font-semibold" : ""}`}><dt className="text-muted">{k}</dt><dd className="tabular-nums">{v}</dd></div>;
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const pesos = (s: string) => (s.trim() === "" ? null : parsePesos(s));

function Msc({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      Monthly salary credits, one per month, separated by commas (use the six highest of the last 12 months)
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="25000, 25000, 22500, 25000, 25000, 20000" className={inputClass} />
    </label>
  );
}
const parseMsc = (s: string) => s.split(",").map((x) => parsePesos(x.trim())).filter((x): x is number => x !== null && x > 0);

export function Calculators() {
  const [msc, setMsc] = useState("");
  const [days, setDays] = useState("");
  const [kind, setKind] = useState<keyof typeof MATERNITY_DAYS>("LIVE_BIRTH");
  const [daily, setDaily] = useState("");
  const [amc, setAmc] = useState("");
  const [years, setYears] = useState("");
  const [leave, setLeave] = useState("");
  const [salary, setSalary] = useState("");

  const credits = parseMsc(msc);
  const sick = credits.length > 0 && num(days) ? sssSickness(credits, num(days)!) : null;
  const mat = credits.length > 0 && pesos(daily) ? sssMaternity(credits, kind, pesos(daily)!) : null;
  const gsis = pesos(amc) && num(years) ? gsisRetirement(pesos(amc)!, num(years)!) : null;
  const term = num(leave) && pesos(salary) ? terminalLeave(num(leave)!, pesos(salary)!) : null;

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">SSS sickness benefit</h2>
        <p className="text-sm text-muted">90% of the average daily salary credit for each compensable day, up to 120 days a year. The employee must have at least 3 monthly contributions in the 12 months before the semester of sickness, and the sickness must last at least 4 days.</p>
        <Msc value={msc} onChange={setMsc} />
        <label className="block text-sm font-medium">Compensable days<input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} placeholder="10" className={inputClass} /></label>
        {sick && (
          <dl>
            <Row k="Average daily salary credit" v={formatMoney(sick.adscCents)} />
            <Row k="Daily allowance (90%)" v={formatMoney(sick.dailyCents)} />
            <Row k={`Paid days${sick.cappedDays ? " (limited to 120)" : ""}`} v={String(sick.paidDays)} />
            <Row k="Estimated benefit" v={formatMoney(sick.totalCents)} strong />
          </dl>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">SSS maternity benefit and the employer&apos;s share</h2>
        <p className="text-sm text-muted">100% of the average daily salary credit. A private employer pays the difference between that and the employee&apos;s full daily pay (the salary differential), then claims the SSS part back.</p>
        <Msc value={msc} onChange={setMsc} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Case
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputClass}>
              <option value="LIVE_BIRTH">Live birth: 105 days</option>
              <option value="SOLO_PARENT">Live birth, solo parent: 120 days</option>
              <option value="MISCARRIAGE">Miscarriage or emergency termination: 60 days</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Employee&apos;s daily pay (pesos)<input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="1150.00" className={inputClass} /></label>
        </div>
        {mat && (
          <dl>
            <Row k={`SSS pays (${mat.days} days)`} v={formatMoney(mat.sssCents)} />
            <Row k="Employer salary differential" v={formatMoney(mat.employerDifferentialCents)} />
            <Row k="Employee receives in total" v={formatMoney(mat.sssCents + mat.employerDifferentialCents)} strong />
          </dl>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">GSIS retirement (RA 8291)</h2>
        <p className="text-sm text-muted">For 15 or more years of service. The basic monthly pension is the higher of 37.5% of RAMC or 2.5% of RAMC for each year, but not more than 90% of the average monthly compensation. RAMC is ₱700 plus the average monthly compensation.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Average monthly compensation (pesos)<input inputMode="decimal" value={amc} onChange={(e) => setAmc(e.target.value)} placeholder="40000.00" className={inputClass} /></label>
          <label className="block text-sm font-medium">Years of service with paid premiums<input inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} placeholder="25" className={inputClass} /></label>
        </div>
        {gsis && !gsis.eligible && <p className="text-sm text-warning">Fewer than 15 years of service: a different benefit applies. Ask GSIS.</p>}
        {gsis && gsis.eligible && (
          <dl>
            <Row k="RAMC" v={formatMoney(gsis.ramcCents)} />
            <Row k="Basic monthly pension" v={formatMoney(gsis.bmpCents)} strong />
            <Row k="Option 1: 5-year lump sum (60 months), then the pension" v={formatMoney(gsis.option1LumpSumCents)} />
            <Row k="Option 2: cash payment (18 months), pension starts at once" v={formatMoney(gsis.option2CashCents)} />
          </dl>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Terminal leave (Civil Service)</h2>
        <p className="text-sm text-muted">Accumulated vacation and sick leave credits × monthly salary × 0.0481927.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Leave credits (days)<input inputMode="decimal" value={leave} onChange={(e) => setLeave(e.target.value)} placeholder="120" className={inputClass} /></label>
          <label className="block text-sm font-medium">Monthly salary (pesos)<input inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="40000.00" className={inputClass} /></label>
        </div>
        {term !== null && <dl><Row k="Estimated terminal leave benefit" v={formatMoney(term)} strong /></dl>}
      </Card>
    </div>
  );
}
