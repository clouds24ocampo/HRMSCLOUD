import { PDS_SECTIONS, type Field } from "@/lib/pds-config";
import { cond, type FieldsData, type PdsData, type RowsData } from "@/lib/pds";

// A submitted Personal Data Sheet, read-only: every section and every answer. Links are shown only for http(s) addresses
// (the form already drops anything else), and everything is plain text.
function Value({ f, v }: { f: Field; v: string }) {
  if (!v) return <span className="text-muted">–</span>;
  if (f.type === "check") return <>{v === "Yes" ? "Yes" : "No"}</>;
  if (f.type === "url" && /^https?:\/\//i.test(v)) return <a href={v} target="_blank" rel="noopener noreferrer nofollow" className="text-brand hover:underline [overflow-wrap:anywhere]">{v.replace(/^https?:\/\//i, "")}</a>;
  if (f.type === "email") return <a href={`mailto:${v}`} className="text-brand hover:underline [overflow-wrap:anywhere]">{v}</a>;
  return <span className="whitespace-pre-line [overflow-wrap:anywhere]">{v}</span>;
}

export function PdsView({ data }: { data: PdsData }) {
  return (
    <div className="space-y-5">
      {PDS_SECTIONS.map((s) => (
        <section key={s.key} className="rounded-2xl border border-line bg-surface p-5 shadow-sm print:break-inside-avoid print:shadow-none">
          <h2 className="text-base font-semibold">{s.title}</h2>
          {s.kind === "fields" ? (
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {s.fields.filter((f) => cond(f.showIf, (data[s.key] ?? {}) as FieldsData)).map((f) => {
                const v = ((data[s.key] ?? {}) as FieldsData)[f.key] ?? "";
                return (
                  <div key={f.key} className={f.span === 3 ? "sm:col-span-2 lg:col-span-3" : f.span === 2 ? "sm:col-span-2" : ""}>
                    {f.type === "check" ? (
                      <dd className="font-normal"><span className="font-semibold">{v === "Yes" ? "✓ " : "✗ "}</span>{f.label}</dd>
                    ) : (
                      <>
                        <dt className="text-xs text-muted">{f.label}</dt>
                        <dd className="font-medium"><Value f={f} v={v} /></dd>
                      </>
                    )}
                  </div>
                );
              })}
            </dl>
          ) : (() => {
            const r = (data[s.key] ?? { none: false, rows: [] }) as RowsData;
            if (r.rows.length === 0) return <p className="mt-3 text-sm text-muted">{r.none && s.none ? s.none : "Nothing listed."}</p>;
            return (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {r.rows.map((row, i) => (
                  <div key={i} className="rounded-xl border border-line p-3 text-sm print:break-inside-avoid">
                    <p className="mb-2 font-semibold">{s.rowLabel} {i + 1}</p>
                    <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                      {s.columns.filter((c) => row[c.key]).map((c) => <div key={c.key}><dt className="text-xs text-muted">{c.label}</dt><dd className="font-medium"><Value f={c} v={row[c.key]} /></dd></div>)}
                    </dl>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      ))}
    </div>
  );
}
