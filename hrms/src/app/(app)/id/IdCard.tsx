/* eslint-disable @next/next/no-img-element -- private pictures behind a signed-in route; the image optimizer cannot fetch them */
export type IdCardData = {
  org: string; title: string; accent: string; footer: string | null;
  name: string; employeeNo: string | null; position: string | null; department: string | null; hireDate: string | null;
  photoUrl: string | null; signatory: { name: string | null; title: string | null; signatureUrl: string | null };
  qr: string; // data: URL of the QR code that opens this person's profile
};

// The digital ID. Pure markup: the page decides what is shown (from the HR design) and builds the QR code.
export function IdCard({ d }: { d: IdCardData }) {
  return (
    <article aria-label={`Employee ID of ${d.name}`} className="mx-auto w-full max-w-[22rem] overflow-hidden rounded-3xl border border-line bg-white text-slate-900 shadow-xl print:shadow-none">
      <header className="px-5 py-4 text-white" style={{ background: d.accent }}>
        <p className="truncate text-sm font-semibold opacity-90">{d.org}</p>
        <p className="text-lg font-extrabold tracking-widest">{d.title}</p>
      </header>
      <div className="flex flex-col items-center px-5 pt-5 text-center">
        <div className="h-32 w-32 overflow-hidden rounded-2xl border-4 bg-slate-100" style={{ borderColor: d.accent }}>
          {d.photoUrl ? <img src={d.photoUrl} alt={`Photo of ${d.name}`} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-4xl" aria-label="No photo">👤</span>}
        </div>
        <h2 className="mt-3 text-xl font-bold leading-tight">{d.name}</h2>
        {d.position && <p className="text-sm font-semibold" style={{ color: d.accent }}>{d.position}</p>}
        <dl className="mt-3 grid w-full grid-cols-2 gap-x-3 gap-y-1 text-left text-xs">
          {d.employeeNo && (<><dt className="text-slate-500">ID no.</dt><dd className="text-right font-semibold">{d.employeeNo}</dd></>)}
          {d.department && (<><dt className="text-slate-500">Department</dt><dd className="text-right font-semibold">{d.department}</dd></>)}
          {d.hireDate && (<><dt className="text-slate-500">Date hired</dt><dd className="text-right font-semibold">{d.hireDate}</dd></>)}
        </dl>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 px-5 pb-5">
        <div className="min-w-0 text-left">
          {d.signatory.signatureUrl && <img src={d.signatory.signatureUrl} alt="Signature" className="h-10 max-w-36 object-contain" />}
          <p className="border-t border-slate-300 pt-1 text-xs font-semibold">{d.signatory.name ?? "Authorized signatory"}</p>
          {d.signatory.title && <p className="text-[11px] text-slate-500">{d.signatory.title}</p>}
        </div>
        <img src={d.qr} alt="QR code: scan to open this employee's profile" width={96} height={96} className="h-24 w-24 shrink-0" />
      </div>
      {d.footer && <p className="border-t border-slate-200 px-5 py-2 text-center text-[11px] text-slate-500">{d.footer}</p>}
    </article>
  );
}
