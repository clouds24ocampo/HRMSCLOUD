"use client";

import { Icon, ICON_INLINE } from "@/components/Icon";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert } from "@/components/Fields";
import { buttonClass, ghostClass, inputClass } from "@/components/ui";
import { CONTRACT_TEMPLATES, interpolateContract, type ContractTemplateKey, type EmployeeContractData } from "@/lib/contract-templates";
import { createContractAction, issueContractAction, restoreContractAction, signContractAction, voidContractAction } from "./actions";
export { PrintButton } from "@/components/PrintButton";

export type EmployeeOption = {
  id: string;
  name: string;
  employeeNo: string;
  position: string;
  department: string;
  address: string;
  salary: string;
  startDate: string;
};

export function GenerateContractForm({
  employees,
  prefilledEmployeeId,
  companyName,
}: {
  employees: EmployeeOption[];
  prefilledEmployeeId?: string;
  companyName: string;
}) {
  const router = useRouter();
  const [selectedEmpId, setSelectedEmpId] = useState(prefilledEmployeeId ?? (employees[0]?.id ?? ""));
  const [templateKey, setTemplateKey] = useState<ContractTemplateKey>("REGULAR");
  const [customBody, setCustomBody] = useState("");
  const [autoIssue, setAutoIssue] = useState(true);

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);

  // Compute live populated preview
  const handlePopulate = () => {
    if (!selectedEmp) return;
    const rawTemplate = CONTRACT_TEMPLATES[templateKey]?.template ?? CONTRACT_TEMPLATES.REGULAR.template;
    const data: EmployeeContractData = {
      name: selectedEmp.name,
      address: selectedEmp.address || "Complete Residential Address on File",
      position: selectedEmp.position || "Staff",
      department: selectedEmp.department || "General Operations",
      salary: selectedEmp.salary || "Competitive compensation",
      startDate: selectedEmp.startDate || "Date of Engagement",
      employeeNo: selectedEmp.employeeNo || "N/A",
      companyName,
    };
    const populated = interpolateContract(rawTemplate, data);
    setCustomBody(populated);
  };

  const f = useKeptForm(async (prev, fd) => {
    const res = await createContractAction(prev, fd);
    if (res?.ok && res.contractId) {
      router.push(`/contracts/${res.contractId}`);
    }
    return res;
  });

  return (
    <form {...f.formProps} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Select Employee
          <select
            name="employeeId"
            required
            value={selectedEmpId}
            onChange={(e) => {
              setSelectedEmpId(e.target.value);
              setCustomBody(""); // reset so user can click preview with new employee
            }}
            className={inputClass}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.position} ({e.department})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Contract Template
          <select
            name="templateKey"
            value={templateKey}
            onChange={(e) => {
              setTemplateKey(e.target.value as ContractTemplateKey);
              setCustomBody("");
            }}
            className={inputClass}
          >
            <option value="REGULAR">Regular Employment Contract</option>
            <option value="PROBATIONARY">Probationary Employment Contract</option>
            <option value="PROJECT_BASED">Project-Based / Fixed-Term Contract</option>
            <option value="CONSULTANT">Independent Contractor / Consultant</option>
          </select>
        </label>
      </div>

      {selectedEmp && (
        <div className="rounded-xl border border-line bg-surface p-3 text-xs space-y-1">
          <p className="font-bold text-ink flex items-center justify-between">
            <span>Imported Employee Details:</span>
            <button
              type="button"
              onClick={handlePopulate}
              className="rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/20 transition"
            >
              <Icon name="refresh" className={ICON_INLINE} /> Import & Populate Template Text
            </button>
          </p>
          <div className="grid grid-cols-2 gap-2 text-muted sm:grid-cols-4">
            <div><span className="font-medium text-ink">Name:</span> {selectedEmp.name}</div>
            <div><span className="font-medium text-ink">Position:</span> {selectedEmp.position}</div>
            <div><span className="font-medium text-ink">Department:</span> {selectedEmp.department}</div>
            <div><span className="font-medium text-ink">Address:</span> {selectedEmp.address || <span className="text-warning italic">None set</span>}</div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium">
            Contract Document Content
          </label>
          <span className="text-xs text-muted">Supports editing and direct copy-paste</span>
        </div>
        <textarea
          name="customBody"
          rows={14}
          value={customBody}
          onChange={(e) => setCustomBody(e.target.value)}
          placeholder="Click 'Import & Populate Template Text' above to generate the contract with the exact employee name, address, and position, or paste your custom contract here..."
          className={`${inputClass} font-mono text-xs leading-relaxed`}
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="autoIssue"
          checked={autoIssue}
          onChange={(e) => setAutoIssue(e.target.checked)}
          className="h-4 w-4 rounded border-line accent-brand"
        />
        <span>Issue immediately to employee (Employee will receive an in-app notice to review and sign)</span>
      </label>

      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={handlePopulate}
          className={ghostClass}
        >
          Regenerate Text
        </button>
        <button disabled={f.pending} className={buttonClass}>
          {f.pending ? "Generating…" : autoIssue ? <>Generate & Issue Contract <Icon name="file" className={ICON_INLINE} /></> : <>Save as Draft <Icon name="save" className={ICON_INLINE} /></>}
        </button>
      </div>
    </form>
  );
}

