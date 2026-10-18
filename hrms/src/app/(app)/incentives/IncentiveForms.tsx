"use client";

import { useState } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert } from "@/components/Fields";
import { buttonClass, ghostClass, inputClass } from "@/components/ui";
import { acceptIncentiveAction, awardIncentiveAction, declineIncentiveAction } from "./actions";

export function AwardIncentiveForm({
  employees,
  prefilledEmployeeId,
  projectId,
  cardId,
  onSuccess,
}: {
  employees: { id: string; name: string }[];
  prefilledEmployeeId?: string;
  projectId?: string;
  cardId?: string;
  onSuccess?: () => void;
}) {
  const f = useKeptForm(async (prev, fd) => {
    const res = await awardIncentiveAction(prev, fd);
    if (res?.ok && onSuccess) onSuccess();
    return res;
  });

  return (
    <form {...f.formProps} className="space-y-4">
      <label className="block text-sm font-medium">
        Recipient Employee
        <select
          name="employeeId"
          required
          defaultValue={prefilledEmployeeId ?? ""}
          className={inputClass}
        >
          <option value="" disabled>Choose an employee…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Incentive Title
        <input
          name="title"
          required
          maxLength={120}
          placeholder="e.g. Q4 Target Milestone Bonus, Perfect Attendance Award"
          className={inputClass}
        />
      </label>

      <label className="block text-sm font-medium">
        Amount (PHP)
        <div className="relative mt-1">
          <span className="absolute left-3 top-2 text-muted">₱</span>
          <input
            type="number"
            step="0.01"
            min="1"
            name="amount"
            required
            placeholder="5,000.00"
            className={`${inputClass} mt-0 pl-8`}
          />
        </div>
      </label>

      <label className="block text-sm font-medium">
        Citation / Reason
        <textarea
          name="reason"
          required
          rows={3}
          maxLength={2000}
          placeholder="Describe why this incentive is being awarded (project milestones delivered, outstanding attendance, etc.)"
          className={inputClass}
        />
      </label>

      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {cardId && <input type="hidden" name="cardId" value={cardId} />}

      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}

      <div className="flex justify-end gap-2 pt-2">
        <button disabled={f.pending} className={buttonClass}>
          {f.pending ? "Awarding…" : "Award Incentive 🎁"}
        </button>
      </div>
    </form>
  );
}

export function AcceptIncentiveForm({ incentiveId, title, amount }: { incentiveId: string; title: string; amount: string }) {
  const [open, setOpen] = useState(false);
  const f = useKeptForm(acceptIncentiveAction.bind(null, incentiveId));

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-success/90 active:scale-95"
        >
          <span>✓</span> Accept Incentive ({amount})
        </button>
      ) : (
        <form {...f.formProps} className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-3">
          <p className="text-sm font-medium text-ink">
            Confirm acceptance of <span className="font-bold text-success">{title} ({amount})</span>
          </p>
          <label className="block text-xs font-medium text-muted">
            Acknowledgment Note (Optional)
            <input
              name="employeeNote"
              maxLength={200}
              placeholder="e.g. Thank you management! Received with appreciation."
              className={inputClass}
            />
          </label>
          {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
          {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}
          <div className="flex items-center gap-2">
            <button disabled={f.pending} className="rounded-lg bg-success px-4 py-2 text-sm font-bold text-white transition hover:bg-success/90">
              {f.pending ? "Confirming…" : "Confirm & Accept ✓"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={ghostClass}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function DeclineIncentiveForm({ incentiveId }: { incentiveId: string }) {
  const [open, setOpen] = useState(false);
  const f = useKeptForm(declineIncentiveAction.bind(null, incentiveId));

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-muted hover:text-danger hover:underline"
        >
          Decline
        </button>
      ) : (
        <form {...f.formProps} className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <label className="block text-xs font-medium text-muted">
            Reason for declining (optional)
            <input name="reason" maxLength={200} placeholder="Reason..." className={inputClass} />
          </label>
          {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
          <div className="flex items-center gap-2">
            <button disabled={f.pending} className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20">
              {f.pending ? "Declining…" : "Confirm Decline"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
