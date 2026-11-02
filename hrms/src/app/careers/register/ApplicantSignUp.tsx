"use client";

import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { registerApplicant } from "./actions";

export function ApplicantSignUp({ jobs, jobId }: { jobs: { id: string; title: string }[]; jobId?: string }) {
  const f = useKeptForm(registerApplicant);
  return (
    <form {...f.formProps} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium">Positions you are applying for <span className="font-normal text-muted">(choose one or more, or pick later)</span></legend>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {jobs.map((j) => (
            <label key={j.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-line/40">
              <input type="checkbox" name="jobId" value={j.id} defaultChecked={j.id === jobId} className="h-4 w-4 accent-[var(--brand)]" /> {j.title}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Full name" id="name" autoComplete="name" required />
      <Field label="Email" id="email" type="email" autoComplete="email" required />
      <Field label="Mobile number" id="phone" type="tel" autoComplete="tel" />
      <Field label="Password" id="password" type="password" autoComplete="new-password" minLength={10} required />
      <Field label="Confirm password" id="confirm" type="password" autoComplete="new-password" minLength={10} required />
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      <SubmitButton pending={f.pending}>Create account</SubmitButton>
    </form>
  );
}