export function SignContractForm({ contractId, title }: { contractId: string; title: string }) {
  const [agreed, setAgreed] = useState(false);
  const f = useKeptForm(signContractAction.bind(null, contractId));

  return (
    <form {...f.formProps} className="rounded-2xl border-2 border-emerald-500/40 bg-linear-to-r from-emerald-500/5 to-surface p-5 space-y-4">
      <div>
        <h3 className="font-bold text-lg text-ink">Sign Employment Agreement</h3>
        <p className="text-sm text-muted">
          By signing, you confirm that you have read, understood, and agreed to the terms of <span className="font-semibold text-ink">{title}</span>.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          required
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
        />
        <span className="text-ink">
          I confirm that all my personal details (Name, Address, Position) in this agreement are accurate and I affix my electronic signature willingly.
        </span>
      </label>

      <label className="block text-xs font-medium text-muted">
        Signature Note / Acknowledgment (Optional)
        <input
          name="note"
          maxLength={200}
          placeholder="e.g. Received and accepted with thanks."
          className={inputClass}
        />
      </label>

      {f.state?.error && <Alert kind="error">{f.state.error}</Alert>}
      {f.state?.ok && <Alert kind="success">{f.state.ok}</Alert>}

      <button
        disabled={!agreed || f.pending}
        className="w-full sm:w-auto rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
      >
        {f.pending ? "Signing…" : <>Sign Contract Electronically <Icon name="sign" className={ICON_INLINE} /></>}
      </button>
    </form>
  );
}

export function IssueContractButton({ contractId }: { contractId: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleIssue = async () => {
    setPending(true);
    await issueContractAction(contractId);
    setPending(false);
    router.refresh();
  };

  return (
    <button
      onClick={handleIssue}
      disabled={pending}
      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-ink transition hover:bg-brand/90"
    >
      {pending ? "Issuing…" : <>Issue to Employee <Icon name="send" className={ICON_INLINE} /></>}
    </button>
  );
}

export function VoidContractButton({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleVoid = async () => {
    if (!reason.trim()) return;
    setPending(true);
    await voidContractAction(contractId, reason);
    setPending(false);
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
      >
        Cancel Contract <Icon name="ban" className={ICON_INLINE} />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-danger/30 bg-surface p-3 space-y-2 text-xs">
      <p className="font-bold text-danger">Cancel this contract?</p>
      <input
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for cancelling (e.g. Terms revised, duplicate draft)"
        className={inputClass}
      />
      <div className="flex gap-2">
        <button
          onClick={handleVoid}
          disabled={pending || !reason.trim()}
          className="rounded-lg bg-danger px-3 py-1 font-bold text-white disabled:opacity-50"
        >
          {pending ? "Cancelling…" : "Yes, Cancel Contract"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostClass}>
          Cancel
        </button>
      </div>
    </div>
  );
}



export function RestoreContractButton({ contractId }: { contractId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const router = useRouter();
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Make this contract active again? It goes back to the status it had before it was cancelled.")) return;
          setError(undefined);
          start(async () => {
            const r = await restoreContractAction(contractId);
            if (r?.error) setError(r.error);
            else router.refresh();
          });
        }}
        className="rounded-lg border border-success/40 bg-success/5 px-3 py-1.5 text-xs font-semibold text-success transition hover:bg-success/10 disabled:opacity-60"
      >
        {pending ? "Reactivating…" : "Make Active Again ↩"}
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
