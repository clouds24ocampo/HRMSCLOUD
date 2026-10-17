"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/app/login/actions";
import { setStatutoryDeduction } from "./setup/actions";

export function StatutoryToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={() => start(async () => setState(await setStatutoryDeduction(!on)))}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${on ? "bg-brand" : "bg-line"}`}
      >
        <span className="sr-only">Deduct government contributions and tax from pay</span>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <span className="text-sm font-medium">{on ? "Deducted from pay" : "Shown only, not deducted"}</span>
      {state?.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
    </div>
  );
}
