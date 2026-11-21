"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/Fields";
import { Meter } from "@/components/Charts";
import { Badge, Card, buttonClass, inputClass } from "@/components/ui";
import { PDS_SECTIONS, type Field, type RowsSection } from "@/lib/pds-config";
import { cond, fieldRequired, isFilled, pdsCompletion, type FieldsData, type PdsData, type Row, type RowsData } from "@/lib/pds";
import { savePds, type PdsResult } from "../actions";

const blankRow = (s: RowsSection): Row => Object.fromEntries(s.columns.map((c) => [c.key, ""]));
const SPAN = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-2 lg:col-span-3" } as const;

// The whole Personal Data Sheet as one form, drawn from the question list (pds-config.ts). Progress is counted live; the person can
// save and come back, and submit when every required answer is in. Required answers that are still empty turn red after a Submit try.
export function PdsForm({ initial, submittedBefore }: { initial: PdsData; submittedBefore: boolean }) {
  const [data, setData] = useState<PdsData>(() => {
    const d: PdsData = JSON.parse(JSON.stringify(initial));
    for (const s of PDS_SECTIONS) if (s.kind === "rows") { const r = d[s.key] as RowsData; while (r.rows.length < s.min) r.rows.push(blankRow(s)); }
    return d;
  });
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState<PdsResult>();
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [submitted, setSubmitted] = useState(submittedBefore);
  const top = useRef<HTMLDivElement>(null);
  const c = useMemo(() => pdsCompletion(data), [data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = (fn: (d: PdsData) => void) => { setData((p) => { const n: PdsData = JSON.parse(JSON.stringify(p)); fn(n); return n; }); setDirty(true); };
  const setField = (sk: string, fk: string, v: string) => edit((d) => { (d[sk] as FieldsData)[fk] = v; });
  const setCell = (sk: string, i: number, ck: string, v: string) => edit((d) => { (d[sk] as RowsData).rows[i][ck] = v; });
  const send = (submit: boolean) => {
    setAttempted(true);
    start(async () => {
      const r = await savePds(data, submit);
      setResult(r);
      if (!r.error) { setDirty(false); setSubmitted(!!r.submitted); }
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const input = (f: Field, value: string, name: string, onChange: (v: string) => void, values: Record<string, string>) => {
    const bad = attempted && fieldRequired(f, values) && !isFilled(f, value);
    const cls = `${inputClass} ${bad ? "!border-danger" : ""}`;
    if (f.type === "check") {
      return (
        <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${bad ? "border-danger bg-danger/5" : "border-line"}`}>
          <input type="checkbox" name={name} checked={value === "Yes"} onChange={(e) => onChange(e.target.checked ? "Yes" : "")} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
          <span>{f.label}{fieldRequired(f, values) && <span className="text-danger"> *</span>}</span>
        </label>
      );
    }
    const label = (
      <>
        {f.label}{fieldRequired(f, values) && <span className="text-danger"> *</span>}
        {f.hint && <span className="ml-1 text-xs font-normal text-muted">({f.hint})</span>}
      </>
    );
    return (
      <label className="block text-sm font-medium">
        {label}
        {f.type === "select" ? (
          <select name={name} value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
            <option value="">Choose…</option>
            {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.type === "textarea" ? (
          <textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={f.max} className={cls} />
        ) : (
          <input
            name={name} value={value} onChange={(e) => onChange(e.target.value)} maxLength={f.max} placeholder={f.placeholder} className={cls}
            type={f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.type === "url" ? "url" : "text"}
            inputMode={f.type === "number" ? "numeric" : f.type === "tel" ? "tel" : undefined} autoComplete="off"
          />
        )}
      </label>
    );
  };

  return (
    <div className="space-y-5">
      <div ref={top} className="sticky top-0 z-20 -mx-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Personal Data Sheet <span className="font-normal text-muted">· {c.done} of {c.total} required answers</span></p>
          <div className="flex items-center gap-2">{submitted ? <Badge tone="success">Submitted</Badge> : <Badge tone={c.pct >= 100 ? "success" : "warning"}>{c.pct >= 100 ? "Ready to submit" : "Not submitted"}</Badge>}<span className="text-lg font-bold">{c.pct}%</span></div>
        </div>
        <div className="mt-2"><Meter value={c.pct} tone={c.pct >= 100 ? "success" : c.pct >= 50 ? "warning" : "danger"} /></div>
      </div>

      {result?.ok && <Alert kind="success">{result.ok}</Alert>}
      {result?.error && (
        <div className="space-y-2">
          <Alert kind="error">{result.error}</Alert>
          {!!result.problems?.length && <ul className="list-disc space-y-0.5 pl-6 text-sm text-danger">{result.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          {!!result.missing?.length && (
            <details className="rounded-lg border border-line p-3 text-sm" open>
              <summary className="cursor-pointer font-semibold">Still needed ({result.missing.length})</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">{result.missing.map((m) => <li key={`${m.section}${m.label}`}><span className="text-muted">{m.section}:</span> {m.label}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      <p className="text-sm text-muted">Fields marked <span className="text-danger">*</span> are required. You can save and come back any time. Nothing is sent to HR as final until you press Submit at the bottom.</p>

      {PDS_SECTIONS.map((s) => (
        <Card key={s.key} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{s.title}</h2>
            {s.blurb && <p className="text-sm text-muted">{s.blurb}</p>}
          </div>
          {s.kind === "fields" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {s.fields.map((f) => {
                const values = data[s.key] as FieldsData;
                if (!cond(f.showIf, values)) return null;
                return <div key={f.key} className={SPAN[f.span ?? 1]}>{input(f, values[f.key] ?? "", `${s.key}.${f.key}`, (v) => setField(s.key, f.key, v), values)}</div>;
              })}
            </div>
          ) : (
            <RowsEditor
              s={s} data={data[s.key] as RowsData}
              onNone={(v) => edit((d) => { (d[s.key] as RowsData).none = v; })}
              onAdd={() => edit((d) => { (d[s.key] as RowsData).rows.push(blankRow(s)); })}
              onRemove={(i) => edit((d) => { (d[s.key] as RowsData).rows.splice(i, 1); })}
              cell={(i, f) => { const row = (data[s.key] as RowsData).rows[i]; return input(f, row[f.key] ?? "", `${s.key}.${i}.${f.key}`, (v) => setCell(s.key, i, f.key, v), row); }}
              attempted={attempted}
            />
          )}
        </Card>
      ))}

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
        <p className="text-sm text-muted">{dirty ? "You have changes that are not saved." : "All changes saved."}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => send(false)} className="rounded-lg border border-line px-4 py-2.5 font-semibold transition hover:bg-bg active:scale-95 disabled:opacity-60">{pending ? "Saving…" : "Save progress"}</button>
          <button type="button" disabled={pending} onClick={() => send(true)} className={buttonClass}>{pending ? "Please wait…" : submitted ? "Submit again" : "Submit my personal data sheet"}</button>
        </div>
      </div>
    </div>
  );
}

function RowsEditor({ s, data, onNone, onAdd, onRemove, cell, attempted }: {
  s: RowsSection; data: RowsData; onNone: (v: boolean) => void; onAdd: () => void; onRemove: (i: number) => void;
  cell: (i: number, f: Field) => React.ReactNode; attempted: boolean;
}) {
  const needsOne = s.min === 0 && !!s.none && !data.none && data.rows.length === 0;
  return (
    <div className="space-y-3">
      {s.none && (
        <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium ${attempted && needsOne ? "border-danger bg-danger/5" : "border-line"}`}>
          <input type="checkbox" name={`${s.key}.none`} checked={data.none} onChange={(e) => onNone(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" /> {s.none}
        </label>
      )}
      {!data.none && (
        <>
          {data.rows.map((_, i) => (
            <div key={i} className="rounded-xl border border-line p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">{s.rowLabel} {i + 1}</p>
                {data.rows.length > s.min && <button type="button" onClick={() => onRemove(i)} className="text-sm font-medium text-danger hover:underline">Remove</button>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {s.columns.map((f) => <div key={f.key}>{cell(i, f)}</div>)}
              </div>
            </div>
          ))}
          {data.rows.length < s.max && <button type="button" onClick={onAdd} className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5 active:scale-95">+ {s.addLabel}</button>}
        </>
      )}
    </div>
  );
}
