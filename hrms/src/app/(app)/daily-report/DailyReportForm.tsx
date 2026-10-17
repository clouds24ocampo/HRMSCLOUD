"use client";

import { useKeptForm } from "@/components/useKeptForm";
import { Alert, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import { saveDailyReport } from "./actions";

// Sent reports are final. The form starts empty each time; sending again adds a newer report for today.
export function DailyReportForm({ again }: { again: boolean }) {
  const f = useKeptForm(saveDailyReport);
  return (
    <form {...f.formProps} className="space-y-3">
      <label className="block text-sm font-medium">
        What I worked on today
        <textarea name="accomplishments" rows={5} required minLength={5} maxLength={4000} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Problems or blockers (optional)
        <textarea name="issues" rows={2} maxLength={2000} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Plan for the next working day (optional)
        <textarea name="plans" rows={2} maxLength={2000} className={inputClass} />
      </label>
      <p className="text-xs text-muted">Once sent, a report cannot be edited.{again ? " Sending a new one makes it today's report; the earlier one stays on record." : ""}</p>
      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
      <SubmitButton pending={f.pending}>{again ? "Send a new report for today" : "Send today's report"}</SubmitButton>
    </form>
  );
}
