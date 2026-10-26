import { Icon } from "@/components/Icon";
import { headerGradient } from "@/lib/id-card-style";
/* eslint-disable @next/next/no-img-element -- private pictures behind a signed-in route; the image optimizer cannot fetch them */
export type IdCardData = {
  org: string; orgInitials: string; title: string; accent: string; onAccent: string; footer: string | null; logoUrl: string | null;
  name: string; employeeNo: string | null; position: string | null; department: string | null; hireDate: string | null;
  photoUrl: string | null; signatory: { name: string | null; title: string | null; signatureUrl: string | null };
  qr: string; // data: URL of the QR code that opens this person's profile
};

// The digital ID. Pure markup: the page decides what is shown (from the HR design) and builds the QR code.
// print-color-adjust keeps the colored header when the card is printed or saved as PDF.
export function IdCard({ d }: { d: IdCardData }) {
  const rows = [
    d.employeeNo && { label: "ID no.", value: d.employeeNo },
    d.department && { label: "Department", value: d.department },
    d.hireDate && { label: "Date hired", value: d.hireDate },
  ].filter((r): r is { label: string; value: string } => !!r);
  return (
    <article aria-label={`Employee ID of ${d.name}`} className="mx-auto w-full max-w-[22rem] overflow-hidden rounded-[1.75rem] bg-white text-slate-900 shadow-2xl ring-1 ring-black/5 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:shadow-none">
      <header className="relative overflow-hidden px-6 pb-16 pt-6" style={{ background: headerGradient(d.accent), color: d.onAccent }}>
        <span aria-hidden className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" />
        <span aria-hidden className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-black/10" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm">
            {d.logoUrl ? <img src={d.logoUrl} alt={`${d.org} logo`} className="h-full w-full object-contain" /> : <span aria-hidden className="text-base font-extrabold" style={{ color: d.accent }}>{d.orgInitials}</span>}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{d.org}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.22em] opacity-80">{d.title}</p>
          </div>
        </div>
      </header>

      <div className="relative -mt-12 flex flex-col items-center px-6 text-center">
        <div className="h-28 w-28 overflow-hidden rounded-full bg-slate-100 shadow-lg ring-4 ring-white">
          {d.photoUrl ? <img src={d.photoUrl} alt={`Photo of ${d.name}`} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-slate-400" aria-label="No photo"><Icon name="employee" className="h-12 w-12" /></span>}
        </div>
        <h2 className="mt-3 text-xl font-bold leading-tight tracking-tight">{d.name}</h2>
        {d.position && <p className="mt-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ color: d.accent, backgroundColor: `color-mix(in srgb, ${d.accent} 12%, white)` }}>{d.position}</p>}
        {rows.length > 0 && (
          <dl className="mt-4 w-full divide-y divide-slate-100 rounded-2xl bg-slate-50 px-4 py-1 text-left">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{r.label}</dt>
                <dd className="truncate text-sm font-semibold">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 px-6 pb-5">
        <div className="min-w-0 flex-1 text-left">
          {d.signatory.signatureUrl && <img src={d.signatory.signatureUrl} alt="Signature" className="h-10 max-w-36 object-contain" />}
          <p className="border-t border-slate-300 pt-1 text-xs font-semibold">{d.signatory.name ?? "Authorized signatory"}</p>
          {d.signatory.title && <p className="text-[11px] text-slate-500">{d.signatory.title}</p>}
        </div>
        <img src={d.qr} alt="QR code: scan to open this employee's profile" width={96} height={96} className="h-24 w-24 shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200" />
      </div>
      {d.footer && <p className="px-6 pb-4 text-center text-[11px] text-slate-500">{d.footer}</p>}
      <div aria-hidden className="h-2" style={{ background: headerGradient(d.accent) }} />
    </article>
  );
}
