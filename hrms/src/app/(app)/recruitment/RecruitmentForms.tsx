"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { addStarterPositions } from "./exam-actions";
import { addApplicant, addApplicantNote, addJob, deleteApplication, deleteApplicantPerson, setOrientation, hireApplicant, moveApplicant, setInterview, setJobStatus } from "./actions";

type Opt = { id: string; label: string };
const Msg = ({ s }: { s: FormState }) => (
  <>
    {s?.error && <Alert kind="error">{s.error}</Alert>}
    {s?.ok && <Alert kind="success">{s.ok}</Alert>}
  </>
);

export function AddJobForm({ departments, positions }: { departments: Opt[]; positions: Opt[] }) {
  const f = useKeptForm(addJob);
  return (
    <form {...f.formProps} className="space-y-3">
      <Field label="Job title" id="title" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Department
          <select name="departmentId" defaultValue="" className={inputClass}>
            <option value="">Not set</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Position
          <select name="positionId" defaultValue="" className={inputClass}>
            <option value="">Not set</option>
            {positions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
      </div>
      <Field label="Openings" id="openings" type="number" min={1} defaultValue={1} required />
      <label className="block text-sm font-medium">
        About the role (optional)
        <textarea name="description" rows={2} placeholder="One or two sentences about the job" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        What the person will do (optional, one per line)
        <textarea name="duties" rows={4} placeholder={"Answer customer calls\nPrepare daily reports"} className={inputClass} />
      </label>
      <p className="text-xs text-muted">Write in English. Applicants who choose Tagalog get an automatic translation.</p>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Open the job</SubmitButton>
    </form>
  );
}

// Adds the standard positions (software engineers, safety, office, field crews…). Titles that exist are skipped.
export function StarterPositionsButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>();
  return (
    <div className="space-y-2">
      <button disabled={pending} onClick={() => start(async () => setMsg(await addStarterPositions()))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">Add the starter positions</button>
      <Msg s={msg} />
    </div>
  );
}

export function JobStatusButton({ id, open }: { id: string; open: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => setJobStatus(id, open ? "CLOSED" : "OPEN"))} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">
      {open ? "Close this job" : "Reopen this job"}
    </button>
  );
}

export function AddApplicantForm({ jobId }: { jobId: string }) {
  const f = useKeptForm(addApplicant.bind(null, jobId));
  return (
    <form {...f.formProps} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" id="name" required />
        <Field label="Email" id="email" type="email" />
        <Field label="Phone" id="phone" type="tel" />
        <Field label="Where they came from" id="source" placeholder="Referral, job site…" />
      </div>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Add applicant</SubmitButton>
    </form>
  );
}

// The path an applicant walks. Hired is only reached through the Hire form.
const PATH = [
  ["APPLIED", "Applied"],
  ["SCREENING", "Screening"],
  ["INTERVIEW", "Interview"],
  ["REQUIREMENTS", "Requirements"],
  ["OFFER", "Offer"],
] as const;

type Applicant = {
  id: string; name: string; email: string | null; phone: string | null; source: string | null; stage: string; interviewAt: string | null;
  notes: { id: string; text: string; at: string }[];
  // Present when the person applied through the careers page.
  portal?: { applicantNo: string; hasResume: boolean; hasId: boolean; exams: { title: string; kind: string; status: string; passed: boolean | null; traits: string; attemptId: string | null }[]; orientation?: { at: string | null; input: string; signed: number; total: number }; requirements?: { done: number; total: number; items: { title: string; required: boolean; docId: string | null; auto: boolean }[] } };
};

