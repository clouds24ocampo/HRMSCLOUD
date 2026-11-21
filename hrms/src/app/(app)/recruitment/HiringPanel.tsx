"use client";

import { useState, useTransition } from "react";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { HiringJourney } from "@/components/HiringJourney";
import { Badge, inputClass } from "@/components/ui";
import { useKeptForm } from "@/components/useKeptForm";
import { CONTRACT_TEMPLATES } from "@/lib/contract-templates";
import { ENGAGEMENT_LABEL, TEMPLATES_FOR, type Engagement, type Step, type StepKey } from "@/lib/hiring-pipeline";
import type { FormState } from "@/app/login/actions";
import { cancelContract, createApplicantAccount, issueContract } from "./actions";

export type HiringInfo = {
  steps: Step[]; current: StepKey; ready: boolean; missing: string[]; hasAccount: boolean;
  contract: null | { id: string; status: "ISSUED" | "SIGNED"; engagement: Engagement | null; title: string; issuedAt: string | null; signedAt: string | null; signedName: string | null; startDate: string | null };
};

const Msg = ({ s }: { s?: FormState }) => (
  <>
    {s?.error && <Alert kind="error">{s.error}</Alert>}
    {s?.ok && <Alert kind="success">{s.ok}</Alert>}
  </>
);
const small = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60";

// HR's view of the whole road for one applicant: where they are, what is missing, the account, and the contract.
export function HiringPanel({ applicantId, hasEmail, stage, hiring, today }: { applicantId: string; hasEmail: boolean; stage: string; hiring: HiringInfo; today: string }) {
  const [pending, start] = useTransition();
  const [acct, setAcct] = useState<(FormState & { email?: string; password?: string }) | undefined>();
  const [engagement, setEngagement] = useState<Engagement>("EMPLOYEE");
  const issue = useKeptForm(issueContract.bind(null, applicantId));
  const cancel = useKeptForm(cancelContract.bind(null, hiring.contract?.id ?? ""));
  const c = hiring.contract;
  const contractOpen = stage === "REQUIREMENTS" || stage === "OFFER";

  return (
    <details className="mt-3" open={contractOpen}>
      <summary className="cursor-pointer text-sm font-semibold text-brand">
        Hiring steps: {hiring.ready ? "ready to hire" : hiring.missing.length === 1 ? `1 step left (${hiring.missing[0]})` : `${hiring.missing.length} steps left`}
      </summary>
      <div className="mt-3 space-y-4">
        <HiringJourney steps={hiring.steps} current={hiring.current} compact />

        {/* Stays on screen after the account is made: the page refreshes and the account now exists, but HR still has to read the password. */}
        {(!hiring.hasAccount || acct?.password) && (
          <div className="rounded-xl border border-line bg-bg p-3">
            <p className="text-sm font-semibold">Applicant account</p>
            {!hiring.hasAccount && (
              <>
                <p className="text-xs text-muted">This applicant was added by HR and cannot sign in yet. Create their account so they can take the exams, upload their documents, attend orientation and sign the contract.</p>
                {!hasEmail && <p className="mt-1 text-xs text-warning">Add their email address first. It is their sign-in.</p>}
                <button type="button" disabled={pending || !hasEmail} onClick={() => start(async () => setAcct(await createApplicantAccount(applicantId)))} className={`${small} mt-2`}>
                  {pending ? "Creating…" : "Create applicant account"}
                </button>
              </>
            )}
            {acct?.error && <div className="mt-2"><Alert kind="error">{acct.error}</Alert></div>}
            {acct?.ok && acct.password && (
              <div className="mt-2 space-y-1 rounded-lg border border-success/40 bg-success/5 p-3 text-sm" role="status">
                <p className="font-semibold">{acct.ok}</p>
                <p>Sign in at <span className="font-mono">/careers/login</span></p>
                <p>Email: <span className="font-mono font-semibold">{acct.email}</span></p>
                <p>Temporary password: <span className="font-mono font-semibold select-all">{acct.password}</span></p>
                <p className="text-xs text-muted">Shown only now. Write it down or send it to them in person. If lost, delete and add the applicant again.</p>
              </div>
            )}
          </div>
        )}

        {hiring.hasAccount && (
          <div className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Contract</p>
              {c ? <Badge tone={c.status === "SIGNED" ? "success" : "warning"}>{c.status === "SIGNED" ? "Signed" : "Waiting for the applicant"}</Badge> : <Badge>Not sent</Badge>}
            </div>
            {!contractOpen && !c && <p className="mt-1 text-xs text-muted">Contracts open after the interview, when the applicant is moved to Requirements.</p>}

            {contractOpen && !c && (
              <form {...issue.formProps} className="mt-2 space-y-3">
                <p className="text-xs text-muted">The contract decides what the person becomes when you hire them: an employee or a subcontractor. They read and sign it in their portal.</p>
                <fieldset>
                  <legend className="text-sm font-medium">Hire as</legend>
                  <div className="mt-1 flex gap-2">
                    {(["EMPLOYEE", "SUBCONTRACTOR"] as const).map((e) => (
                      <label key={e} className="cursor-pointer">
                        <input type="radio" name="engagement" value={e} checked={engagement === e} onChange={() => setEngagement(e)} className="peer sr-only" />
                        <span className="inline-block rounded-lg border border-line px-4 py-2 text-sm font-semibold peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand peer-focus-visible:outline-2">{ENGAGEMENT_LABEL[e]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Contract type
                    <select key={engagement} name="templateKey" defaultValue={TEMPLATES_FOR[engagement][0]} className={inputClass}>
                      {TEMPLATES_FOR[engagement].map((k) => <option key={k} value={k}>{CONTRACT_TEMPLATES[k].name}</option>)}
                    </select>
                  </label>
                  <Field label="Start date" id="startDate" type="date" required defaultValue={today} />
                  <Field label="Pay (shown in the contract)" id="pay" placeholder="PHP 25,000 per month" maxLength={120} />
                  <Field label="Applicant's address (optional)" id="address" maxLength={200} />
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-muted">Write the contract text yourself (optional)</summary>
                  <textarea name="customBody" rows={8} maxLength={20000} placeholder="Leave empty to use the standard text for the contract type." className={`${inputClass} mt-2`} />
                </details>
                <Msg s={issue.state} />
                <SubmitButton pending={issue.pending}>Send the contract to the applicant</SubmitButton>
              </form>
            )}

            {c && (
              <div className="mt-2 space-y-2 text-sm">
                <p><span className="font-medium">{c.title}</span></p>
                <p className="text-muted">
                  {c.engagement ? `Hire as ${ENGAGEMENT_LABEL[c.engagement].toLowerCase()}` : "Hire as employee"}{c.startDate ? ` · starts ${c.startDate}` : ""} · sent {c.issuedAt}
                  {c.status === "SIGNED" && <> · signed {c.signedAt} by {c.signedName}</>}
                </p>
                {c.status === "ISSUED" && <p className="text-xs text-muted">The applicant sees it in their portal under Step 5. You will be notified when they sign.</p>}
                <form {...cancel.formProps} className="flex flex-wrap items-end gap-2">
                  <label className="block min-w-0 flex-1 basis-48 text-xs font-medium">
                    Cancel this contract (to correct it and send a new one)
                    <input name="reason" required minLength={3} maxLength={300} placeholder="Why?" className={inputClass} />
                  </label>
                  <button disabled={cancel.pending} className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 active:scale-95 disabled:opacity-60">Cancel contract</button>
                </form>
                <Msg s={cancel.state} />
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
