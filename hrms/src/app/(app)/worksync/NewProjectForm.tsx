"use client";

import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert } from "@/components/Fields";
import { buttonClass, ghostClass, inputClass } from "@/components/ui";
import { WS_THEMES, themeGradient } from "@/lib/worksync";
import { createProject } from "./actions";

// "New project" opens a small form. The lists are created from the chosen kind (programming or network) and can be used right away.
export function NewProjectForm() {
  const [open, setOpen] = useState(false);
  const f = useKeptForm(createProject);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={buttonClass}>New project</button>;
  return (
    <form {...f.formProps} className="w-full max-w-md space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-md">
      <label className="block text-sm font-medium">Project name<input name="name" required maxLength={120} placeholder="e.g. Customer portal v2, Branch fibre rollout" className={inputClass} /></label>
      <label className="block text-sm font-medium">Kind
        <select name="kind" defaultValue="PROGRAMMING" className={inputClass}>
          <option value="PROGRAMMING">Software (backlog, development, review, QA, released)</option>
          <option value="NETWORK">Network (planned, survey, installation, testing, handed over)</option>
          <option value="OTHER">Other (to do, in progress, blocked, done)</option>
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Board color</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.keys(WS_THEMES).map((k, i) => (
            <label key={k} title={k} className="cursor-pointer">
              <input type="radio" name="color" value={k} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block h-7 w-11 rounded-lg ring-offset-2 peer-checked:ring-2 peer-checked:ring-brand peer-focus-visible:ring-2" style={{ backgroundImage: themeGradient(k) }} />
              <span className="sr-only">{k}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">Target date (optional)<input type="date" name="dueDate" className={inputClass} /></label>
      <label className="block text-sm font-medium">What is it about? (optional)<textarea name="description" rows={2} maxLength={2000} className={inputClass} /></label>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      <div className="flex gap-2">
        <button disabled={f.pending} className={buttonClass}>{f.pending ? "Creating…" : "Create project"}</button>
        <button type="button" onClick={() => setOpen(false)} className={ghostClass}>Cancel</button>
      </div>
    </form>
  );
}