export function ApplicantCard(p: {
  a: Applicant; today: string; defaultDepartment: string; defaultPosition: string;
  departments: Opt[]; positions: Opt[]; managers: Opt[]; shifts: Opt[];
}) {
  const { a } = p;
  const [msg, setMsg] = useState<FormState>();
  const [pending, start] = useTransition();
  const note = useKeptForm(addApplicantNote.bind(null, a.id));
  const interview = useKeptForm(setInterview.bind(null, a.id));
  const orientation = useKeptForm(setOrientation.bind(null, a.id));
  const hire = useKeptForm(hireApplicant.bind(null, a.id));
  const [login, setLogin] = useState(false);
  const move = (stage: (typeof PATH)[number][0] | "REJECTED") => start(async () => setMsg(await moveApplicant(a.id, stage)));
  const closed = a.stage === "HIRED" || a.stage === "REJECTED";
  const at = PATH.findIndex(([s]) => s === a.stage);
  const prev = at > 0 ? PATH[at - 1] : null;
  const next = at >= 0 && at < PATH.length - 1 ? PATH[at + 1] : null;

  return (
    <li className="rounded-xl border border-line p-4">
      <p className="font-medium"><Link href={`/recruitment/applicants/${a.id}`} className="hover:text-brand hover:underline" title="Open the full profile">{a.name}</Link></p>
      {at >= 0 && (
        <ol aria-label="Stage" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
          {PATH.map(([s, l], i) => (
            <li key={s} className={`flex items-center gap-1 ${i === at ? "font-bold text-brand" : i < at ? "text-ink" : ""}`}>{i > 0 && <span aria-hidden>›</span>}{l}</li>
          ))}
        </ol>
      )}
      <p className="text-sm text-muted">{[a.email, a.phone, a.source && `via ${a.source}`].filter(Boolean).join(" · ") || "No contact details"}</p>
      {a.portal && (
        <div className="mt-2 space-y-1 rounded-lg bg-bg p-3 text-sm">
          <p>Applicant no. <span className="font-mono font-semibold">{a.portal.applicantNo}</span></p>
          <p className="flex flex-wrap gap-x-4">
            {a.portal.hasResume ? <a href={`/recruitment/applicant/${a.id}/resume`} target="_blank" className="font-semibold text-brand hover:underline">Open resume</a> : <span className="text-muted">No resume yet</span>}
            {a.portal.hasId ? <a href={`/recruitment/applicant/${a.id}/id`} target="_blank" className="font-semibold text-brand hover:underline">Open valid ID</a> : <span className="text-muted">No valid ID yet</span>}
          </p>
          {a.portal.exams.map((e) => (
            <p key={e.title}>
              <span className="font-medium">{e.title}:</span> {e.status}
              {e.passed !== null && <span className={e.passed ? " font-semibold text-success" : " font-semibold text-danger"}>{e.passed ? " · Passed" : " · Below passing"}</span>}
              {e.traits && <span className="block text-xs text-muted">{e.traits}</span>}
              {e.attemptId && <Link href={`/recruitment/results/${e.attemptId}`} className="block text-xs font-semibold text-brand hover:underline">Review every answer →</Link>}
            </p>
          ))}
          {a.portal.requirements && (
            <details className="pt-1">
              <summary className="cursor-pointer font-semibold text-brand">201 file: {a.portal.requirements.done} of {a.portal.requirements.total} required in</summary>
              <ul className="mt-2 space-y-1">
                {a.portal.requirements.items.map((i) => (
                  <li key={i.title} className="flex flex-wrap items-center justify-between gap-2">
                    <span className={i.docId || i.auto ? "" : i.required ? "text-warning" : "text-muted"}>{i.title}{!i.required && <span className="text-xs text-muted"> (if it applies)</span>}</span>
                    {i.docId ? <a href={`/recruitment/applicant/${a.id}/doc/${i.docId}`} target="_blank" className="font-semibold text-brand hover:underline">Open</a> : i.auto ? <a href={`/recruitment/applicant/${a.id}/resume`} target="_blank" className="font-semibold text-brand hover:underline">Open resume</a> : <span className="text-xs text-muted">{i.required ? "Missing" : "–"}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {a.interviewAt && <p className="mt-1 text-sm">Interview: <span className="font-medium">{a.interviewAt}</span></p>}

      {a.stage !== "HIRED" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.stage === "REJECTED" ? (
            <button disabled={pending} onClick={() => move("APPLIED")} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95">Reopen</button>
          ) : (
            <>
              {prev && <button disabled={pending} onClick={() => move(prev[0])} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">← Back to {prev[1]}</button>}
              {next && <button disabled={pending} onClick={() => { if (confirm(`Move ${a.name} to ${next[1]}?`)) move(next[0]); }} className="rounded-lg border border-brand bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand/20 active:scale-95 disabled:opacity-60">Move to {next[1]} →</button>}
              <button disabled={pending} onClick={() => { if (confirm(`Reject ${a.name}?`)) move("REJECTED"); }} className="rounded-lg border border-danger px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10 active:scale-95 disabled:opacity-60">Reject</button>
            </>
          )}
        </div>
      )}
      {msg?.error && <div className="mt-2"><Alert kind="error">{msg.error}</Alert></div>}
      {a.stage !== "HIRED" && (
        <button
          disabled={pending}
          onClick={() => { if (confirm(`Remove ${a.name} from this position? Their exam results for it are deleted.`)) start(async () => setMsg(await deleteApplication(a.id))); }}
          className="mt-2 text-xs font-medium text-danger hover:underline disabled:opacity-60"
        >
          Remove from this position
        </button>
      )}

      {a.portal && ["REQUIREMENTS", "OFFER"].includes(a.stage) && a.portal.orientation && (
        <details className="mt-3" open={!!a.portal.orientation.at}>
          <summary className="cursor-pointer text-sm font-semibold text-brand">
            Orientation day{a.portal.orientation.at ? `: ${a.portal.orientation.at} · ${a.portal.orientation.signed} of ${a.portal.orientation.total} policies signed` : ""}
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted">On this day the applicant reads and signs the company policies and the privacy policy. They are hired after that. Clear the date to cancel.</p>
            <form {...orientation.formProps} className="flex flex-wrap items-end gap-2">
              <label className="block min-w-0 flex-1 basis-48 text-sm font-medium">
                Date and time
                <input type="datetime-local" name="orientationAt" defaultValue={a.portal.orientation.input} className={inputClass} />
              </label>
              <button disabled={orientation.pending} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold transition hover:bg-bg active:scale-95">Save</button>
            </form>
            <Msg s={orientation.state} />
          </div>
        </details>
      )}

      {!closed && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand">Interview and notes</summary>
          <div className="mt-3 space-y-3">
            <form {...interview.formProps} className="flex flex-wrap items-end gap-2">
              <label className="block min-w-0 flex-1 basis-48 text-sm font-medium">
                Interview date and time
                <input type="datetime-local" name="interviewAt" required className={inputClass} />
              </label>
              <button disabled={interview.pending} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold transition hover:bg-bg active:scale-95">Set interview</button>
            </form>
            <Msg s={interview.state} />
            <form {...note.formProps} className="flex flex-wrap items-end gap-2">
              <label className="block min-w-0 flex-1 basis-48 text-sm font-medium">
                Add a note
                <input name="text" required maxLength={1000} className={inputClass} />
              </label>
              <button disabled={note.pending} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold transition hover:bg-bg active:scale-95">Save note</button>
            </form>
            <Msg s={note.state} />
          </div>
        </details>
      )}

      {a.stage === "OFFER" && (
        <details className="mt-3" open>
          <summary className="cursor-pointer text-sm font-semibold text-success">Hire {a.name.split(" ")[0]}</summary>
          <form {...hire.formProps} className="mt-3 space-y-3 rounded-xl border border-line bg-bg p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Hire date" id="hireDate" type="date" required defaultValue={p.today} />
              <label className="block text-sm font-medium">
                Department
                <select name="departmentId" defaultValue={p.defaultDepartment} className={inputClass}>
                  <option value="">Not set</option>
                  {p.departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Position
                <select name="positionId" defaultValue={p.defaultPosition} className={inputClass}>
                  <option value="">Not set</option>
                  {p.positions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Immediate supervisor
                <select name="managerId" defaultValue="" className={inputClass}>
                  <option value="">No supervisor</option>
                  {p.managers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Regular shift
                <select name="shiftId" defaultValue="" className={inputClass}>
                  <option value="">Set later</option>
                  {p.shifts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </label>
              <fieldset>
                <legend className="text-sm font-medium">Works on</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["1", "2", "3", "4", "5", "6", "0"] as const).map((v, i) => (
                    <label key={v} className="cursor-pointer">
                      <input type="checkbox" name="days" value={v} defaultChecked={i < 5} className="peer sr-only" />
                      <span className="inline-block rounded-lg border border-line px-2 py-1 text-xs font-medium peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="createLogin" checked={login} onChange={(e) => setLogin(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" /> Also create a sign-in (needs the applicant&apos;s email)
            </label>
            {login && <Field label="Temporary password" id="password" type="password" autoComplete="new-password" minLength={10} />}
            <Msg s={hire.state} />
            <SubmitButton pending={hire.pending}>Hire and create the employee</SubmitButton>
          </form>
        </details>
      )}

      {a.notes.length > 0 && (
        <ul className="mt-3 space-y-1 border-l border-line pl-3 text-sm text-muted">
          {a.notes.map((n) => <li key={n.id}>{n.text} <span className="text-xs">· {n.at}</span></li>)}
        </ul>
      )}
    </li>
  );
}

// Whole-person delete, used on the All applicants list.
export function DeleteApplicantButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        disabled={pending}
        onClick={() => { if (confirm(`Delete ${name} completely? Their applications, exam results, uploaded files and applicant account are removed. This cannot be undone.`)) start(async () => setMsg(await deleteApplicantPerson(id))); }}
        className="rounded-lg border border-danger px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10 active:scale-95 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete applicant"}
      </button>
      {msg?.error && <span className="max-w-60 text-right text-xs text-danger">{msg.error}</span>}
    </span>
  );
}
