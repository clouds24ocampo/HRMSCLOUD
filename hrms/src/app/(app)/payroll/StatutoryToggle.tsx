"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/app/login/actions";
import { setStatutoryDeduction } from "./setup/actions";

const OPTIONS = [
  { value: true, label: "Deduct from pay", hint: "SSS, PhilHealth, Pag-IBIG and withholding tax are taken out of net pay." },
  { value: false, label: "Show only", hint: "They are computed and shown on the payslip, but net pay is not reduced." },
] as const;

// Both choices are always visible, with the current one marked, instead of an on/off switch that hides what "off" means.
export function StatutoryToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>();
  return (
    <div>
      <div role="radiogroup" aria-label="Government contributions and withholding tax" className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const selected = on === o.value;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending || selected}
              onClick={() => start(async () => setState(await setStatutoryDeduction(o.value)))}
              className={`rounded-xl border p-3 text-left transition disabled:cursor-default ${selected ? "border-brand bg-brand/10 ring-2 ring-brand/30" : "border-line hover:bg-bg disabled:opacity-60"}`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden>{selected ? "◉" : "○"}</span>{o.label}{selected && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-ink">Selected</span>}</span>
              <span className="mt-1 block text-xs text-muted">{o.hint}</span>
            </button>
          );
        })}
      </div>
      {state?.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
    </div>
  );
}
