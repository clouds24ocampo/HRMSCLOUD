"use client";

import { useState, useTransition } from "react";
import { useKeptForm } from "@/components/useKeptForm";
import { Alert, Field, SubmitButton } from "@/components/Fields";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/app/login/actions";
import { addApplicant, addApplicantNote, addJob, hireApplicant, moveApplicant, setInterview, setJobStatus } from "./actions";

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
        Description (optional)
        <textarea name="description" rows={3} className={inputClass} />
      </label>
      <Msg s={f.state} />
      <SubmitButton pending={f.pending}>Open the job</SubmitButton>
    </form>
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

const MOVES = [
  ["SCREENING", "Screening"],
  ["INTERVIEW", "Interview"],
  ["OFFER", "Offer"],
] as const;

type Applicant = {
  id: string; name: string; email: string | null; phone: string | null; source: string | null; stage: string; interviewAt: string | null;
  notes: { id: string; text: string; at: string }[];
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
  const hire = useKeptForm(hireApplicant.bind(null, a.id));
  const [login, setLogin] = useState(false);
  const move = (stage: (typeof MOVES)[number][0] | "REJECTED" | "APPLIED") => start(async () => setMsg(await moveApplicant(a.id, stage)));
  const closed = a.stage === "HIRED" || a.stage === "REJECTED";

  return (
    <li className="rounded-xl border border-line p-4">
      <p className="font-medium">{a.name}</p>
      <p className="text-sm text-muted">{[a.email, a.phone, a.source && `via ${a.source}`].filter(Boolean).join(" · ") || "No contact details"}</p>
      {a.interviewAt && <p className="mt-1 text-sm">Interview: <span className="font-medium">{a.interviewAt}</span></p>}

      {a.stage !== "HIRED" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.stage === "REJECTED" ? (
            <button disabled={pending} onClick={() => move("APPLIED")} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95">Reopen</button>
          ) : (
            <>
              {MOVES.filter(([s]) => s !== a.stage).map(([s, l]) => (
                <button key={s} disabled={pending} onClick={() => move(s)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-bg active:scale-95 disabled:opacity-60">Move to {l}</button>
              ))}
              <button disabled={pending} onClick={() => move("REJECTED")} className="rounded-lg border border-danger px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10 active:scale-95 disabled:opacity-60">Reject</button>
            </>
          )}
        </div>
      )}
      {msg?.error && <div className="mt-2"><Alert kind="error">{msg.error}</Alert></div>}

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
